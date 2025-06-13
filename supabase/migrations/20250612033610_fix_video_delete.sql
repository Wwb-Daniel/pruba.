/*
  # Fix video deletion conflicts
  
  1. Changes
    - Drop conflicting triggers and functions with CASCADE
    - Create a single, consolidated trigger for video deletion using AFTER DELETE
    - Ensure proper cleanup of related records including audio tracks
    - Fix ambiguous column references
*/

-- Drop all existing triggers and functions that might conflict
DROP TRIGGER IF EXISTS video_view_trigger ON video_views CASCADE;
DROP TRIGGER IF EXISTS views_count_trigger ON video_views CASCADE;
DROP TRIGGER IF EXISTS increment_views_trigger ON video_views CASCADE;
DROP TRIGGER IF EXISTS update_likes_count_trigger ON likes CASCADE;
DROP TRIGGER IF EXISTS update_comments_count_trigger ON comments CASCADE;
DROP TRIGGER IF EXISTS delete_original_audio_trigger ON videos CASCADE;
DROP TRIGGER IF EXISTS video_deletion_trigger ON videos CASCADE;
DROP TRIGGER IF EXISTS video_views_insert_trigger ON video_views CASCADE;

DROP FUNCTION IF EXISTS update_video_views_count() CASCADE;
DROP FUNCTION IF EXISTS increment_video_views() CASCADE;
DROP FUNCTION IF EXISTS handle_video_view() CASCADE;
DROP FUNCTION IF EXISTS update_likes_count() CASCADE;
DROP FUNCTION IF EXISTS update_comments_count() CASCADE;
DROP FUNCTION IF EXISTS handle_video_audio_deletion() CASCADE;
DROP FUNCTION IF EXISTS handle_video_deletion() CASCADE;

-- Create a single function to handle all video deletion cleanup
CREATE OR REPLACE FUNCTION handle_video_deletion()
RETURNS TRIGGER AS $$
DECLARE
    deleted_video_id UUID;
BEGIN
    -- Store the video ID before deletion
    deleted_video_id := OLD.id;
    
    -- Delete related records after the video is deleted
    DELETE FROM likes 
    WHERE content_type = 'video' 
    AND content_id = deleted_video_id;
    
    DELETE FROM comments 
    WHERE content_type = 'video' 
    AND content_id = deleted_video_id;
    
    DELETE FROM video_views 
    WHERE video_views.video_id = deleted_video_id;
    
    DELETE FROM video_hashtags 
    WHERE video_hashtags.video_id = deleted_video_id;
    
    DELETE FROM video_mentions 
    WHERE video_mentions.video_id = deleted_video_id;
    
    DELETE FROM video_saves 
    WHERE video_saves.video_id = deleted_video_id;
    
    -- Delete associated audio tracks
    DELETE FROM audio_tracks 
    WHERE audio_tracks.original_video_id = deleted_video_id 
    AND audio_tracks.is_original_video_audio = true;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a single trigger for video deletion using AFTER DELETE
CREATE TRIGGER video_deletion_trigger
    AFTER DELETE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION handle_video_deletion();

-- Recreate the views count trigger
CREATE OR REPLACE FUNCTION update_video_views_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE videos
    SET views_count = views_count + 1
    WHERE videos.id = NEW.video_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_views_insert_trigger
    AFTER INSERT ON video_views
    FOR EACH ROW
    EXECUTE FUNCTION update_video_views_count();

-- Recreate the likes count trigger
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE videos 
        SET likes_count = likes_count + 1 
        WHERE videos.id = NEW.content_id 
        AND NEW.content_type = 'video';
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE videos 
        SET likes_count = likes_count - 1 
        WHERE videos.id = OLD.content_id 
        AND OLD.content_type = 'video';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_likes_count_trigger
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW
    EXECUTE FUNCTION update_likes_count();

-- Recreate the comments count trigger
CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE videos 
        SET comments_count = comments_count + 1 
        WHERE videos.id = NEW.content_id 
        AND NEW.content_type = 'video';
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE videos 
        SET comments_count = comments_count - 1 
        WHERE videos.id = OLD.content_id 
        AND OLD.content_type = 'video';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comments_count_trigger
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comments_count(); 