
import React, { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ConfigCard from '@/components/ConfigCard';
import ProgressCard from '@/components/ProgressCard';
import ResultsCard from '@/components/ResultsCard';
import { supabase } from '@/integrations/supabase/client';

// Move generateDefaultPrompt outside component to prevent recreation
const generateDefaultPrompt = (currentMode: string, currentLabels: string[], currentContextWindow: number, currentMetadata: string[]) => {
  if (currentMode === 'labels') {
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
    const schemaObject: Record<string, string> = {};
    
    currentMetadata.forEach(field => {
      switch (field.toLowerCase()) {
        case 'filename':
        case 'file_name':
          schemaObject.file_name = 'example.txt';
          break;
        case 'quote':
          schemaObject.quote = 'verbatim text that matches …';
          break;
        case 'context before':
        case 'context_before':
          schemaObject.context_before = '… Part of preceding text ';
          break;
        case 'context after':
        case 'context_after':
          schemaObject.context_after = ' following text …';
          break;
        default:
          schemaObject[field.toLowerCase().replace(/\s+/g, '_')] = `example ${field.toLowerCase()}`;
      }
    });

    const outputSchema = JSON.stringify(schemaObject, null, 2);
    
    return `**Role**  
You are a precise research assistant whose task is to extract verbatim quotations from text files.

**Extraction criteria:** "<ADD YOUR CRITERIA HERE>"

**Context window:** ±${currentContextWindow} characters around each quote

**Rules**  
1. **Scan every file completely.**  
2. **Select a passage only if it clearly satisfies the extraction criteria.** Ignore marginal or repetitive text.  
3. **Quote verbatim.** Do **not** correct grammar, spelling, or punctuation.  
4. **Preserve minimal context.** Include just enough leading and trailing text (as defined by the window above) so the quote is understandable on its own. 
5. **No commentary or extra lines.** Output exactly the schema below—nothing more, nothing less.

**Output format (one JSON object per quote, newline-delimited)**  
\`\`\`json
${outputSchema}
\`\`\``;
  }
};

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
  const [metadata, setMetadata] = useState<string[]>(['Filename', 'Quote', 'Context Before', 'Context After']);
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
    localStorage.setItem('openai-api-key', newApiKey);
  };

  // Update prompt when dependencies change - now using external function
  useEffect(() => {
    const defaultPrompt = generateDefaultPrompt(mode, labels, contextWindow, metadata);
    setPrompt(defaultPrompt);
  }, [mode, labels, contextWindow, metadata]);

  // Job status polling
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (currentJobId && isProcessing) {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`https://dcwqdesukkexizcjiwpd.supabase.co/functions/v1/job-status?jobId=${currentJobId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          const data = await response.json();
          
          if (!response.ok) throw new Error(data.error || 'Failed to check job status');
          
          if (data.success && data.job) {
            const job = data.job;
            setProgress(job.progress);
            setProgressMessage(`Processing... ${job.processedRows}/${job.totalRows} rows (${job.progress}%)`);
            
            if (job.status === 'completed') {
              setProgress(100);
              setProgressMessage('Processing complete!');
              
              // Create download URL from result data
              const blob = new Blob([atob(job.resultData)], { type: 'text/csv' });
              const downloadUrl = URL.createObjectURL(blob);
              
              setResults({
                success: true,
                downloadUrl,
                filename: `labeled_${job.fileName}`,
                summary: `Successfully labeled ${job.processedRows} rows`,
                previewData: []
              });
              
              setIsProcessing(false);
              setCurrentJobId(null);
            } else if (job.status === 'failed') {
              setError(job.errorMessage || 'Processing failed');
              setIsProcessing(false);
              setCurrentJobId(null);
            }
          }
        } catch (err) {
          console.error('Error checking job status:', err);
        }
      }, 2000); // Poll every 2 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentJobId, isProcessing]);

  const handleRun = async () => {
    console.log('Starting handleRun...');
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResults(null);
    setCurrentJobId(null);

    try {
      setProgressMessage('Preparing files...');
      console.log('Number of files:', files.length);
      
      // For large files, process them more efficiently to avoid stack overflow
      const fileData = await Promise.all(
        files.map(async (file, index) => {
          console.log(`Processing file ${index + 1}/${files.length}: ${file.name} (${file.size} bytes)`);
          
          // For very large files, use a more memory-efficient approach
          if (file.size > 10 * 1024 * 1024) { // 10MB threshold
            console.log('Large file detected, using chunked processing');
            const reader = new FileReader();
            return new Promise<{data: string, name: string}>((resolve) => {
              reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1]; // Remove data:type;base64, prefix
                resolve({
                  data: base64,
                  name: file.name
                });
              };
              reader.readAsDataURL(file);
            });
          } else {
            // Standard processing for smaller files
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
            return {
              data: base64,
              name: file.name
            };
          }
        })
      );

      if (mode === 'labels') {
        // Check file size to determine processing method
        const fileSizeInBytes = files[0]?.size || 0;
        const estimatedRows = Math.floor(fileSizeInBytes / 100); // Rough estimate
        
        if (estimatedRows > 1000) {
          // Use queue system for large files
          setProgressMessage('Queuing large file for background processing...');
          
          const { data, error: functionError } = await supabase.functions.invoke('queue-job', {
            body: {
              fileData: fileData[0].data,
              fileName: fileData[0].name,
              labels,
              prompt: prompt || generateDefaultPrompt(mode, labels, contextWindow, metadata),
              model,
              apiKey
            }
          });

          if (functionError) {
            throw new Error(functionError.message);
          }

          if (!data.success) {
            throw new Error(data.error || 'Failed to queue job');
          }

          setCurrentJobId(data.jobId);
          setProgressMessage(`Job queued successfully. Processing ${data.totalRows} rows in background...`);
        } else {
          // Use direct processing for smaller files
          setProgressMessage('Processing spreadsheet with AI...');

          const { data, error: functionError } = await supabase.functions.invoke('process-spreadsheet', {
            body: {
              fileData: fileData[0].data,
              fileName: fileData[0].name,
              labels,
              prompt: prompt || generateDefaultPrompt(mode, labels, contextWindow, metadata),
              model,
              apiKey
            }
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
        }
      } else {
        // Quote extraction handling remains the same
        setProgressMessage('Extracting quotes with AI...');
        setProgress(50);

        const { data, error: functionError } = await supabase.functions.invoke('extract-quotes', {
          body: {
            files: fileData,
            prompt: prompt || generateDefaultPrompt(mode, labels, contextWindow, metadata),
            model,
            apiKey,
            contextWindow
          }
        });

        if (functionError) {
          throw new Error(functionError.message);
        }

        if (!data.success) {
          throw new Error(data.error || 'Processing failed');
        }

        setProgress(100);
        setProgressMessage('Complete!');

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
      }

    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsProcessing(false);
      setCurrentJobId(null);
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
          metadata={metadata}
          onFilesChange={setFiles}
          onLabelsChange={setLabels}
          onPromptChange={setPrompt}
          onApiKeyChange={handleApiKeyChange}
          onModelChange={setModel}
          onContextWindowChange={setContextWindow}
          onMetadataChange={setMetadata}
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
