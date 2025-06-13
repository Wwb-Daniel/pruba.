-- Create the audio_tracks bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio_tracks', 'audio_tracks', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the audio_tracks bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio_tracks');

CREATE POLICY "Authenticated users can upload audio files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio_tracks' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own audio files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'audio_tracks'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own audio files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio_tracks'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Set up CORS configuration for the bucket
UPDATE storage.buckets
SET public = true,
    file_size_limit = 10485760, -- 10MB
    allowed_mime_types = ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg']
WHERE id = 'audio_tracks'; 