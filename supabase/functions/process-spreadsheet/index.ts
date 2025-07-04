
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  fileData: string; // base64 encoded file
  fileName: string;
  labels: string[];
  prompt: string;
  model: string;
  apiKey: string; // User provided API key
}

interface ClassificationResult {
  row: number;
  originalRow: string[]; // Store the original row as array
  label: string;
  confidence?: number;
}

// Initialize Supabase client for progress updates
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Robust CSV parser that handles complex text data
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
        // Handle escaped quotes (two consecutive quotes)
        currentField += '"';
        i += 2; // Skip both quotes
        continue;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row (only if not inside quotes)
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          result.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      }
      // Skip \r\n combinations
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      // Regular character or newline inside quotes
      currentField += char;
    }
    
    i++;
  }
  
  // Handle last field and row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      result.push(currentRow);
    }
  }
  
  // Filter out completely empty rows
  return result.filter(row => row.some(field => field.length > 0));
}

// Function to properly escape CSV values
function escapeCsvValue(value: string): string {
  // Always wrap in quotes if the value contains special characters or is complex
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r') || value.trim() !== value) {
    // Escape any existing quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileData, fileName, labels, prompt, model, apiKey }: ProcessRequest = await req.json();

    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    console.log(`Processing file: ${fileName} with ${labels.length} labels using model: ${model}`);

    // Check if it's an Excel file
    const isExcel = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');
    
    let rows: string[][];
    
    if (isExcel) {
      // For Excel files, return a helpful error message
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Excel files are not fully supported yet. Please save your Excel file as a CSV file and try again. You can do this by opening the file in Excel and using "Save As" > "CSV (Comma delimited)".'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Handle CSV files with improved parsing
      const binaryString = atob(fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const textContent = new TextDecoder('utf-8').decode(bytes);
      rows = parseCSV(textContent);
    }
    
    if (rows.length < 2) {
      throw new Error('File must contain at least a header row and one data row');
    }
    
    const headerRow = rows[0];
    const dataRows = rows.slice(1); // Skip header
    const totalRows = dataRows.length;
    console.log(`Found ${totalRows} rows to process`);
    console.log(`Header: ${headerRow.join(' | ')}`);
    console.log(`First data row sample: ${dataRows[0]?.slice(0, 3).join(' | ')}...`);

    // Process rows in batches to avoid rate limits
    const batchSize = 5;
    const results: ClassificationResult[] = [];
    
    for (let i = 0; i < dataRows.length; i += batchSize) {
      const batch = dataRows.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (row, batchIndex) => {
        const rowIndex = i + batchIndex + 2; // +2 for header and 1-based indexing
        const rowText = row.join(' '); // Join all columns with space for classification
        
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'system',
                  content: `${prompt}\n\nAvailable labels: ${labels.join(', ')}\n\nRespond with only the most appropriate label from the list above.`
                },
                {
                  role: 'user',
                  content: `Classify this data: ${rowText}`
                }
              ],
              max_tokens: 50,
              temperature: 0.1,
            }),
          });

          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} - ${await response.text()}`);
          }

          const data = await response.json();
          const classification = data.choices[0].message.content.trim();
          
          // Validate that the classification is one of the provided labels
          const selectedLabel = labels.find(label => 
            classification.toLowerCase().includes(label.toLowerCase())
          ) || labels[0]; // Fallback to first label if no match

          return {
            row: rowIndex,
            originalRow: row, // Store the original row as array
            label: selectedLabel,
          };
        } catch (error) {
          console.error(`Error processing row ${rowIndex}:`, error);
          return {
            row: rowIndex,
            originalRow: row, // Store the original row as array
            label: labels[0], // Fallback label
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Calculate progress based on rows processed
      const rowsProcessed = results.length;
      const progressPercentage = Math.round((rowsProcessed / totalRows) * 100);
      
      console.log(`Processed ${rowsProcessed}/${totalRows} rows - Progress: ${progressPercentage}%`);
      
      // Small delay to avoid rate limiting
      if (i + batchSize < dataRows.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('Generating final output...');

    // Generate CSV output with proper column structure
    const outputHeader = [...headerRow, 'Label'].map(escapeCsvValue).join(',');
    const outputRows = results.map(result => {
      const rowWithLabel = [...result.originalRow, result.label];
      return rowWithLabel.map(escapeCsvValue).join(',');
    }).join('\n');
    const outputCsv = outputHeader + '\n' + outputRows;

    // Convert to base64 for download
    const outputBase64 = btoa(unescape(encodeURIComponent(outputCsv)));

    console.log(`Successfully processed ${results.length} rows`);

    return new Response(JSON.stringify({
      success: true,
      processedRows: results.length,
      downloadData: outputBase64,
      filename: `labeled_${fileName.replace(/\.xlsx?$/i, '.csv')}`,
      summary: `Successfully labeled ${results.length} rows with ${labels.length} categories`,
      previewData: results.slice(0, 10).map(r => ({
        row: r.row,
        original: r.originalRow.join(' | ').substring(0, 100) + (r.originalRow.join(' | ').length > 100 ? '...' : ''),
        label: r.label
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-spreadsheet function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
