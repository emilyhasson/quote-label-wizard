import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessQueueRequest {
  jobId: string;
  apiKey: string;
}

interface ClassificationResult {
  row: number;
  originalRow: string[];
  label: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Robust CSV parser
function parseCSV(text: string): string[][] {
  const lines = text.split('\n');
  const result: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          result.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      }
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentField += char;
    }
    
    i++;
  }
  
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      result.push(currentRow);
    }
  }
  
  return result.filter(row => row.some(field => field.length > 0));
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r') || value.trim() !== value) {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}

async function processJobChunk(job: any, apiKey: string, startRow: number, chunkSize: number): Promise<ClassificationResult[]> {
  console.log(`Processing chunk: rows ${startRow} to ${startRow + chunkSize - 1} for job ${job.id}`);
  
  // Parse CSV data
  const binaryString = atob(job.file_data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const textContent = new TextDecoder('utf-8').decode(bytes);
  const rows = parseCSV(textContent);
  
  const headerRow = rows[0];
  const dataRows = rows.slice(1);
  const endRow = Math.min(startRow + chunkSize, dataRows.length);
  const chunkRows = dataRows.slice(startRow, endRow);
  
  const results: ClassificationResult[] = [];
  const batchSize = 10;
  
  for (let i = 0; i < chunkRows.length; i += batchSize) {
    const batch = chunkRows.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (row, batchIndex) => {
      const absoluteRowIndex = startRow + i + batchIndex + 2; // +2 for header and 1-based indexing
      const rowText = row.join(' ').substring(0, 4000);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: job.model,
            messages: [
              {
                role: 'system',
                content: `${job.prompt}\n\nAvailable labels: ${job.labels.join(', ')}\n\nRespond with only the most appropriate label from the list above.`
              },
              {
                role: 'user',
                content: `Classify this data: ${rowText}`
              }
            ],
            max_tokens: 50,
            temperature: 0.1,
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const classification = data.choices[0].message.content.trim();
        
        const selectedLabel = job.labels.find((label: string) => 
          classification.toLowerCase().includes(label.toLowerCase())
        ) || job.labels[0];

        return {
          row: absoluteRowIndex,
          originalRow: row,
          label: selectedLabel,
        };
      } catch (error) {
        console.error(`Error processing row ${absoluteRowIndex}:`, error.message);
        return {
          row: absoluteRowIndex,
          originalRow: row,
          label: job.labels[0],
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay to avoid rate limiting
    if (i + batchSize < chunkRows.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  return results;
}

async function processJob(jobId: string, apiKey: string) {
  try {
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    // Update job status to processing
    await supabase
      .from('processing_jobs')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString() 
      })
      .eq('id', jobId);

    console.log(`Starting background processing for job ${jobId} with ${job.total_rows} rows`);

    const allResults: ClassificationResult[] = [];
    const chunkSize = 100; // Process 100 rows at a time
    
    // Parse CSV to get header
    const binaryString = atob(job.file_data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const textContent = new TextDecoder('utf-8').decode(bytes);
    const rows = parseCSV(textContent);
    const headerRow = rows[0];
    
    // Process in chunks
    for (let startRow = 0; startRow < job.total_rows; startRow += chunkSize) {
      try {
        const chunkResults = await processJobChunk(job, apiKey, startRow, chunkSize);
        allResults.push(...chunkResults);
        
        // Update progress
        const processedRows = Math.min(startRow + chunkSize, job.total_rows);
        await supabase
          .from('processing_jobs')
          .update({ processed_rows: processedRows })
          .eq('id', jobId);
          
        console.log(`Job ${jobId}: Processed ${processedRows}/${job.total_rows} rows`);
        
      } catch (chunkError) {
        console.error(`Error processing chunk starting at row ${startRow}:`, chunkError);
        // Continue with next chunk
      }
    }

    // Generate final CSV
    const outputHeader = [...headerRow, 'Label'].map(escapeCsvValue).join(',');
    const outputRows = allResults
      .sort((a, b) => a.row - b.row)
      .map(result => {
        const rowWithLabel = [...result.originalRow, result.label];
        return rowWithLabel.map(escapeCsvValue).join(',');
      }).join('\n');
    const outputCsv = outputHeader + '\n' + outputRows;
    const outputBase64 = btoa(unescape(encodeURIComponent(outputCsv)));

    // Update job as completed
    await supabase
      .from('processing_jobs')
      .update({ 
        status: 'completed',
        processed_rows: allResults.length,
        result_data: outputBase64,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`Job ${jobId} completed successfully. Processed ${allResults.length} rows.`);

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    
    // Update job as failed
    await supabase
      .from('processing_jobs')
      .update({ 
        status: 'failed',
        error_message: error.message
      })
      .eq('id', jobId);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, apiKey }: ProcessQueueRequest = await req.json();
    
    // Start background processing without waiting
    EdgeRuntime.waitUntil(processJob(jobId, apiKey));
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Background processing started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-queue function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});