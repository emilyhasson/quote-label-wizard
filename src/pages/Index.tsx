
import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ConfigCard from '@/components/ConfigCard';
import ProgressCard from '@/components/ProgressCard';
import ResultsCard from '@/components/ResultsCard';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [mode, setMode] = useState<'labels' | 'quotes'>('labels');
  const [files, setFiles] = useState<File[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('openai-api-key') || '';
  });
  const [model, setModel] = useState('gpt-4o-mini');
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
    localStorage.setItem('openai-api-key', newApiKey);
  };

  const getDefaultPrompt = () => {
    if (mode === 'labels') {
      return `You are helping to categorize data in a spreadsheet. For each row of data, assign one of the provided labels that best describes the content. Be consistent and accurate in your labeling.

Instructions:
- Read each row carefully
- Choose the most appropriate label from the provided options
- If unsure, choose the closest match
- Be consistent in your labeling approach`;
    } else {
      return `Extract relevant quotes from the provided text files based on the following criteria. Focus on finding meaningful, substantive quotes that are relevant to the topic.

Instructions:
- Look for quotes that are insightful or important
- Include enough context to understand the quote
- Maintain the original wording exactly
- Note the source for each quote`;
    }
  };

  const handleRun = async () => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResults(null);

    try {
      setProgressMessage('Preparing files...');
      setProgress(10);

      // Convert files to base64
      const filePromises = files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64 = btoa(String.fromCharCode(...uint8Array));
        return {
          data: base64,
          name: file.name
        };
      });

      const fileData = await Promise.all(filePromises);
      setProgress(25);

      const functionName = mode === 'labels' ? 'process-spreadsheet' : 'extract-quotes';
      setProgressMessage(mode === 'labels' ? 'Processing spreadsheet with AI...' : 'Extracting quotes with AI...');
      setProgress(50);

      let requestBody;
      if (mode === 'labels') {
        requestBody = {
          fileData: fileData[0].data,
          fileName: fileData[0].name,
          labels,
          prompt: prompt || getDefaultPrompt(),
          model,
          apiKey // Pass the user's API key
        };
      } else {
        requestBody = {
          files: fileData,
          prompt: prompt || getDefaultPrompt(),
          model,
          apiKey // Pass the user's API key
        };
      }

      const { data, error: functionError } = await supabase.functions.invoke(functionName, {
        body: requestBody
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Processing failed');
      }

      setProgress(100);
      setProgressMessage('Complete!');

      // Create download URL
      const blob = new Blob([atob(data.downloadData)], { type: 'text/csv' });
      const downloadUrl = URL.createObjectURL(blob);

      const processedResults = {
        success: true,
        downloadUrl,
        filename: data.filename,
        summary: data.summary,
        previewData: data.previewData
      };

      setTimeout(() => {
        setResults(processedResults);
        setIsProcessing(false);
      }, 500);

    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setLabels([]);
    setPrompt('');
    setProgress(0);
    setProgressMessage('');
    setResults(null);
    setError(null);
    setIsProcessing(false);
  };

  const handleCancel = () => {
    setIsProcessing(false);
    setProgress(0);
    setProgressMessage('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header currentMode={mode} onModeChange={setMode} />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 space-y-8">
        <ConfigCard
          mode={mode}
          files={files}
          labels={labels}
          prompt={prompt}
          apiKey={apiKey}
          model={model}
          onFilesChange={setFiles}
          onLabelsChange={setLabels}
          onPromptChange={setPrompt}
          onApiKeyChange={handleApiKeyChange}
          onModelChange={setModel}
          onRun={handleRun}
          isProcessing={isProcessing}
        />
        
        {(isProcessing || error) && (
          <ProgressCard
            status={error ? 'error' : 'running'}
            progress={progress}
            message={error || progressMessage}
            onCancel={isProcessing ? handleCancel : undefined}
            error={error || undefined}
          />
        )}
        
        {results && (
          <ResultsCard
            success={results.success}
            downloadUrl={results.downloadUrl}
            filename={results.filename}
            summary={results.summary}
            previewData={results.previewData}
            onReset={handleReset}
          />
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
