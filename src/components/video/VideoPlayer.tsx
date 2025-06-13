import React, { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Share2, User, Volume2, VolumeX, Play, Pause, Bookmark, MoreVertical, Plus, Check, Pencil, Trash2, Download, Crown, Music, AlertTriangle, CheckCircle } from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { useUserStore } from '../../store/userStore';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import type { Video } from '../../lib/supabase';
import CommentSection from './CommentSection';
import EditVideoModal from './EditVideoModal';
import AudioDiscPlayer from '../audio/AudioDiscPlayer';
import AudioMarquee from '../audio/AudioMarquee';
import Button from '../ui/Button';

interface VideoPlayerProps {
  video: Video;
  isActive: boolean;
}

const VideoPlayer = ({ video, isActive }: VideoPlayerProps): JSX.Element => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoVolume, setVideoVolume] = useState(video.video_volume ?? 1);
  const [audioVolume, setAudioVolume] = useState(video.audio_volume ?? 0.5);
  const [showComments, setShowComments] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isCurrentUserVideo, setIsCurrentUserVideo] = useState(false);
  const [hasMarkedAsViewed, setHasMarkedAsViewed] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(video.comments_count || 0);
  const [audioTrack, setAudioTrack] = useState(video.audio_track || null);
  const [showUseAudioModal, setShowUseAudioModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const { likeVideo, saveVideo, deleteVideo, updateVideo, marcarVideoVisto } = useVideoStore();
  const { followUser, unfollowUser, isFollowing: checkIsFollowing } = useUserStore();
  const navigate = useNavigate();

  // Reset viewed state when video changes
  useEffect(() => {
    setHasMarkedAsViewed(false);
    setLikesCount(video.likes_count || 0);
    setCommentsCount(video.comments_count || 0);
    setAudioTrack(video.audio_track || null);
  }, [video.id, video.likes_count, video.comments_count, video.audio_track]);

  // Fetch audio track if video has audio_track_id but no audio_track data
  useEffect(() => {
    const fetchAudioTrack = async () => {
      if (video.audio_track_id && !video.audio_track) {
        try {
          const { data, error } = await supabase
            .from('audio_tracks')
            .select(`
              *,
              user_profile:profiles!user_id(id, username, avatar_url)
            `)
            .eq('id', video.audio_track_id)
            .single();

          if (error) throw error;
          setAudioTrack(data);
        } catch (error) {
          console.error('Error fetching audio track:', error);
        }
      }
    };

    fetchAudioTrack();
  }, [video.audio_track_id, video.audio_track]);

  // Check if current user is the video owner
  useEffect(() => {
    const checkOwnership = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsCurrentUserVideo(user?.id === video.user_id);
    };
    checkOwnership();
  }, [video.user_id]);

  // Check if user is following the video creator
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (video.user_id) {
        const following = await checkIsFollowing(video.user_id);
        setIsFollowing(following);
      }
    };
    checkFollowStatus();
  }, [video.user_id, checkIsFollowing]);

  // Check if video is liked by current user
  useEffect(() => {
    const checkLikeStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('likes')
        .select()
        .eq('user_id', user.id)
        .eq('content_id', video.id)
        .eq('content_type', 'video')
        .maybeSingle();

      setIsLiked(!!data);
    };
    checkLikeStatus();
  }, [video.id]);

  // Check if video is saved by current user
  useEffect(() => {
    const checkSaveStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('video_saves')
        .select()
        .eq('user_id', user.id)
        .eq('video_id', video.id)
        .maybeSingle();

      setIsSaved(!!data);
    };
    checkSaveStatus();
  }, [video.id]);

  // Manejar la reproducción y detención del video
  useEffect(() => {
    let playTimeout: NodeJS.Timeout;
    let isPlayingPromise: Promise<void> | null = null;

    if (videoRef.current) {
      if (isActive) {
        const playVideo = async () => {
          try {
            // Cancelar cualquier reproducción pendiente
            if (isPlayingPromise) {
              videoRef.current?.pause();
              isPlayingPromise = null;
            }

            // Esperar un momento antes de intentar reproducir
            await new Promise(resolve => {
              playTimeout = setTimeout(resolve, 100);
            });

            // Intentar reproducir
            const playPromise = videoRef.current?.play();
            if (playPromise) {
              isPlayingPromise = playPromise;
              await isPlayingPromise;
            }
            
            setIsPlaying(true);
            setShowPlayButton(false);
            
            // Marcar video como visto
            if (!hasMarkedAsViewed) {
              await marcarVideoVisto(video.id);
              setHasMarkedAsViewed(true);
            }
          } catch (error: any) {
            console.error('Error playing video:', error);
            setIsPlaying(false);
            setShowPlayButton(true);
          } finally {
            isPlayingPromise = null;
          }
        };
        playVideo();
      } else {
        // Solo pausar el video cuando no está activo
        if (isPlayingPromise) {
          videoRef.current?.pause();
          isPlayingPromise = null;
        }
        setIsPlaying(false);
        setShowPlayButton(true);
      }
    }

    // Cleanup function
    return () => {
      clearTimeout(playTimeout);
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };
  }, [isActive, video.id, marcarVideoVisto, setHasMarkedAsViewed, hasMarkedAsViewed, videoRef, setIsPlaying, setShowPlayButton]);

  // Configurar los niveles de volumen iniciales
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = videoVolume;
    }
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
  }, [video.video_volume, video.audio_volume]);

  const togglePlay = async () => {
    if (videoRef.current) {
      try {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
          setShowPlayButton(true);
        } else {
          // Esperar un momento antes de intentar reproducir
          await new Promise(resolve => setTimeout(resolve, 100));
          await videoRef.current.play();
          setIsPlaying(true);
          setShowPlayButton(false);
        }
      } catch (error) {
        console.error('Error toggling play:', error);
        setIsPlaying(false);
        setShowPlayButton(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!isLiked) {
        // Add like
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            content_id: video.id,
            content_type: 'video',
            video_id: video.id
          });

        if (error) {
          // If it's a unique constraint violation, the like already exists
          if (error.code === '23505') {
            console.log('Like already exists');
            return;
          }
          throw error;
        }

        // Update local state immediately with animation
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        
        // Add pulse animation
        const heartElement = e.currentTarget.querySelector('.heart-icon');
        if (heartElement) {
          heartElement.classList.add('pulse-heart');
          setTimeout(() => {
            heartElement.classList.remove('pulse-heart');
          }, 300);
        }
      }
    } catch (error) {
      console.error('Error adding like:', error);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
    await saveVideo(video.id);
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
    setShowOptions(false);
  };

  const confirmDelete = async () => {
    if (typeof video.id === 'string') {
      try {
        await deleteVideo(video.id);
        setShowDeleteModal(false);
        setShowSuccessMessage(true);
        
        // Aumentamos la duración a 3 segundos y añadimos un sonido de éxito
        const audio = new Audio('/success.mp3');
        audio.play().catch(() => {}); // Ignoramos errores si el navegador bloquea el audio
        
        setTimeout(() => {
          setShowSuccessMessage(false);
          navigate('/');
        }, 3000);
      } catch (error) {
        console.error('Error al eliminar el video:', error);
      }
    }
  };

  const handleEdit = () => {
    setShowEditModal(true);
    setShowOptions(false);
  };

  const handleVideoUpdate = async (title: string, description: string | null) => {
    await updateVideo(video.id, title, description);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(video.video_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-${video.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading video:', error);
    }
    setShowOptions(false);
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFollowing) {
      await unfollowUser(video.user_id);
    } else {
      await followUser(video.user_id);
    }
    setIsFollowing(!isFollowing);
  };

  const toggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(!showComments);
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleOptionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOptions(!showOptions);
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: video.title,
        text: video.description || '',
        url: window.location.href
      });
    } catch (error) {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
    setShowOptions(false);
  };

  const handleCommentAdded = () => {
    setCommentsCount(prev => prev + 1);
  };

  const handleUseAudio = () => {
    setShowUseAudioModal(true);
    setShowOptions(false);
  };

  const handleUseAudioConfirm = () => {
    // Navegar a la página de upload con el audio seleccionado
    navigate('/upload', { 
      state: { 
        selectedAudioTrack: audioTrack,
        fromVideo: video.id 
      } 
    });
    setShowUseAudioModal(false);
  };

  const handleAudioClick = () => {
    if (audioTrack) {
      navigate(`/audio/${audioTrack.id}`);
    }
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={video.video_url}
        className="absolute inset-0 w-full h-full object-contain z-10"
        loop
        playsInline
        muted={isMuted}
        onClick={togglePlay}
      />
      
      {/* Audio element oculto */}
      {video.audio_track && video.audio_track.audio_url && (
        <audio
          ref={audioRef}
          src={video.audio_track.audio_url}
          preload="metadata"
        />
      )}
      
      <motion.button
        whileTap={{ scale: 1.1 }}
        className="absolute top-4 left-4 z-30 video-control"
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
      >
        <div className="w-10 h-10 rounded-full bg-gray-800 bg-opacity-70 flex items-center justify-center">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </div>
      </motion.button>

      <div 
        className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer"
        onClick={togglePlay}
      >
        <AnimatePresence>
          {showPlayButton && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="bg-black bg-opacity-50 rounded-full p-4"
            >
              {isPlaying ? (
                <Pause className="w-12 h-12 text-white" />
              ) : (
                <Play className="w-12 h-12 text-white" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* VIP badge for creator */}
      {video.user_profile?.is_vip && (
        <div className="absolute top-4 right-4 z-30 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full px-3 py-1 flex items-center space-x-1">
          <Crown size={16} className="text-yellow-300" />
          <span className="text-xs font-medium">VIP Creator</span>
        </div>
      )}

      {/* Interaction buttons - centered on the right */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center space-y-4">
        <motion.button
          whileTap={{ scale: 1.1 }}
          className="flex flex-col items-center video-control"
          onClick={handleLike}
        >
          <div className={`w-12 h-12 rounded-full bg-gray-800 bg-opacity-70 flex items-center justify-center ${isLiked ? 'text-red-500' : 'text-white'}`}>
            <Heart size={24} fill={isLiked ? "currentColor" : "none"} className="heart-icon" />
          </div>
          <span className="text-xs mt-1">{formatCount(likesCount)}</span>
        </motion.button>
        
        <motion.button
          whileTap={{ scale: 1.1 }}
          className="flex flex-col items-center video-control"
          onClick={toggleComments}
        >
          <div className="w-12 h-12 rounded-full bg-gray-800 bg-opacity-70 flex items-center justify-center">
            <MessageCircle size={24} />
          </div>
          <span className="text-xs mt-1">{formatCount(commentsCount)}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 1.1 }}
          className="flex flex-col items-center video-control"
          onClick={handleSave}
        >
          <div className={`w-12 h-12 rounded-full bg-gray-800 bg-opacity-70 flex items-center justify-center ${isSaved ? 'text-blue-500' : 'text-white'}`}>
            <Bookmark size={24} fill={isSaved ? "currentColor" : "none"} />
          </div>
          <span className="text-xs mt-1">Save</span>
        </motion.button>
        
        <div className="relative">
          <motion.button
            whileTap={{ scale: 1.1 }}
            className="flex flex-col items-center video-control"
            onClick={handleOptionsClick}
          >
            <div className="w-12 h-12 rounded-full bg-gray-800 bg-opacity-70 flex items-center justify-center">
              <MoreVertical size={24} />
            </div>
          </motion.button>

          {/* Audio Disc - TikTok style */}
          {audioTrack && (
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center video-control mt-4"
            >
              <AudioDiscPlayer
                audioTrack={audioTrack}
                isVideoPlaying={isPlaying}
                onDiscClick={handleAudioClick}
                size="md"
              />
            </motion.div>
          )}

          <AnimatePresence>
            {showOptions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute bottom-full right-0 mb-2 w-48 bg-gray-800 rounded-lg shadow-lg overflow-hidden"
              >
                {isCurrentUserVideo && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit();
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center"
                    >
                      <Pencil size={18} className="mr-2" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowOptions(false);
                        handleDelete();
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center text-red-500"
                    >
                      <Trash2 size={18} className="mr-2" />
                      Delete
                    </button>
                  </>
                )}
                {audioTrack && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseAudio();
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center"
                  >
                    <Music size={18} className="mr-2" />
                    Use this audio
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center"
                >
                  <Share2 size={18} className="mr-2" />
                  Share
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center"
                >
                  <Download size={18} className="mr-2" />
                  Download
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Video info section */}
      <div className="absolute bottom-8 left-0 right-16 z-30 px-4">
        <div className="max-w-3xl">
          <div className="flex items-center space-x-3 mb-3">
            <Link 
              to={`/profile/${video.user_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0"
            >
              {video.user_profile?.avatar_url ? (
                <img 
                  src={video.user_profile.avatar_url} 
                  alt={video.user_profile.username}
                  className="w-10 h-10 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <User size={20} />
                </div>
              )}
            </Link>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <Link 
                  to={`/profile/${video.user_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:underline"
                >
                  <span className="text-base font-medium">@{video.user_profile?.username}</span>
                </Link>
                
                {!isCurrentUserVideo && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleFollow}
                    className="ml-2 px-3 py-1 rounded-full bg-gray-800 bg-opacity-70 flex items-center space-x-1 video-control"
                  >
                    {isFollowing ? (
                      <>
                        <Check size={16} className="text-blue-500" />
                        <span className="text-sm">Following</span>
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        <span className="text-sm">Follow</span>
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            </div>
          </div>
          
          <h3 className="text-sm font-medium mb-1">{video.title}</h3>
          
          {video.description && (
            <p className="text-xs text-gray-300 line-clamp-2 mb-2">{video.description}</p>
          )}

          {/* Audio Marquee - TikTok style */}
          {audioTrack && (
            <div className="mt-2">
              <AudioMarquee 
                audioTrack={audioTrack}
                onAudioClick={handleAudioClick}
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed bottom-0 left-0 right-0 h-[70vh] md:h-[70vh] md:w-[400px] md:right-0 md:left-auto md:top-auto bg-black bg-opacity-95 z-40 rounded-t-2xl md:rounded-tl-2xl md:rounded-tr-none"
            onClick={(e) => e.stopPropagation()}
          >
            <CommentSection
              videoId={video.id}
              onClose={() => setShowComments(false)}
              onCommentAdded={handleCommentAdded}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditModal && (
          <EditVideoModal
            video={video}
            onClose={() => setShowEditModal(false)}
            onUpdate={handleVideoUpdate}
          />
        )}
      </AnimatePresence>

      {/* Modal para confirmar uso del audio */}
      <AnimatePresence>
        {showUseAudioModal && audioTrack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowUseAudioModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gray-900 rounded-lg w-full max-w-md p-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Music size={32} className="text-white" />
                </div>
                
                <h3 className="text-xl font-bold mb-2">Use this audio</h3>
                <p className="text-gray-400 mb-4">
                  Create a video with "{audioTrack.title}" by @{audioTrack.user_profile?.username}
                </p>
                
                <div className="bg-gray-800 rounded-lg p-3 mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center">
                      <Music size={20} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{audioTrack.title}</p>
                      <p className="text-sm text-gray-400">{audioTrack.genre}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowUseAudioModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUseAudioConfirm}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Use Audio
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 min-w-[300px]"
          >
            <div className="bg-white/20 p-2 rounded-full">
              <CheckCircle size={24} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-lg">¡Video eliminado!</span>
              <span className="text-sm text-white/80">El video ha sido eliminado exitosamente</span>
            </div>
          </motion.div>
        )}

        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowDeleteModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gray-900 rounded-lg w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                  <AlertTriangle className="text-red-500" size={24} />
                </div>
                <h2 className="text-xl font-semibold mb-2">¿Eliminar video?</h2>
                <p className="text-gray-400">
                  Esta acción no se puede deshacer. El video será eliminado permanentemente.
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 py-2.5"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600"
                  onClick={confirmDelete}
                >
                  Eliminar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideoPlayer;