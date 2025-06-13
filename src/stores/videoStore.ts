import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { processVideoAudio } from '../lib/audioProcessor';
import { generateThumbnail } from '../lib/thumbnailGenerator';

export interface AudioTrack {
  id: string;
  title: string;
  audio_url: string;
  user_id: string;
  created_at: string;
  genre: string;
  tags: string[];
  updated_at: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  user_id: string;
  audio_track_id?: string;
  video_volume: number;
  audio_volume: number;
  created_at: string;
}

interface User {
  id: string;
  email: string;
}

interface VideoStore {
  user: User | null;
  videos: Video[];
  setUser: (user: User | null) => void;
  uploadVideo: (file: File, title: string, description: string, audioTrackId?: string, videoVolume?: number, audioVolume?: number) => Promise<Video>;
  fetchVideos: () => Promise<void>;
}

export const useVideoStore = create<VideoStore>((set, get) => ({
  user: null,
  videos: [],

  setUser: (user: User | null) => set({ user }),

  uploadVideo: async (file: File, title: string, description: string, audioTrackId?: string, videoVolume: number = 1, audioVolume: number = 1) => {
    const store = get();
    const user = store.user;

    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    try {
      console.log('Iniciando subida de video...');
      console.log('Usuario autenticado:', user.id);

      // Obtener audio track si existe
      let audioTrack: AudioTrack | null = null;
      if (audioTrackId) {
        console.log('Obteniendo audio track:', audioTrackId);
        const { data: track, error: trackError } = await supabase
          .from('audio_tracks')
          .select('*')
          .eq('id', audioTrackId)
          .single();

        if (trackError) throw trackError;
        audioTrack = track;
        console.log('Audio track obtenido:', track.title);
      }

      // Procesar audio
      console.log('Iniciando procesamiento de audio...');
      const processedBlob = await processVideoAudio(
        file,
        audioTrack,
        videoVolume,
        audioVolume
      );

      // Subir video
      console.log('Subiendo video a storage...');
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, processedBlob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;
      console.log('Video subido exitosamente');

      // Obtener URL pública
      console.log('Obteniendo URL pública...');
      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      // Generar thumbnail
      console.log('Generando thumbnail...');
      let thumbnailBlob: Blob | null = null;
      try {
        thumbnailBlob = await generateThumbnail(file);
      } catch (error) {
        console.error("Error generating thumbnail:", error);
      }

      const thumbnailFileName = `${timestamp}_thumbnail.jpg`;
      const thumbnailPath = `${user.id}/${thumbnailFileName}`;

      if (thumbnailBlob) {
        const { error: thumbnailUploadError } = await supabase.storage
          .from('thumbnails')
          .upload(thumbnailPath, thumbnailBlob, {
            cacheControl: '3600',
            upsert: false,
          });

        if (thumbnailUploadError) throw thumbnailUploadError;
      }

      const { data: { publicUrl: thumbnailUrl } } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(thumbnailPath);

      // Insertar metadatos
      console.log('Insertando metadatos del video...');
      const videoData = {
        title,
        description,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        user_id: user.id,
        audio_track_id: audioTrackId,
        video_volume: videoVolume,
        audio_volume: audioVolume
      };

      console.log('Insertando metadatos del video...', videoData);
      const { data: video, error: insertError } = await supabase
        .from('videos')
        .insert([videoData])
        .select()
        .single();

      if (insertError) throw insertError;
      console.log('Video insertado exitosamente:', video);

      // Actualizar lista de videos
      console.log('Actualizando lista de videos...');
      await store.fetchVideos();
      console.log('Subida completada exitosamente');

      return video;
    } catch (error) {
      console.error('Error durante la subida:', error);
      throw error;
    }
  },

  fetchVideos: async () => {
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching videos:', error);
      throw error;
    }

    set({ videos });
  }
})); 