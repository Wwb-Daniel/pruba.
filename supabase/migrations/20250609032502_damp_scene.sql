/*
  # Crear tabla videos_vistos para rastrear videos vistos por usuario
  
  1. Nueva Tabla
    - `videos_vistos` - Rastrea qué videos ha visto cada usuario
    
  2. Estructura
    - `id` - UUID primary key
    - `user_id` - Referencia al usuario que vio el video
    - `video_id` - Referencia al video que fue visto
    - `visto_en` - Timestamp de cuándo se vio el video
    - Restricción UNIQUE para evitar duplicados
    
  3. Seguridad
    - Habilitar RLS
    - Políticas para que usuarios solo puedan ver/insertar sus propios registros
*/

-- Crear tabla videos_vistos
CREATE TABLE IF NOT EXISTS videos_vistos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  visto_en TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, video_id)
);

-- Habilitar Row Level Security
ALTER TABLE videos_vistos ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
CREATE POLICY "Usuarios pueden ver sus propios videos vistos"
  ON videos_vistos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden insertar sus propios videos vistos"
  ON videos_vistos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_videos_vistos_user_id ON videos_vistos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_vistos_video_id ON videos_vistos(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_vistos_visto_en ON videos_vistos(visto_en);
CREATE INDEX IF NOT EXISTS idx_videos_vistos_user_video ON videos_vistos(user_id, video_id);

-- Función para marcar video como visto (opcional, para uso desde el backend)
CREATE OR REPLACE FUNCTION marcar_video_visto(p_user_id UUID, p_video_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO videos_vistos (user_id, video_id)
  VALUES (p_user_id, p_video_id)
  ON CONFLICT (user_id, video_id) DO NOTHING;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener videos no vistos por un usuario
CREATE OR REPLACE FUNCTION obtener_videos_no_vistos(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  video_url TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ,
  likes_count INTEGER,
  comments_count INTEGER,
  views_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.title,
    v.description,
    v.video_url,
    v.user_id,
    v.created_at,
    v.likes_count,
    v.comments_count,
    v.views_count
  FROM videos v
  WHERE v.id NOT IN (
    SELECT vv.video_id 
    FROM videos_vistos vv 
    WHERE vv.user_id = p_user_id
  )
  ORDER BY 
    v.likes_count DESC,
    v.comments_count DESC,
    v.views_count DESC,
    v.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;