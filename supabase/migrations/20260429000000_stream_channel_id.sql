-- Add stream_channel_id to consultation_requests so both patient and doctor can join the chat
ALTER TABLE consultation_requests
  ADD COLUMN IF NOT EXISTS stream_channel_id TEXT;
