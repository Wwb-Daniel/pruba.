import React, { useState, useRef, useEffect } from 'react';
import { useVideoStore } from '../../store/videoStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Upload, X, PlayCircle, Music, Volume2, VolumeX } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import AudioTrackSelector from '../audio/AudioTrackSelector';
import AudioUploadForm from '../audio/AudioUploadForm';
import type { AudioTrack } from '../../lib/supabase';
import { motion } from 'framer-motion';

const UploadForm: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null);
  const [showAudioSelector, setShowAudioSelector] = useState(false);
  const [showAudioUpload, setShowAudioUpload] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [videoVolume, setVideoVolume] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadVideo, isUploading, uploadProgress, uploadError, error } = useVideoStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we came from a video with selected audio
  useEffect(() => {
    if (location.state?.selectedAudioTrack) {
      setSelectedAudioTrack(location.state.selectedAudioTrack);
      setShowAudioSelector(false);
    }
  }, [location.state]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setVideoPreview(objectUrl);
      
      // Auto-fill title from filename if empty
      if (!title) {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setTitle(fileName);
      }
    }
  };
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setVideoPreview(objectUrl);
      
      // Auto-fill title from filename if empty
      if (!title) {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setTitle(fileName);
      }
    }
  };
  
  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
      setVideoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !title.trim()) return;
    
    const options = {
      audioTrackId: selectedAudioTrack?.id,
      videoVolume,
      audioVolume
    };
    
    await uploadVideo(selectedFile, title, description, options);
    if (!error) {
      navigate('/');
    }
  };
  
  const handleCancel = () => {
    navigate(-1); // Navega a la página anterior
  };
  
  // Manejar cambios de volumen del video
  const handleVideoVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    setVideoVolume(volume);
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
    setIsVideoMuted(volume === 0);
  };

  // Manejar cambios de volumen del audio
  const handleAudioVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    setAudioVolume(volume);
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    setIsAudioMuted(volume === 0);
  };

  // Alternar mute del video
  const toggleVideoMute = () => {
    if (videoRef.current) {
      const newMuted = !isVideoMuted;
      setIsVideoMuted(newMuted);
      if (newMuted) {
        videoRef.current.volume = 0;
        setVideoVolume(0);
      } else {
        videoRef.current.volume = 1;
        setVideoVolume(1);
      }
    }
  };

  // Alternar mute del audio
  const toggleAudioMute = () => {
    if (audioRef.current) {
      const newMuted = !isAudioMuted;
      setIsAudioMuted(newMuted);
      if (newMuted) {
        audioRef.current.volume = 0;
        setAudioVolume(0);
      } else {
        audioRef.current.volume = 0.5;
        setAudioVolume(0.5);
      }
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Upload a video</h1>
      
      {/* Show audio track info if coming from another video */}
      {location.state?.selectedAudioTrack && (
        <div className="mb-6 p-4 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center">
              <Music size={20} className="text-white" />
            </div>
            <div>
              <p className="font-medium">Using audio: {selectedAudioTrack?.title}</p>
              <p className="text-sm text-gray-400">by @{selectedAudioTrack?.user_profile?.username}</p>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50 bg-opacity-10' : 'border-gray-700'
            }`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg mb-1">Drag and drop your video here</p>
            <p className="text-sm text-gray-500 mb-4">
              Or click to select a file
            </p>
            <Button type="button" variant="outline" size="sm">
              Select Video
            </Button>
          </div>
        ) : (
          <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-6">
            <video
              ref={videoRef}
              src={videoPreview || undefined}
              className="w-full h-64 object-contain"
              controls
              onVolumeChange={(e) => setVideoVolume(e.currentTarget.volume)}
            />
            <button
              type="button"
              onClick={clearSelectedFile}
              className="absolute top-2 right-2 bg-black bg-opacity-70 rounded-full p-1 text-white hover:bg-opacity-90 transition-opacity"
            >
              <X size={20} />
            </button>
            
            {/* Controles de volumen del video */}
            <div className="absolute bottom-16 left-4 flex items-center space-x-2 bg-black bg-opacity-70 rounded-lg p-2">
              <button
                type="button"
                onClick={toggleVideoMute}
                className="text-white hover:text-gray-300"
              >
                {isVideoMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={videoVolume}
                onChange={handleVideoVolumeChange}
                className="w-24 accent-blue-500"
              />
              <span className="text-white text-sm">Video</span>
            </div>
          </div>
        )}
        
        <Input
          label="Title"
          placeholder="Add a title for your video"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          required
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Description
          </label>
          <textarea
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Describe your video (optional)"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Audio Track Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-300">
              Audio Track {selectedAudioTrack ? '✓' : '(Optional)'}
            </label>
            {!location.state?.selectedAudioTrack && (
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAudioUpload(true)}
                >
                  <Music size={16} className="mr-1" />
                  Upload Audio
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAudioSelector(!showAudioSelector)}
                >
                  <Music size={16} className="mr-1" />
                  {showAudioSelector ? 'Hide' : 'Select'} Audio
                </Button>
              </div>
            )}
          </div>

          {showAudioSelector && !location.state?.selectedAudioTrack && (
            <div className="bg-gray-800 rounded-lg p-4">
              <AudioTrackSelector
                onSelect={(track) => {
                  setSelectedAudioTrack(track);
                  if (track) {
                    setShowAudioSelector(false);
                  }
                }}
                selectedAudioTrack={selectedAudioTrack}
              />
            </div>
          )}

          {selectedAudioTrack && (
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center">
                    <Music size={20} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium">{selectedAudioTrack.title}</h4>
                    <p className="text-sm text-gray-400">{selectedAudioTrack.genre}</p>
                    {selectedAudioTrack.user_profile && (
                      <p className="text-xs text-gray-500">by @{selectedAudioTrack.user_profile.username}</p>
                    )}
                  </div>
                </div>
                
                {/* Controles de volumen del audio */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={toggleAudioMute}
                    className="text-white hover:text-gray-300"
                  >
                    {isAudioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={audioVolume}
                    onChange={handleAudioVolumeChange}
                    className="w-24 accent-purple-500"
                  />
                  <span className="text-white text-sm">Audio</span>
                </div>

                {!location.state?.selectedAudioTrack && (
                  <button
                    type="button"
                    onClick={() => setSelectedAudioTrack(null)}
                    className="text-gray-400 hover:text-white ml-4"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
              
              {/* Audio element oculto */}
              <audio
                ref={audioRef}
                src={selectedAudioTrack.audio_url}
                preload="metadata"
                onVolumeChange={(e) => setAudioVolume(e.currentTarget.volume)}
              />
            </div>
          )}
        </div>
        
        {/* Barra de progreso */}
        {isUploading && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Subiendo video</h3>
                <span className="text-blue-400 font-medium">{uploadProgress}%</span>
              </div>
              
              {/* Barra de progreso */}
              <div className="relative w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-6">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>

              {/* Mensaje de estado */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <div className={`w-2 h-2 rounded-full ${uploadProgress >= 10 ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <span>Preparando archivo</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <div className={`w-2 h-2 rounded-full ${uploadProgress >= 30 ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <span>Procesando audio</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <div className={`w-2 h-2 rounded-full ${uploadProgress >= 60 ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <span>Subiendo video</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <div className={`w-2 h-2 rounded-full ${uploadProgress >= 70 ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <span>Generando thumbnail</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <div className={`w-2 h-2 rounded-full ${uploadProgress >= 90 ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <span>Finalizando</span>
                </div>
              </div>

              {/* Error si existe */}
              {uploadError && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg"
                >
                  <p className="font-medium">Error al subir el video</p>
                  <p className="text-sm mt-1">{uploadError}</p>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            className="flex-1 py-2.5"
            onClick={handleCancel}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1 py-2.5"
            disabled={!selectedFile || !title || isUploading}
          >
            {isUploading ? 'Subiendo...' : 'Subir video'}
          </Button>
        </div>

        {/* Mensaje de error general */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
      </form>

      {/* Audio Upload Modal */}
      {showAudioUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Upload Audio Track</h2>
                <button
                  onClick={() => setShowAudioUpload(false)}
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

export default UploadForm;