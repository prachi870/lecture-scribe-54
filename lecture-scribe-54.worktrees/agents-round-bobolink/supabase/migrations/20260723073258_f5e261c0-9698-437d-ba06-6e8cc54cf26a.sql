
-- Add transcription-related columns to lectures
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS transcript_error text,
  ADD COLUMN IF NOT EXISTS transcribed_at timestamptz;

ALTER TABLE public.lectures
  DROP CONSTRAINT IF EXISTS lectures_transcript_status_check;
ALTER TABLE public.lectures
  ADD CONSTRAINT lectures_transcript_status_check
  CHECK (transcript_status IN ('idle','pending','processing','completed','failed'));

-- Storage RLS: users can manage only files under their own {user_id}/ folder in lecture-audio bucket
CREATE POLICY "Users read own lecture audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lecture-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own lecture audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lecture-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own lecture audio"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lecture-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own lecture audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lecture-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
