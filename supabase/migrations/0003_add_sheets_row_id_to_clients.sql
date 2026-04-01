-- Add sheets_row_id to track which Google Sheet row each client came from
ALTER TABLE public.clients
  ADD COLUMN sheets_row_id TEXT UNIQUE;
