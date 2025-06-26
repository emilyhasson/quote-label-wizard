
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
        console.log(`Processing file: ${file.name}`);
        
        // Decode file content
        const binaryString = atob(file.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const fileContent = new TextDecoder('utf-8').decode(bytes);
        
        console.log(`File ${file.name} content length: ${fileContent.length} characters`);

        // Split into manageable chunks (aim for ~2000 characters per chunk)
        const maxChunkSize = 2000;
        const paragraphs = fileContent.split('\n\n').filter(p => p.trim().length > 0);
        const chunks: string[] = [];
        
        let currentChunk = '';
        for (const paragraph of paragraphs) {
          if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = paragraph;
          } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          }
        }
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        
        console.log(`File ${file.name} split into ${chunks.length} chunks`);
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          if (chunk.length < 100) {
            console.log(`Skipping short chunk ${i + 1} (${chunk.length} chars)`);
            continue;
          }
          
          console.log(`Processing chunk ${i + 1}/${chunks.length} for ${file.name} (${chunk.length} chars)`);
          
          const systemPrompt = `${prompt}

IMPORTANT: You must respond with valid JSON only. Return an array of objects, each with exactly these fields:
- "quote": the actual quote text (string)
- "context": brief context explaining the quote (string)

Example format:
[
  {
    "quote": "This is an example quote from the text.",
    "context": "This quote discusses the importance of example quotes."
  }
]

If no relevant quotes are found, return an empty array: []

Do not include any explanation or text outside the JSON array.`;

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
                    content: systemPrompt
                  },
                  {
                    role: 'user',
                    content: `Extract relevant quotes from this text:\n\n${chunk}`
                  }
                ],
                max_tokens: 1500,
                temperature: 0.1,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`OpenAI API error for chunk ${i + 1}: ${response.status} - ${errorText}`);
              continue;
            }

            const data = await response.json();
            const content = data.choices[0].message.content.trim();
            
            console.log(`Raw OpenAI response for chunk ${i + 1}: ${content.substring(0, 200)}...`);
            
            try {
              // Try to extract JSON from the response
              let jsonContent = content;
              
              // Sometimes OpenAI wraps JSON in markdown code blocks
              const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
              if (jsonMatch) {
                jsonContent = jsonMatch[1];
                console.log(`Extracted JSON from code block for chunk ${i + 1}`);
              }
              
              const quotes = JSON.parse(jsonContent);
              
              if (Array.isArray(quotes)) {
                const validQuotes = quotes.filter(q => 
                  q && 
                  typeof q === 'object' && 
                  typeof q.quote === 'string' && 
                  q.quote.trim().length > 10
                );
                
                console.log(`Found ${validQuotes.length} valid quotes in chunk ${i + 1}`);
                
                validQuotes.forEach(q => {
                  allQuotes.push({
                    source: file.name,
                    quote: q.quote.trim(),
                    context: (q.context || '').trim()
                  });
                });
              } else {
                console.log(`Response for chunk ${i + 1} is not an array:`, typeof quotes);
              }
            } catch (parseError) {
              console.error(`Failed to parse JSON for chunk ${i + 1}:`, parseError);
              console.log(`Problematic content: ${content}`);
            }
          } catch (fetchError) {
            console.error(`Request failed for chunk ${i + 1}:`, fetchError);
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        console.log(`Completed processing ${file.name}, total quotes so far: ${allQuotes.length}`);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }

    // Generate CSV output with proper escaping
    function escapeCsvValue(value: string): string {
      if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }

    const csvHeader = 'Filename,Quote,Context\n';
    const csvRows = allQuotes.map(q => 
      `${escapeCsvValue(q.source)},${escapeCsvValue(q.quote)},${escapeCsvValue(q.context)}`
    ).join('\n');
    const outputCsv = csvHeader + csvRows;

    // Convert to base64 for download
    const outputBase64 = btoa(unescape(encodeURIComponent(outputCsv)));

    console.log(`Successfully extracted ${allQuotes.length} quotes from ${files.length} files`);

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
