/*
  # Add profile visitors tracking
  
  1. New Tables
    - `profile_visitors` - Track who visits user profiles
    
  2. Security
    - Enable RLS on new table
    - Add appropriate security policies
*/

-- Create profile visitors table
CREATE TABLE IF NOT EXISTS profile_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id, visitor_id)
);

-- Enable RLS
ALTER TABLE profile_visitors ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their profile visitors"
  ON profile_visitors FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can record profile visits"
  ON profile_visitors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = visitor_id);

CREATE POLICY "Users can update their visits"
  ON profile_visitors FOR UPDATE
  TO authenticated
  USING (auth.uid() = visitor_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profile_visitors_profile_id ON profile_visitors(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_visitors_visited_at ON profile_visitors(visited_at DESC);

-- Function to record profile visit
CREATE OR REPLACE FUNCTION record_profile_visit(p_profile_id UUID, p_visitor_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO profile_visitors (profile_id, visitor_id)
  VALUES (p_profile_id, p_visitor_id)
  ON CONFLICT (profile_id, visitor_id) 
  DO UPDATE SET visited_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;