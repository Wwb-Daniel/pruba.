-- Create audio_tracks table
CREATE TABLE IF NOT EXISTS audio_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  genre TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE audio_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public audio tracks are viewable by everyone"
  ON audio_tracks FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own audio tracks"
  ON audio_tracks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audio tracks"
  ON audio_tracks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio tracks"
  ON audio_tracks FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_audio_tracks_updated_at
  BEFORE UPDATE ON audio_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add audio_track_id to videos table
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS audio_track_id UUID REFERENCES audio_tracks(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audio_tracks_user_id ON audio_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_genre ON audio_tracks(genre);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_tags ON audio_tracks USING GIN(tags); 