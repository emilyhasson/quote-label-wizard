-- Update RLS policies to work without authentication for now
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.processing_jobs;
DROP POLICY IF EXISTS "Users can create their own jobs" ON public.processing_jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON public.processing_jobs;

-- Create temporary policies that allow access without authentication
CREATE POLICY "Allow all access to jobs for now" 
ON public.processing_jobs 
FOR ALL 
USING (true)
WITH CHECK (true);