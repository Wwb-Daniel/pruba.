import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Video, AudioTrack } from '../lib/supabase';
import { processVideoAudio } from '../lib/audioProcessor';
import { generateThumbnail } from '../lib/thumbnailGenerator';
import { Video as VideoType } from '../types/video';

interface VideoState {
  videos: VideoType[];
  currentVideo: VideoType | null;
  loading: boolean;
  error: string | null;
  uploadProgress: number;
  isUploading: boolean;
  uploadError: string | null;
  hasMore: boolean;
  feedType: 'all' | 'following' | 'foryou' | 'explore';
  fetchVideos: (params: { page: number; limit: number; category?: string; userId?: string }) => Promise<void>;
  uploadVideo: (file: File, metadata: { title: string; description: string; category?: string }) => Promise<void>;
  updateVideo: (videoId: string, title: string, description: string | null) => Promise<void>;
  deleteVideo: (videoId: string) => Promise<void>;
  likeVideo: (videoId: string) => Promise<void>;
  unlikeVideo: (videoId: string) => Promise<void>;
  saveVideo: (videoId: string) => Promise<void>;
  setCurrentVideo: (video: VideoType | null) => void;
  setFeedType: (type: 'all' | 'following' | 'foryou' | 'explore') => void;
  marcarVideoVisto: (videoId: string) => Promise<void>;
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
    get().fetchVideos({ page: 1, limit: PAGE_SIZE });
  },

  marcarVideoVisto: async (videoId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('video_views')
        .insert({
          user_id: user.id,
          video_id: videoId
        });

      if (error && error.code !== '23505') { // Ignorar error de duplicado
        console.error('Error marcando video como visto:', error);
      }
    } catch (error) {
      console.error('Error marcando video como visto:', error);
    }
  },

  fetchVideos: async (params) => {
    try {
      set({ loading: true, error: null });
      let query = supabase
        .from('videos')
        .select(`
          *,
          user:profiles(*)
        `)
        .order('created_at', { ascending: false })
        .range((params.page - 1) * params.limit, params.page * params.limit - 1);

      if (params.category) {
        query = query.eq('category', params.category);
      }

      if (params.userId) {
        query = query.eq('user_id', params.userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      set({ videos: data || [], loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  uploadVideo: async (file, metadata) => {
    try {
      set({ loading: true, error: null });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Upload video file
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('videos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      // Create video record
      const { error: insertError, data: videoData } = await supabase
        .from('videos')
        .insert({
          title: metadata.title,
          description: metadata.description,
          video_url: publicUrl,
          user_id: user.id,
          category: metadata.category,
          status: 'processing'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update local state
      set(state => ({
        videos: [videoData, ...state.videos],
        loading: false
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
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
      await get().fetchVideos({ page: 1, limit: PAGE_SIZE });
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
      await get().fetchVideos({ page: 1, limit: PAGE_SIZE });
    } catch (error: any) {
      set({ error: error.message });
      console.error('Error eliminando video:', error);
    } finally {
      set({ loading: false });
    }
  },

  likeVideo: async (videoId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('video_likes')
        .insert({ video_id: videoId, user_id: user.id });

      if (error) throw error;

      // Update local state
      const videos = get().videos.map(video => 
        video.id === videoId 
          ? { ...video, likes: video.likes + 1 }
          : video
      );
      set({ videos });

      const currentVideo = get().currentVideo;
      if (currentVideo?.id === videoId) {
        set({ currentVideo: { ...currentVideo, likes: currentVideo.likes + 1 } });
      }
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  unlikeVideo: async (videoId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('video_likes')
        .delete()
        .match({ video_id: videoId, user_id: user.id });

      if (error) throw error;

      // Update local state
      const videos = get().videos.map(video => 
        video.id === videoId 
          ? { ...video, likes: Math.max(0, video.likes - 1) }
          : video
      );
      set({ videos });

      const currentVideo = get().currentVideo;
      if (currentVideo?.id === videoId) {
        set({ 
          currentVideo: { 
            ...currentVideo, 
            likes: Math.max(0, currentVideo.likes - 1) 
          } 
        });
      }
    } catch (error) {
      set({ error: (error as Error).message });
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

  setCurrentVideo: (video) => {
    set({ currentVideo: video });
  },
}));

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
  console.log('Insertando metadatos del video...', videoData);
  
  const { data: video, error } = await supabase
    .from('videos')
    .insert([
      {
        title: videoData.title,
        description: videoData.description,
        video_url: videoData.video_url,
        thumbnail_url: videoData.thumbnail_url,
        user_id: videoData.user_id,
        audio_track_id: videoData.audio_track_id,
        video_volume: videoData.video_volume,
        audio_volume: videoData.audio_volume,
        is_audio_track: !!videoData.audio_track_id
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error insertando video:', error);
    throw error;
  }

  console.log('Video insertado exitosamente:', video);
  return video;
};