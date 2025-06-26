
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractRequest {
  files: Array<{
    data: string; // base64 encoded
    name: string;
  }>;
  prompt: string;
  model: string;
  apiKey: string; // User provided API key
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { files, prompt, model, apiKey }: ExtractRequest = await req.json();

    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    console.log(`Extracting quotes from ${files.length} files using model: ${model}`);

    const allQuotes: Array<{
      source: string;
      quote: string;
      context: string;
    }> = [];

    for (const file of files) {
      try {
        // Decode file content
        const fileContent = new TextDecoder().decode(
          Uint8Array.from(atob(file.data), c => c.charCodeAt(0))
        );

        // Split into chunks to avoid token limits
        const chunks = fileContent.split('\n\n').filter(chunk => chunk.trim().length > 50);
        
        for (const chunk of chunks) {
          if (chunk.trim().length < 100) continue; // Skip very short chunks
          
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
                  content: `${prompt}\n\nRespond with a JSON array of objects, each containing "quote" and "context" fields. Only include meaningful quotes that match the criteria. If no relevant quotes are found, return an empty array.`
                },
                {
                  role: 'user',
                  content: `Extract relevant quotes from this text:\n\n${chunk}`
                }
              ],
              max_tokens: 1000,
              temperature: 0.1,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices[0].message.content.trim();
            
            try {
              const quotes = JSON.parse(content);
              if (Array.isArray(quotes)) {
                quotes.forEach(q => {
                  if (q.quote && q.quote.length > 10) {
                    allQuotes.push({
                      source: file.name,
                      quote: q.quote,
                      context: q.context || ''
                    });
                  }
                });
              }
            } catch (parseError) {
              console.log('Failed to parse quotes JSON, skipping chunk');
            }
          } else {
            console.error(`OpenAI API error: ${response.status} - ${await response.text()}`);
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }

    // Generate CSV output
    const csvHeader = 'Source,Quote,Context\n';
    const csvRows = allQuotes.map(q => 
      `"${q.source}","${q.quote.replace(/"/g, '""')}","${q.context.replace(/"/g, '""')}"`
    ).join('\n');
    const outputCsv = csvHeader + csvRows;

    // Convert to base64 for download - Fixed encoding
    const outputBase64 = btoa(unescape(encodeURIComponent(outputCsv)));

    console.log(`Successfully extracted ${allQuotes.length} quotes`);

    return new Response(JSON.stringify({
      success: true,
      extractedQuotes: allQuotes.length,
      downloadData: outputBase64,
      filename: 'extracted_quotes.csv',
      summary: `Extracted ${allQuotes.length} quotes from ${files.length} file(s)`,
      previewData: allQuotes.slice(0, 10)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-quotes function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
