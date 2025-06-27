
import React, { useState, useEffect } from 'react';
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
  const [contextWindow, setContextWindow] = useState(75);
  
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

  const getDefaultPrompt = (currentLabels: string[] = labels) => {
    if (mode === 'labels') {
      const labelsString = currentLabels.length > 0 ? `[${currentLabels.join(', ')}]` : '[]';
      return `**Role:**  
You are a meticulous data-labeling assistant.

**Labels:** ${labelsString}

**Goal:**  
For **each row** in the uploaded spreadsheet, assign **exactly one** label from the provided list that best captures the row's meaning.

**Labeling rules**  
1. **Read the entire row.** Consider every cell, not just the first few.  
2. **Pick only from the given labels.** Do **not** invent new ones.  
3. **Tie-breakers:**  
   • If more than one label seems to fit, choose the most specific.  
   • If no label is perfect, choose the closest reasonable match.  
4. **Be consistent.** Apply the same criteria across rows.  
5. **Output format:** Return a single word or phrase—the chosen label—per row.

Begin labeling now.`;
    } else {
      return `**Role**  
You are a precise research assistant whose task is to extract verbatim quotations from text files.

**Extraction criteria:** "<ADD YOUR CRITERIA HERE>"

**Context window:** ±${contextWindow} characters around each quote   ← default 75; user may override

**Rules**  
1. **Scan every file completely.**  
2. **Select a passage only if it clearly satisfies the extraction criteria.** Ignore marginal or repetitive text.  
3. **Quote verbatim.** Do **not** correct grammar, spelling, or punctuation.  
4. **Preserve minimal context.** Include just enough leading and trailing text (as defined by the window above) so the quote is understandable on its own. 
5. **No commentary or extra lines.** Output exactly the schema below—nothing more, nothing less.`;
    }
  };

  // Update prompt when labels change or mode changes
  const handleLabelsChange = (newLabels: string[]) => {
    setLabels(newLabels);
    if (mode === 'labels') {
      const updatedPrompt = getDefaultPrompt(newLabels);
      setPrompt(updatedPrompt);
    }
  };

  // Reset prompt when mode changes
  useEffect(() => {
    setPrompt(getDefaultPrompt());
  }, [mode]);

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
          apiKey, // Pass the user's API key
          contextWindow
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
          contextWindow={contextWindow}
          onFilesChange={setFiles}
          onLabelsChange={handleLabelsChange}
          onPromptChange={setPrompt}
          onApiKeyChange={handleApiKeyChange}
          onModelChange={setModel}
          onContextWindowChange={setContextWindow}
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
