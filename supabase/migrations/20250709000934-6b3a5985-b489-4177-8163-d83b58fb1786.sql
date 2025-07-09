-- Make user_id nullable to work without authentication
ALTER TABLE public.processing_jobs 
ALTER COLUMN user_id DROP NOT NULL;