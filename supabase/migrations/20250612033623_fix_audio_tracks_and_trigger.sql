BEGIN;

-- 1. Primero eliminamos las vistas dependientes
DROP VIEW IF EXISTS public_audio_tracks CASCADE;

-- 2. Eliminamos el trigger y función existentes para evitar conflictos
DROP TRIGGER IF EXISTS video_audio_creation_trigger ON videos;
DROP FUNCTION IF EXISTS handle_video_audio_creation();

-- 3. Actualizamos la estructura de la tabla
ALTER TABLE audio_tracks
DROP COLUMN IF EXISTS cover_image_url CASCADE,
DROP COLUMN IF EXISTS thumbnail_url CASCADE,
DROP COLUMN IF EXISTS is_original_video_audio CASCADE,
DROP COLUMN IF EXISTS original_video_id CASCADE,
DROP COLUMN IF EXISTS audio_type CASCADE,
DROP COLUMN IF EXISTS is_public CASCADE,
DROP COLUMN IF EXISTS uses_count CASCADE,
DROP COLUMN IF EXISTS likes_count CASCADE;

-- 4. Creamos la nueva función y trigger primero
CREATE OR REPLACE FUNCTION handle_video_audio_creation()
RETURNS TRIGGER AS $$
DECLARE
    new_audio_track_id UUID;
BEGIN
    -- Si ya se proporcionó un audio_track_id, no crear uno nuevo
    IF NEW.audio_track_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Verificar si ya existe un audio track para este video
    SELECT id INTO new_audio_track_id
    FROM audio_tracks
    WHERE audio_url = NEW.video_url;

    -- Si no existe, crear uno nuevo
    IF new_audio_track_id IS NULL THEN
        INSERT INTO audio_tracks (
            user_id,
            title,
            audio_url,
            genre,
            tags
        ) VALUES (
            NEW.user_id,
            NEW.title || ' (Audio)',
            NEW.video_url,
            'Original',
            ARRAY[]::TEXT[]
        )
        RETURNING id INTO new_audio_track_id;
    END IF;

    -- Actualizar el video con el ID del audio track
    NEW.audio_track_id := new_audio_track_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Agregamos las columnas con sus valores por defecto
ALTER TABLE audio_tracks
ADD COLUMN cover_image_url TEXT,
ADD COLUMN thumbnail_url TEXT,
ADD COLUMN is_original_video_audio BOOLEAN DEFAULT false,
ADD COLUMN original_video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
ADD COLUMN audio_type TEXT DEFAULT 'custom' CHECK (audio_type IN ('custom', 'original', 'music', 'sound_effect')),
ADD COLUMN is_public BOOLEAN DEFAULT true,
ADD COLUMN uses_count INTEGER DEFAULT 0,
ADD COLUMN likes_count INTEGER DEFAULT 0;

-- 6. Actualizamos los registros existentes con valores por defecto
UPDATE audio_tracks
SET cover_image_url = COALESCE(cover_image_url, 'https://smfeokrmhrtfxgwtppaq.supabase.co/storage/v1/object/public/defaults/default_cover.jpg'),
    thumbnail_url = COALESCE(thumbnail_url, 'https://smfeokrmhrtfxgwtppaq.supabase.co/storage/v1/object/public/defaults/default_thumbnail.jpg'),
    audio_type = COALESCE(audio_type, 'custom'),
    is_public = COALESCE(is_public, true),
    uses_count = COALESCE(uses_count, 0),
    likes_count = COALESCE(likes_count, 0);

-- 7. Ahora hacemos las columnas NOT NULL
ALTER TABLE audio_tracks
ALTER COLUMN cover_image_url SET NOT NULL,
ALTER COLUMN cover_image_url SET DEFAULT 'https://smfeokrmhrtfxgwtppaq.supabase.co/storage/v1/object/public/defaults/default_cover.jpg',
ALTER COLUMN thumbnail_url SET NOT NULL,
ALTER COLUMN thumbnail_url SET DEFAULT 'https://smfeokrmhrtfxgwtppaq.supabase.co/storage/v1/object/public/defaults/default_thumbnail.jpg';

-- 8. Creamos los índices
CREATE INDEX IF NOT EXISTS idx_audio_tracks_original_video ON audio_tracks(original_video_id);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_audio_type ON audio_tracks(audio_type);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_is_public ON audio_tracks(is_public);

-- 9. Creamos el trigger
CREATE TRIGGER video_audio_creation_trigger
    BEFORE INSERT ON videos
    FOR EACH ROW
    EXECUTE FUNCTION handle_video_audio_creation();

-- 10. Recreamos la vista
CREATE OR REPLACE VIEW public_audio_tracks AS
SELECT 
    at.*,
    p.username,
    p.avatar_url
FROM audio_tracks at
LEFT JOIN profiles p ON at.user_id = p.id;

COMMIT; 