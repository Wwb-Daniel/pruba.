/*
  # Fix trigger conflict in video views system
  
  1. Changes
    - Drop conflicting triggers and functions
    - Create a single, consolidated trigger system
    - Use AFTER triggers instead of BEFORE triggers
  
  2. Security
    - Maintain existing RLS policies
*/

-- Drop all existing conflicting triggers and functions
DROP TRIGGER IF EXISTS video_view_trigger ON video_views;
DROP TRIGGER IF EXISTS views_count_trigger ON video_views;
DROP TRIGGER IF EXISTS increment_views_trigger ON video_views;
DROP TRIGGER IF EXISTS video_view_trigger ON content_views;
DROP FUNCTION IF EXISTS update_video_views_count();
DROP FUNCTION IF EXISTS increment_video_views();
DROP FUNCTION IF EXISTS handle_video_view();
DROP FUNCTION IF EXISTS sync_video_views_count();

-- Create a single, consolidated function for handling video views
CREATE OR REPLACE FUNCTION handle_video_view_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if this is a new view (not an update)
    IF TG_OP = 'INSERT' THEN
        UPDATE videos
        SET views_count = views_count + 1
        WHERE id = NEW.video_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a single AFTER trigger for video views
CREATE TRIGGER video_views_insert_trigger
    AFTER INSERT ON video_views
    FOR EACH ROW
    EXECUTE FUNCTION handle_video_view_insert();

-- Ensure the video_views table has the correct structure
ALTER TABLE video_views 
DROP CONSTRAINT IF EXISTS video_views_user_id_video_id_key;

ALTER TABLE video_views 
ADD CONSTRAINT video_views_user_id_video_id_key 
UNIQUE (user_id, video_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_user_id ON video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_video_views_created_at ON video_views(created_at);