import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueueJobRequest {
  fileData: string;
  fileName: string;
  labels: string[];
  prompt: string;
  model: string;
  apiKey: string;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileData, fileName, labels, prompt, model, apiKey }: QueueJobRequest = await req.json();
    
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    console.log(`Queuing job for file: ${fileName}`);

    // Parse the CSV to get row count
    const binaryString = atob(fileData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const textContent = new TextDecoder('utf-8').decode(bytes);
    const rows = parseCSV(textContent);
    
    if (rows.length < 2) {
      throw new Error('File must contain at least a header row and one data row');
    }

    const totalRows = rows.length - 1; // Exclude header
    
    // Get user ID from auth header - for now use null since auth isn't implemented
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // For now, use null for user ID since authentication isn't implemented yet
    const userId = null;
    
    // Create job in database
    const { data: job, error } = await supabase
      .from('processing_jobs')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_data: fileData,
        total_rows: totalRows,
        labels,
        prompt,
        model,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create job: ${error.message}`);
    }

    // Trigger background processing
    const processResponse = await supabase.functions.invoke('process-queue', {
      body: { jobId: job.id, apiKey }
    });

    if (processResponse.error) {
      console.error('Failed to trigger background processing:', processResponse.error);
    }

    return new Response(JSON.stringify({
      success: true,
      jobId: job.id,
      totalRows,
      message: `Job queued successfully. Processing ${totalRows} rows in background.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in queue-job function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});