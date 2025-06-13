-- Agregar columnas de volumen a la tabla videos
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS video_volume DECIMAL(3,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS audio_volume DECIMAL(3,2) DEFAULT 0.50;
 
-- Agregar comentarios a las columnas
COMMENT ON COLUMN videos.video_volume IS 'Volumen del video original (0.00 a 1.00)';
COMMENT ON COLUMN videos.audio_volume IS 'Volumen del audio track (0.00 a 1.00)'; 