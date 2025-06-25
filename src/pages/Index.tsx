
import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ConfigCard from '@/components/ConfigCard';
import ProgressCard from '@/components/ProgressCard';
import ResultsCard from '@/components/ResultsCard';

const Index = () => {
  const [mode, setMode] = useState<'labels' | 'quotes'>('labels');
  const [files, setFiles] = useState<File[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('openai-api-key') || '';
  });
  const [model, setModel] = useState('gpt-3.5-turbo-16k');
  
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

  const handleRrun = async () => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResults(null);

    try {
      // Simulate processing
      setProgressMessage(`${mode === 'labels' ? 'Analyzing spreadsheet' : 'Processing text files'}...`);
      setProgress(25);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProgressMessage(`${mode === 'labels' ? 'Applying labels' : 'Extracting quotes'}...`);
      setProgress(50);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProgressMessage('Generating results...');
      setProgress(75);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProgress(100);
      setProgressMessage('Complete!');
      
      // Mock results
      const mockResults = {
        success: true,
        downloadUrl: '#',
        filename: mode === 'labels' ? 'labeled_data.xlsx' : 'extracted_quotes.xlsx',
        summary: mode === 'labels' 
          ? `Successfully labeled ${files.length} file(s) with ${labels.length} categories.`
          : `Extracted ${Math.floor(Math.random() * 50) + 10} quotes from ${files.length} file(s).`,
        previewData: mode === 'labels'
          ? [
              { row: 1, original: 'Sample data', label: labels[0] || 'Category A' },
              { row: 2, original: 'More data', label: labels[1] || 'Category B' },
              { row: 3, original: 'Additional info', label: labels[0] || 'Category A' },
            ]
          : [
              { source: files[0]?.name || 'file1.txt', quote: 'This is an extracted quote...', context: 'Relevant context' },
              { source: files[0]?.name || 'file1.txt', quote: 'Another meaningful quote...', context: 'More context' },
            ]
      };
      
      setTimeout(() => {
        setResults(mockResults);
        setIsProcessing(false);
      }, 500);
      
    } catch (err) {
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
          onRun={handleRrun}
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
