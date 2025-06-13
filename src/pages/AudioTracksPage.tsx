import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AudioTrack } from '../lib/supabase';
import { Music, Search, Plus, Play, Pause, User, ArrowLeft, X, Video, TrendingUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import AudioUploadForm from '../components/audio/AudioUploadForm';

interface AudioUsage {
  audio_track_id: string;
  count: number;
}

const AudioTracksPage: React.FC = () => {
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  const fetchTrendingTracks = async () => {
    try {
      // Primero obtenemos los IDs de los audios más utilizados
      const { data: usageData, error: usageError } = await supabase
        .rpc('get_audio_track_usage', { limit_count: 6 });

      if (usageError) throw usageError;

      // Si no hay datos de uso, obtenemos los audios más recientes
      if (!usageData || usageData.length === 0) {
        const { data, error: fetchError } = await supabase
          .from('audio_tracks')
          .select(`
            *,
            user_profile:profiles(id, username, avatar_url)
          `)
          .order('created_at', { ascending: false })
          .limit(6);

        if (fetchError) throw fetchError;
        setTrendingTracks(data || []);
        return;
      }

      // Obtenemos los detalles de los audios más utilizados
      const { data: tracksData, error: tracksError } = await supabase
        .from('audio_tracks')
        .select(`
          *,
          user_profile:profiles(id, username, avatar_url)
        `)
        .in('id', (usageData as AudioUsage[]).map(usage => usage.audio_track_id));

      if (tracksError) throw tracksError;

      // Combinamos los datos de uso con los detalles de los audios
      const tracksWithUsage = tracksData?.map(track => ({
        ...track,
        videos: {
          count: (usageData as AudioUsage[]).find(usage => usage.audio_track_id === track.id)?.count || 0
        }
      })) || [];

      // Ordenamos por número de usos
      tracksWithUsage.sort((a, b) => (b.videos?.count || 0) - (a.videos?.count || 0));
      
      setTrendingTracks(tracksWithUsage);
    } catch (error: any) {
      console.error('Error fetching trending tracks:', error);
    }
  };

  const fetchAudioTracks = async (query: string = '') => {
    try {
      setLoading(true);
      setError(null);

      let queryBuilder = supabase
        .from('audio_tracks')
        .select(`
          *,
          user_profile:profiles(id, username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (query) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,genre.ilike.%${query}%,tags.cs.{${query}}`);
      }

      const { data, error: fetchError } = await queryBuilder;

      if (fetchError) throw fetchError;
      setAudioTracks(data || []);
    } catch (error: any) {
      console.error('Error fetching audio tracks:', error);
      setError(error.message || 'Failed to load audio tracks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendingTracks();
    fetchAudioTracks(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    // Cargar las duraciones de los audios
    audioTracks.forEach(track => {
      if (!audioDurations[track.id]) {
        const audio = new Audio(track.audio_url);
        audio.addEventListener('loadedmetadata', () => {
          setAudioDurations(prev => ({
            ...prev,
            [track.id]: audio.duration
          }));
        });
      }
    });
  }, [audioTracks]);

  // Agregar efecto de limpieza para detener el audio cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
        setPlayingTrack(null);
      }
    };
  }, [currentAudio]);

  const handlePlay = (track: AudioTrack) => {
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    if (playingTrack === track.id) {
      // Stop playing if same track
      setPlayingTrack(null);
      setCurrentAudio(null);
    } else {
      // Play new track
      const audio = new Audio(track.audio_url);
      audio.play();
      setPlayingTrack(track.id);
      setCurrentAudio(audio);

      // Handle audio end
      audio.addEventListener('ended', () => {
        setPlayingTrack(null);
        setCurrentAudio(null);
      });
    }
  };

  const handleUseAudio = (track: AudioTrack) => {
    // Navegar a la página de upload con el audio seleccionado
    navigate('/upload', { 
      state: { 
        selectedAudioTrack: track,
        fromAudioLibrary: true 
      } 
    });
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 bg-black bg-opacity-90 backdrop-blur-sm z-40 p-4 border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-semibold">Audio Library</h1>
          </div>
          <Button onClick={() => setShowUploadForm(true)}>
            <Plus className="h-5 w-5 mr-2" />
            Upload Audio
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audio tracks..."
            className="pl-10"
          />
        </div>

        {/* Trending Section */}
        {!searchQuery && trendingTracks.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="h-5 w-5 text-pink-500" />
              <h2 className="text-lg font-semibold">Trending Now</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingTracks.map((track) => {
                const usageCount = track.videos?.count ?? 0;
                return (
                  <div
                    key={track.id}
                    className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-lg p-4 hover:bg-pink-500/20 transition-colors"
                  >
                    <div className="flex items-start space-x-4">
                      <button
                        onClick={() => handlePlay(track)}
                        className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center hover:from-pink-600 hover:to-purple-600 transition-colors"
                      >
                        {playingTrack === track.id ? (
                          <Pause className="h-6 w-6 text-white" />
                        ) : (
                          <Play className="h-6 w-6 text-white ml-0.5" />
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium truncate text-lg">{track.title}</h3>
                          <div className="flex items-center space-x-2">
                            {usageCount > 0 && (
                              <span className="text-xs bg-pink-500/20 text-pink-500 px-2 py-1 rounded-full">
                                {usageCount} uses
                              </span>
                            )}
                            {audioDurations[track.id] && (
                              <span className="text-sm text-gray-400">
                                {formatDuration(audioDurations[track.id])}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">{track.genre}</p>
                        
                        {/* Tags */}
                        {track.tags && track.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {track.tags.slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="text-xs bg-gray-700 px-2 py-1 rounded-full text-gray-300"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Creator info */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {track.user_profile?.avatar_url ? (
                              <img
                                src={track.user_profile.avatar_url}
                                alt={track.user_profile.username}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center">
                                <User size={12} />
                              </div>
                            )}
                            <span className="text-xs text-gray-500">
                              @{track.user_profile?.username}
                            </span>
                          </div>
                          
                          {/* Use Audio Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUseAudio(track)}
                            className="text-xs px-2 py-1"
                          >
                            <Video size={12} className="mr-1" />
                            Use
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Playing indicator */}
                    {playingTrack === track.id && (
                      <div className="mt-3 flex items-center space-x-2">
                        <div className="flex space-x-1">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="w-1 bg-blue-500 rounded-full animate-pulse"
                              style={{
                                height: Math.random() * 20 + 10,
                                animationDelay: `${i * 0.1}s`
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-blue-500">Playing...</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All Tracks Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            {searchQuery ? 'Search Results' : 'All Tracks'}
          </h2>

          {error && (
            <div className="text-red-500 text-center mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full"></div>
            </div>
          ) : audioTracks.length === 0 ? (
            <div className="text-center py-12">
              <Music size={64} className="mx-auto text-gray-600 mb-4" />
              <h3 className="text-xl font-medium mb-2">
                {searchQuery ? 'No audio tracks found' : 'No audio tracks yet'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery 
                  ? 'Try a different search term' 
                  : 'Upload your first audio track to get started'
                }
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowUploadForm(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Upload Audio Track
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {audioTracks.map((track) => (
                <div
                  key={track.id}
                  className="bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start space-x-4">
                    <button
                      onClick={() => handlePlay(track)}
                      className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center hover:from-pink-600 hover:to-purple-600 transition-colors"
                    >
                      {playingTrack === track.id ? (
                        <Pause className="h-6 w-6 text-white" />
                      ) : (
                        <Play className="h-6 w-6 text-white ml-0.5" />
                      )}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium truncate text-lg">{track.title}</h3>
                        {audioDurations[track.id] && (
                          <span className="text-sm text-gray-400 ml-2">
                            {formatDuration(audioDurations[track.id])}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{track.genre}</p>
                      
                      {/* Tags */}
                      {track.tags && track.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {track.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="text-xs bg-gray-700 px-2 py-1 rounded-full text-gray-300"
                            >
                              #{tag}
                            </span>
                          ))}
                          {track.tags.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{track.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Creator info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {track.user_profile?.avatar_url ? (
                            <img
                              src={track.user_profile.avatar_url}
                              alt={track.user_profile.username}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center">
                              <User size={12} />
                            </div>
                          )}
                          <span className="text-xs text-gray-500">
                            @{track.user_profile?.username}
                          </span>
                        </div>
                        
                        {/* Use Audio Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUseAudio(track)}
                          className="text-xs px-2 py-1"
                        >
                          <Video size={12} className="mr-1" />
                          Use
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Playing indicator */}
                  {playingTrack === track.id && (
                    <div className="mt-3 flex items-center space-x-2">
                      <div className="flex space-x-1">
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-blue-500 rounded-full animate-pulse"
                            style={{
                              height: Math.random() * 20 + 10,
                              animationDelay: `${i * 0.1}s`
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-blue-500">Playing...</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Upload Audio Track</h2>
                <button
                  onClick={() => setShowUploadForm(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <AudioUploadForm />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioTracksPage;