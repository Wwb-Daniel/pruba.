-- Add viewed column to profile_visitors table
ALTER TABLE profile_visitors
ADD COLUMN IF NOT EXISTS viewed BOOLEAN DEFAULT false;

-- Update existing records to mark them as viewed
UPDATE profile_visitors
SET viewed = true
WHERE viewed IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profile_visitors_viewed ON profile_visitors(viewed);

-- Update the record_profile_visit function to include viewed status
CREATE OR REPLACE FUNCTION record_profile_visit(p_profile_id UUID, p_visitor_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO profile_visitors (profile_id, visitor_id, viewed)
  VALUES (p_profile_id, p_visitor_id, false)
  ON CONFLICT (profile_id, visitor_id) 
  DO UPDATE SET 
    visited_at = now(),
    viewed = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 