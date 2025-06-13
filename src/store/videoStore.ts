import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Video, AudioTrack } from '../lib/supabase';
import { processVideoAudio } from '../lib/audioProcessor';
import { generateThumbnail } from '../lib/thumbnailGenerator';

interface VideoState {
  videos: Video[];
  currentVideo: Video | null;
  loading: boolean;
  error: string | null;
  uploadProgress: number;
  isUploading: boolean;
  uploadError: string | null;
  hasMore: boolean;
  feedType: 'all' | 'following' | 'foryou' | 'explore';
  fetchVideos: (page: number) => Promise<void>;
  uploadVideo: (
    file: File,
    title: string,
    description: string,
    options?: {
    audioTrackId?: string;
      videoVolume?: number;
      audioVolume?: number;
    }
  ) => Promise<Video>;
  updateVideo: (videoId: string, title: string, description: string | null) => Promise<void>;
  deleteVideo: (videoId: string) => Promise<void>;
  likeVideo: (videoId: string) => Promise<boolean>;
  saveVideo: (videoId: string) => Promise<void>;
  setCurrentVideo: (video: Video | null) => void;
  setFeedType: (type: 'all' | 'following' | 'foryou' | 'explore') => void;
  marcarVideoVisto: (videoId: string) => Promise<void>;
  updateVideoCommentsCount: (videoId: string) => void;
}

interface UploadProgress {
  loaded: number;
  total: number;
}

interface UploadOptions {
  audioTrackId?: string;
  videoVolume?: number;
  audioVolume?: number;
  musicTrack?: string;
  effects?: string[];
  challengeId?: string;
  hashtags?: string[];
  mentions?: string[];
}

const PAGE_SIZE = 5;

const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
};

const insertVideoRecord = async (
  videoData: {
    title: string;
    description?: string;
    video_url: string;
    thumbnail_url: string;
    user_id: string;
    audio_track_id: string | null;
    video_volume: number;
    audio_volume: number;
  }
) => {
  const { data, error } = await supabase.from('videos').insert([videoData]).select().single();
  if (error) {
    console.error('Error insertando video record:', error);
    throw error;
  }
  return data;
};

export const useVideoStore = create<VideoState>((set, get) => ({
  videos: [],
  currentVideo: null,
  loading: false,
  error: null,
  uploadProgress: 0,
  isUploading: false,
  uploadError: null,
  hasMore: true,
  feedType: 'all',

  setFeedType: (type) => {
    set({ feedType: type, videos: [], hasMore: true });
    get().fetchVideos(0);
  },

  marcarVideoVisto: async (videoId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Primero verificar si ya existe la vista
      const { data: existingView } = await supabase
        .from('video_views')
        .select('id')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .maybeSingle();

      if (existingView) {
        // Si ya existe la vista, no hacer nada
        return;
      }

      // Si no existe, crear la vista
      const { error } = await supabase
        .from('video_views')
        .insert({
          user_id: user.id,
          video_id: videoId
        });

      if (error) {
        if (error.code === '23505') {
          // Ignorar error de duplicado (por si acaso)
          return;
        }
        console.error('Error marcando video como visto:', error);
        throw error;
      }

      // Actualizar el contador de vistas en el estado local
      set((state) => ({
        videos: state.videos.map(v => 
          v.id === videoId 
            ? { ...v, views_count: (v.views_count || 0) + 1 }
            : v
        ),
        currentVideo: state.currentVideo?.id === videoId 
          ? { ...state.currentVideo, views_count: (state.currentVideo.views_count || 0) + 1 }
          : state.currentVideo
      }));
    } catch (error: any) {
      console.error('Error marcando video como visto:', error);
      console.error('Detalles del error al marcar video como visto:', error.code, error.message, error);
      throw error;
    }
  },

  fetchVideos: async (page = 0) => {
    const { videos, feedType } = get();
    set({ loading: true, error: null });
    
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select(
          `
          *,
          likes_count,
          comments_count,
          views_count,
          user_profile:profiles!user_id(id,username,avatar_url,is_verified,is_vip),
          audio_track:audio_tracks!audio_track_id(id,title,audio_url,genre,tags,user_id,created_at,updated_at,user_profile:profiles!user_id(id,username,avatar_url)),
          video_hashtags(hashtag:hashtags(id,name)),
          challenge:challenges(id,name,description)
          `
        )
        .order('created_at', { ascending: false })
        .range(from, to);

      if (videosError) throw videosError;
      
      const transformedData = videosData.map(video => ({
        ...video,
        likes_count: video.likes_count || 0,
        comments_count: video.comments_count || 0,
        views_count: video.views_count || 0
      }));
      
      const newVideos = page === 0 ? transformedData : [...videos, ...transformedData];
      set({ 
        videos: newVideos,
        hasMore: videosData.length === PAGE_SIZE,
      });

      // Si hay un currentVideo, actualizarlo también
      const currentVideo = get().currentVideo;
      if (currentVideo) {
        const updatedCurrentVideo = transformedData.find(v => v.id === currentVideo.id);
        if (updatedCurrentVideo) {
          set({ currentVideo: updatedCurrentVideo });
        }
      }
    } catch (error: any) {
       set({ error: error.message });
       console.error('Error fetching videos:', error);
     } finally {
       set({ loading: false });
      }
    },

  uploadVideo: async (
    file: File,
    title: string,
    description: string,
    options: UploadOptions = {}
  ) => {
    try {
      // Inicializar estado
      set({ 
        isUploading: true, 
        uploadProgress: 0, 
        uploadError: null,
        error: null 
      });
      console.log('Iniciando subida de video...');

      // Autenticar usuario
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuario no autenticado');
      }
      console.log('Usuario autenticado:', user.id);
      set({ uploadProgress: 5 });

      // Obtener audio track si se especificó
      let audioTrack: AudioTrack | null = null;
      if (options.audioTrackId) {
        console.log('Obteniendo audio track:', options.audioTrackId);
        const { data: track, error: trackError } = await supabase
          .from('audio_tracks')
          .select('*, user_profile:profiles!user_id(id, username, avatar_url)')
          .eq('id', options.audioTrackId)
          .single();

        if (trackError) {
          throw new Error('Error al obtener el audio track');
        }
        audioTrack = track;
        console.log('Audio track obtenido:', track.title);
        set({ uploadProgress: 10 });
      }

      // Procesar el video con el audio
      console.log('Iniciando procesamiento de audio...');
      const processedVideo = await processVideoAudio(
        file,
        audioTrack,
        options.videoVolume ?? 0,
        options.audioVolume ?? 0.5
      );
      console.log('Procesamiento de audio completado');
      set({ uploadProgress: 30 });

      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const sanitizedFileName = sanitizeFileName(file.name);
      const storageFileName = `${user.id}/${timestamp}_${sanitizedFileName}`;
      
      // Subir el video procesado con reintentos
      console.log('Subiendo video a storage...');
      let uploadAttempts = 0;
      const MAX_UPLOAD_ATTEMPTS = 3;
      let uploadError: any = null;

      while (uploadAttempts < MAX_UPLOAD_ATTEMPTS) {
        try {
          const { data: videoData, error: currentUploadError } = await supabase.storage
        .from('videos')
            .upload(storageFileName, processedVideo, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'video/webm'
            });

          if (currentUploadError) {
            uploadError = currentUploadError;
            uploadAttempts++;
            console.warn(`Intento de subida ${uploadAttempts} fallido:`, currentUploadError);
            
            if (uploadAttempts < MAX_UPLOAD_ATTEMPTS) {
              // Esperar antes de reintentar (tiempo exponencial)
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, uploadAttempts)));
              continue;
            }
          } else {
            uploadError = null;
            break;
          }
        } catch (error) {
          uploadError = error;
          uploadAttempts++;
          console.error(`Error en intento de subida ${uploadAttempts}:`, error);
          
          if (uploadAttempts < MAX_UPLOAD_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, uploadAttempts)));
            continue;
          }
        }
      }

      if (uploadError) {
        throw new Error(`Error al subir video después de ${MAX_UPLOAD_ATTEMPTS} intentos: ${uploadError.message}`);
      }

      console.log('Video subido exitosamente');
      set({ uploadProgress: 60 });

      // Obtener URL pública
      console.log('Obteniendo URL pública...');
      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(storageFileName);

      if (!publicUrlData?.publicUrl) {
        throw new Error('No se pudo obtener la URL pública del video');
      }

      // Generar thumbnail
      console.log('Generando thumbnail...');
      set({ uploadProgress: 70 });
      const thumbnailBlob = await generateThumbnail(processedVideo);
      const thumbnailFileName = `${user.id}/${timestamp}_thumbnail.jpg`;
      
      // Subir thumbnail con reintentos
      console.log('Subiendo thumbnail...');
      let thumbnailAttempts = 0;
      let thumbnailError: any = null;

      while (thumbnailAttempts < MAX_UPLOAD_ATTEMPTS) {
        try {
          const { data: thumbnailData, error: currentThumbnailError } = await supabase.storage
            .from('thumbnails')
            .upload(thumbnailFileName, thumbnailBlob, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'image/jpeg'
            });

          if (currentThumbnailError) {
            thumbnailError = currentThumbnailError;
            thumbnailAttempts++;
            console.warn(`Intento de subida de thumbnail ${thumbnailAttempts} fallido:`, currentThumbnailError);
            
            if (thumbnailAttempts < MAX_UPLOAD_ATTEMPTS) {
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, thumbnailAttempts)));
              continue;
            }
          } else {
            thumbnailError = null;
            break;
          }
        } catch (error) {
          thumbnailError = error;
          thumbnailAttempts++;
          console.error(`Error en intento de subida de thumbnail ${thumbnailAttempts}:`, error);
          
          if (thumbnailAttempts < MAX_UPLOAD_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, thumbnailAttempts)));
            continue;
          }
        }
      }

      if (thumbnailError) {
        throw new Error(`Error al subir thumbnail después de ${MAX_UPLOAD_ATTEMPTS} intentos: ${thumbnailError.message}`);
      }

      set({ uploadProgress: 80 });

      const { data: thumbnailUrlData } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(thumbnailFileName);

      if (!thumbnailUrlData?.publicUrl) {
        throw new Error('No se pudo obtener la URL pública del thumbnail');
      }

      // Insertar metadatos
      console.log('Insertando metadatos del video...');
      set({ uploadProgress: 90 });
      const video = await insertVideoRecord({
        title,
        description,
        video_url: publicUrlData.publicUrl,
        thumbnail_url: thumbnailUrlData.publicUrl,
        user_id: user.id,
        audio_track_id: options.audioTrackId || null,
        video_volume: options.videoVolume ?? 0,
        audio_volume: options.audioVolume ?? 0.5
      });

      // Actualizar lista de videos
      console.log('Actualizando lista de videos...');
      await get().fetchVideos(0);
      console.log('Subida completada exitosamente');
      set({ 
        uploadProgress: 100, 
        isUploading: false,
        error: null,
        uploadError: null
      });

      return video;
    } catch (error) {
      console.error('Error en el proceso de subida:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ 
        uploadError: errorMessage,
        error: errorMessage,
        isUploading: false,
        uploadProgress: 0
      });
      throw error;
    }
  },

  updateVideo: async (videoId, title, description) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('videos')
        .update({
          title,
          description: description || null,
          is_edited: true,
        })
        .eq('id', videoId);

      if (error) throw error;
      await get().fetchVideos(0);
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  deleteVideo: async (videoId) => {
    set({ loading: true, error: null });
    try {
      // 1. Obtener el video para tener la URL del archivo
      const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('video_url, user_id')
        .eq('id', videoId)
        .single();

      if (fetchError) throw fetchError;
      if (!video) throw new Error('Video no encontrado');

      // 2. Eliminar el archivo de almacenamiento
      if (video.video_url) {
        const fileName = video.video_url.split('/').pop();
        if (fileName) {
          const { error: storageError } = await supabase
            .storage
            .from('videos')
            .remove([`${video.user_id}/${fileName}`]);

          if (storageError) {
            console.error('Error eliminando archivo de almacenamiento:', storageError);
            // Continuamos aunque falle la eliminación del archivo
          }
        }
      }

      // 3. Eliminar el registro del video (esto activará el trigger)
      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (deleteError) throw deleteError;

      // 4. Actualizar la lista de videos
      await get().fetchVideos(0);
    } catch (error: any) {
      set({ error: error.message });
      console.error('Error eliminando video:', error);
    } finally {
      set({ loading: false });
    }
  },

  likeVideo: async (videoId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Primero verificar si ya existe el like
      const { data: existingLike, error: checkError } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('content_id', videoId)
        .eq('content_type', 'video')
        .maybeSingle();
        
      if (checkError) throw checkError;

      let wasLiked = false;

      if (existingLike) {
        // Si existe, eliminar el like
        const { error: deleteError } = await supabase
          .from('likes')
          .delete()
          .eq('id', existingLike.id);

        if (deleteError) throw deleteError;
        wasLiked = false;
      } else {
        // Si no existe, crear el like
        const { error: insertError } = await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            content_id: videoId,
            content_type: 'video',
            video_id: videoId
          });

        if (insertError) {
          if (insertError.code === '23505') {
            console.log('Like already exists, ignoring insertion');
            return false;
          }
          throw insertError;
        }
        wasLiked = true;
      }

      // Obtener el conteo actualizado de likes
      const { count: newLikesCount, error: countError } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('content_id', videoId)
        .eq('content_type', 'video');

      if (countError) {
        console.error('Error obteniendo conteo de likes:', countError);
        throw countError;
      }

      // Actualizar el estado local con el conteo exacto
      set((state) => {
        const updatedVideos = state.videos.map(v => 
          v.id === videoId 
            ? { ...v, likes_count: newLikesCount || 0 }
            : v
        );
        const updatedCurrentVideo = state.currentVideo?.id === videoId 
          ? { ...state.currentVideo, likes_count: newLikesCount || 0 }
          : state.currentVideo;

        return {
          videos: updatedVideos,
          currentVideo: updatedCurrentVideo
        };
      });

      return wasLiked;
    } catch (error) {
      console.error('Error in likeVideo:', error);
      throw error;
    }
  },

  saveVideo: async (videoId) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('User not authenticated');
      
      const { data: existingSave } = await supabase
        .from('video_saves')
        .select()
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .maybeSingle();
        
      if (existingSave) {
        await supabase
          .from('video_saves')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);
      } else {
        await supabase
          .from('video_saves')
          .insert({
            user_id: user.id,
            video_id: videoId,
          });
      }
    } catch (error) {
      console.error('Error saving video:', error);
    }
  },

  setCurrentVideo: (video) => set({ currentVideo: video }),

  updateVideoCommentsCount: async (videoId: string) => {
    try {
      // Obtener el conteo actualizado de comentarios
      const { count: newCommentsCount, error: countError } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('video_id', videoId);

      if (countError) {
        console.error('Error obteniendo conteo de comentarios:', countError);
        throw countError;
      }

      // Actualizar el estado local con el conteo exacto
      set((state) => {
        const updatedVideos = state.videos.map(v => 
          v.id === videoId 
            ? { ...v, comments_count: newCommentsCount || 0 }
            : v
        );
        const updatedCurrentVideo = state.currentVideo?.id === videoId 
          ? { ...state.currentVideo, comments_count: newCommentsCount || 0 }
          : state.currentVideo;

        return {
          videos: updatedVideos,
          currentVideo: updatedCurrentVideo
        };
      });
    } catch (error) {
      console.error('Error updating comments count:', error);
      throw error;
    }
  },
}));