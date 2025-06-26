
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

// Simple CSV parser
function parseCSV(text: string): string[][] {
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
    return result;
  });
}

// Function to properly escape CSV values
function escapeCsvValue(value: string): string {
  // If the value contains commas, quotes, or newlines, wrap it in quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
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
      // Handle CSV files
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
    console.log(`Found ${dataRows.length} rows to process`);

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
      
      console.log(`Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(dataRows.length/batchSize)}`);
      
      // Small delay to avoid rate limiting
      if (i + batchSize < dataRows.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

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
