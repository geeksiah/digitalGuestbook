'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { publicApi, guestbookApi } from '@/lib/api';
import { formatDuration, getDeviceId, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type ViewState = 'welcome' | 'menu' | 'video' | 'audio' | 'photo' | 'success';
type RecordingState = 'idle' | 'ready' | 'recording' | 'preview' | 'uploading';
type PermissionState = 'checking' | 'granted' | 'denied';

const AUTO_RESET_SECONDS = 8;

export default function BoothPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#e0e7ff');

  // UI state
  const [viewState, setViewState] = useState<ViewState>('welcome');
  const [guestName, setGuestName] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [resetCountdown, setResetCountdown] = useState(AUTO_RESET_SECONDS);

  // Photo upload state
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(-1);

  // Audio visualization state
  const [audioWaveform, setAudioWaveform] = useState<number[]>(new Array(50).fill(0));

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize
  useEffect(() => {
    fetchEventInfo();
    
    // Prevent context menu on kiosk
    const preventContextMenu = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', preventContextMenu);
    
    // Prevent keyboard shortcuts
    const preventKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || e.key === 'Escape') {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', preventKeyboard);

    return () => {
      cleanup();
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventKeyboard);
    };
  }, [slug]);

  // Auto-reset countdown when on success screen
  useEffect(() => {
    if (viewState === 'success') {
      setResetCountdown(AUTO_RESET_SECONDS);
      resetTimerRef.current = setInterval(() => {
        setResetCountdown(prev => {
          if (prev <= 1) {
            resetToWelcome();
            return AUTO_RESET_SECONDS;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (resetTimerRef.current) {
        clearInterval(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    }

    return () => {
      if (resetTimerRef.current) {
        clearInterval(resetTimerRef.current);
      }
    };
  }, [viewState]);

  const cleanup = useCallback(() => {
    stopStream();
    if (timerRef.current) clearInterval(timerRef.current);
    if (resetTimerRef.current) clearInterval(resetTimerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
  }, [photoPreviewUrls]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const resetToWelcome = () => {
    cleanup();
    setViewState('welcome');
    setGuestName('');
    setRecordingState('idle');
    setPermissionState('checking');
    setSelectedPhotos([]);
    setPhotoPreviewUrls([]);
    setUploadProgress([]);
    setCurrentUploadIndex(-1);
    recordedBlobRef.current = null;
    chunksRef.current = [];
    setRecordingTime(0);
    setAudioWaveform(new Array(50).fill(0));
  };

  // API calls
  const fetchEventInfo = async () => {
    try {
      const eventRes = await publicApi.getEvent(slug);
      const event = eventRes.data.event;

      if (!event.capabilities.canAccessGuestbook) {
        setError('Booth is not available at this time');
        setLoading(false);
        return;
      }

      setEventName(event.name);
      setEventId(event.id);

      // Fetch booth config
      const configRes = await guestbookApi.getBoothConfig(event.id);
      const boothConfig = configRes.data.booth;
      setConfig(boothConfig);
      
      // Set event colors for theming
      if (boothConfig.primaryColor) setPrimaryColor(boothConfig.primaryColor);
      if (boothConfig.secondaryColor) setSecondaryColor(boothConfig.secondaryColor);
      
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load booth');
      setLoading(false);
    }
  };

  // Permission handling
  const requestMediaPermission = async (type: 'video' | 'audio'): Promise<boolean> => {
    setPermissionState('checking');

    try {
      const constraints = type === 'video'
        ? { 
            video: { 
              facingMode: 'user',
              width: { min: 1280, ideal: 1920, max: 3840 },
              height: { min: 720, ideal: 1080, max: 2160 },
              frameRate: { min: 24, ideal: 30, max: 60 },
              aspectRatio: { ideal: 16/9 }
            }, 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100
            }
          }
        : { 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100
            }
          };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setPermissionState('granted');
      return true;
    } catch (err: any) {
      console.error('Permission error:', err);
      // Fallback to lower quality if HD not available
      if (type === 'video') {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
          });
          streamRef.current = fallbackStream;
          setPermissionState('granted');
          return true;
        } catch {
          setPermissionState('denied');
          return false;
        }
      }
      setPermissionState('denied');
      return false;
    }
  };

  // ==================== VIDEO FUNCTIONS ====================
  const initializeVideo = async () => {
    setViewState('video');
    setRecordingState('idle');
    recordedBlobRef.current = null;

    const hasPermission = await requestMediaPermission('video');
    if (hasPermission && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
      setRecordingState('ready');
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;

    // Use VP9 for better quality, fallback to VP8
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';
    
    // High quality video bitrate (8 Mbps for HD)
    const mediaRecorder = new MediaRecorder(streamRef.current, { 
      mimeType,
      videoBitsPerSecond: 8000000, // 8 Mbps for HD quality
      audioBitsPerSecond: 128000   // 128 kbps for audio
    });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      recordedBlobRef.current = new Blob(chunksRef.current, { type: 'video/webm' });
      if (previewVideoRef.current) {
        previewVideoRef.current.src = URL.createObjectURL(recordedBlobRef.current);
      }
      setRecordingState('preview');
    };

    mediaRecorder.start(1000);
    setRecordingState('recording');
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const newTime = prev + 1;
        if (config && newTime >= config.maxRecordingDuration) {
          stopVideoRecording();
        }
        return newTime;
      });
    }, 1000);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopStream();
    }
  };

  // ==================== AUDIO FUNCTIONS ====================
  const initializeAudio = async () => {
    setViewState('audio');
    setRecordingState('idle');
    recordedBlobRef.current = null;
    setAudioWaveform(new Array(50).fill(0));

    const hasPermission = await requestMediaPermission('audio');
    if (hasPermission && streamRef.current) {
      setupAudioVisualization(streamRef.current);
      setRecordingState('ready');
    }
  };

  const setupAudioVisualization = (stream: MediaStream) => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      analyserRef.current.smoothingTimeConstant = 0.8;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateVisualization = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        const bars = 50;
        const step = Math.floor(dataArray.length / bars);
        const waveformData = [];
        for (let i = 0; i < bars; i++) {
          const value = dataArray[i * step] / 255;
          waveformData.push(value);
        }
        setAudioWaveform(waveformData);

        animationRef.current = requestAnimationFrame(updateVisualization);
      };

      updateVisualization();
    } catch (err) {
      console.error('Audio visualization error:', err);
    }
  };

  const startAudioRecording = () => {
    if (!streamRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    
    // High quality audio (192 kbps)
    const mediaRecorder = new MediaRecorder(streamRef.current, { 
      mimeType,
      audioBitsPerSecond: 192000 // 192 kbps for high quality audio
    });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      recordedBlobRef.current = new Blob(chunksRef.current, { type: 'audio/webm' });
      setRecordingState('preview');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };

    mediaRecorder.start(1000);
    setRecordingState('recording');
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const newTime = prev + 1;
        if (config && newTime >= config.maxRecordingDuration) {
          stopAudioRecording();
        }
        return newTime;
      });
    }, 1000);
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopStream();
    }
  };

  // ==================== PHOTO FUNCTIONS ====================
  const initializePhoto = () => {
    setViewState('photo');
    setRecordingState('idle');
    setSelectedPhotos([]);
    setPhotoPreviewUrls([]);
    setUploadProgress([]);
    setCurrentUploadIndex(-1);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Booth mode allows unlimited photos (or a high limit)
    const maxPhotos = 20;
    const remainingSlots = maxPhotos - selectedPhotos.length;
    const newFiles = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast.error(`Maximum ${maxPhotos} photos per session`);
    }

    const newUrls = newFiles.map(file => URL.createObjectURL(file));

    setSelectedPhotos(prev => [...prev, ...newFiles]);
    setPhotoPreviewUrls(prev => [...prev, ...newUrls]);
    setUploadProgress(prev => [...prev, ...new Array(newFiles.length).fill(0)]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setUploadProgress(prev => prev.filter((_, i) => i !== index));
  };

  // ==================== UPLOAD FUNCTIONS ====================
  const uploadMedia = async (type: 'VIDEO' | 'AUDIO') => {
    if (!recordedBlobRef.current || !config) return;

    setRecordingState('uploading');

    try {
      const ext = type === 'VIDEO' ? 'webm' : 'webm';
      const file = new File([recordedBlobRef.current], `booth-recording.${ext}`, {
        type: type === 'VIDEO' ? 'video/webm' : 'audio/webm'
      });

      const formData = new FormData();
      formData.append('media', file);
      formData.append('type', type);
      formData.append('guestName', guestName || 'Booth Guest');
      formData.append('captureMode', 'BOOTH');
      formData.append('deviceId', getDeviceId());
      formData.append('duration', recordingTime.toString());

      await guestbookApi.boothUpload(config.eventId, formData);
      setViewState('success');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed. Please try again.');
      setRecordingState('preview');
    }
  };

  const uploadPhotos = async () => {
    if (selectedPhotos.length === 0 || !config) return;

    setRecordingState('uploading');
    const newProgress = [...uploadProgress];

    for (let i = 0; i < selectedPhotos.length; i++) {
      setCurrentUploadIndex(i);
      try {
        const formData = new FormData();
        formData.append('media', selectedPhotos[i]);
        formData.append('type', 'PHOTO');
        formData.append('guestName', guestName || 'Booth Guest');
        formData.append('captureMode', 'BOOTH');
        formData.append('deviceId', getDeviceId());

        await guestbookApi.boothUpload(config.eventId, formData);

        newProgress[i] = 100;
        setUploadProgress([...newProgress]);
      } catch (err: any) {
        newProgress[i] = -1;
        setUploadProgress([...newProgress]);
      }
    }

    setCurrentUploadIndex(-1);
    const successCount = newProgress.filter(p => p === 100).length;
    if (successCount > 0) {
      setTimeout(() => setViewState('success'), 500);
    } else {
      toast.error('Upload failed. Please try again.');
      setRecordingState('idle');
    }
  };

  // ==================== NAVIGATION ====================
  const retake = async () => {
    recordedBlobRef.current = null;
    chunksRef.current = [];
    setRecordingTime(0);

    if (viewState === 'video') {
      await initializeVideo();
    } else if (viewState === 'audio') {
      await initializeAudio();
    }
  };

  const startNewSession = () => {
    setViewState('menu');
    setGuestName('');
  };

  // ==================== RENDER STATES ====================

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
          <p className="text-white/70 text-xl">Loading Booth...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="text-center max-w-lg">
          <div className="w-24 h-24 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">{error}</h1>
          <p className="text-white/60 text-lg">Please contact an event staff member for assistance.</p>
        </div>
      </div>
    );
  }

  // Permission denied
  if (permissionState === 'denied' && (viewState === 'video' || viewState === 'audio')) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="text-center max-w-lg">
          <div className="w-24 h-24 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Camera Access Required</h2>
          <p className="text-white/60 text-lg mb-8">
            Please allow camera and microphone access to record your message.
          </p>
          <button
            onClick={resetToWelcome}
            className="px-12 py-4 bg-white text-slate-900 rounded-full text-xl font-bold hover:bg-white/90 transition-all active:scale-95"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  // WELCOME SCREEN
  if (viewState === 'welcome') {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center p-8 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${primaryColor}22 0%, #1a1a2e 50%, ${secondaryColor}22 100%)` }}
      >
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full blur-3xl animate-pulse" 
            style={{ background: `radial-gradient(circle, ${primaryColor}40 0%, transparent 70%)` }}
          />
          <div 
            className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full blur-3xl animate-pulse" 
            style={{ background: `radial-gradient(circle, ${secondaryColor}40 0%, transparent 70%)`, animationDelay: '1s' }}
          />
        </div>

        <div className="relative text-center max-w-2xl">
          {/* Event name */}
          <div className="mb-8">
            <p className="text-xl uppercase tracking-widest mb-2" style={{ color: primaryColor }}>Digital Guestbook</p>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">{eventName}</h1>
          </div>

          {/* Call to action */}
          <div className="mb-12">
            <p className="text-white/70 text-2xl md:text-3xl">Tap below to leave a special message</p>
          </div>

          {/* Start button */}
          <button
            onClick={startNewSession}
            className="group relative px-16 py-6 bg-white text-slate-900 rounded-full text-2xl font-bold hover:bg-white/90 transition-all active:scale-95 shadow-2xl"
            style={{ boxShadow: `0 25px 50px -12px ${primaryColor}40` }}
          >
            <span className="relative z-10 flex items-center gap-3">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Recording
            </span>
            <div 
              className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-xl" 
              style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }}
            />
          </button>

          {/* Decorative icons */}
          <div className="absolute -left-20 top-1/2 -translate-y-1/2 opacity-20">
            <svg className="w-40 h-40 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="absolute -right-20 top-1/2 -translate-y-1/2 opacity-20">
            <svg className="w-40 h-40 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // SUCCESS SCREEN
  if (viewState === 'success') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-8">
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/30 rounded-full animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        <div className="relative text-center max-w-lg">
          {/* Success icon */}
          <div className="w-32 h-32 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-8 animate-in zoom-in duration-500">
            <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Thank You!</h1>
          <p className="text-white/80 text-2xl mb-12">Your message has been saved</p>

          {/* Auto-reset countdown */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-8">
            <p className="text-white/70 text-lg mb-2">Screen will reset in</p>
            <div className="text-6xl font-bold text-white font-mono">{resetCountdown}</div>
            <p className="text-white/50 text-sm mt-2">seconds</p>
          </div>

          {/* Manual reset button */}
          <button
            onClick={resetToWelcome}
            className="px-12 py-4 bg-white text-emerald-900 rounded-full text-xl font-bold hover:bg-white/90 transition-all active:scale-95"
          >
            Record Another Message
          </button>
        </div>
      </div>
    );
  }

  // MENU SCREEN
  if (viewState === 'menu') {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center p-8"
        style={{ background: `linear-gradient(135deg, ${primaryColor}22 0%, #1a1a2e 50%, ${secondaryColor}22 100%)` }}
      >
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <p className="text-lg uppercase tracking-widest mb-2" style={{ color: primaryColor }}>{eventName}</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Choose Your Message Type</h1>
          </div>

          {/* Name input */}
          <div className="max-w-md mx-auto mb-12">
            <label className="block text-white/70 text-lg mb-3 text-center">Your Name (optional)</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-2xl text-white text-xl text-center placeholder:text-white/40 focus:outline-none focus:border-purple-400 transition-colors"
            />
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Video */}
            <button
              onClick={initializeVideo}
              className="group p-8 bg-white/5 hover:bg-red-500/20 border-2 border-white/10 hover:border-red-400 rounded-3xl transition-all active:scale-95"
            >
              <div className="w-24 h-24 mx-auto rounded-2xl bg-red-500/20 group-hover:bg-red-500/40 flex items-center justify-center mb-6 transition-colors">
                <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Video Message</h3>
              <p className="text-white/60">Record up to {config?.maxRecordingDuration || 120}s</p>
            </button>

            {/* Audio */}
            <button
              onClick={initializeAudio}
              className="group p-8 bg-white/5 hover:bg-purple-500/20 border-2 border-white/10 hover:border-purple-400 rounded-3xl transition-all active:scale-95"
            >
              <div className="w-24 h-24 mx-auto rounded-2xl bg-purple-500/20 group-hover:bg-purple-500/40 flex items-center justify-center mb-6 transition-colors">
                <svg className="w-12 h-12 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Audio Message</h3>
              <p className="text-white/60">Record up to {config?.maxRecordingDuration || 120}s</p>
            </button>

            {/* Photo */}
            <button
              onClick={initializePhoto}
              className="group p-8 bg-white/5 hover:bg-green-500/20 border-2 border-white/10 hover:border-green-400 rounded-3xl transition-all active:scale-95"
            >
              <div className="w-24 h-24 mx-auto rounded-2xl bg-green-500/20 group-hover:bg-green-500/40 flex items-center justify-center mb-6 transition-colors">
                <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Upload Photos</h3>
              <p className="text-white/60">Share your favorite moments</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIDEO RECORDING SCREEN
  if (viewState === 'video') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Video preview */}
        <div className="flex-1 relative">
          {recordingState !== 'preview' ? (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
          ) : (
            <video
              ref={previewVideoRef}
              className="absolute inset-0 w-full h-full object-cover"
              controls
              playsInline
            />
          )}

          {/* Recording indicator */}
          {recordingState === 'recording' && (
            <div className="absolute top-8 left-8 flex items-center gap-3 bg-red-600 text-white px-6 py-3 rounded-full animate-pulse">
              <span className="w-4 h-4 rounded-full bg-white animate-pulse" />
              <span className="text-xl font-bold">REC</span>
            </div>
          )}

          {/* Loading overlay */}
          {(recordingState === 'idle' || permissionState === 'checking') && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white text-xl">Accessing camera...</p>
              </div>
            </div>
          )}

          {/* Timer overlay */}
          <div className="absolute top-8 right-8 bg-black/50 backdrop-blur px-6 py-3 rounded-full">
            <span className="text-4xl font-mono font-bold text-white">{formatDuration(recordingTime)}</span>
            <span className="text-white/60 text-xl ml-2">/ {formatDuration(config?.maxRecordingDuration || 120)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-black/90 backdrop-blur p-8">
          <div className="flex justify-center items-center gap-8">
            {recordingState === 'ready' && (
              <button
                onClick={startVideoRecording}
                className="w-28 h-28 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xl"
              >
                <div className="w-12 h-12 rounded-full bg-white" />
              </button>
            )}

            {recordingState === 'recording' && (
              <button
                onClick={stopVideoRecording}
                className="w-28 h-28 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all active:scale-95 shadow-2xl animate-pulse"
              >
                <div className="w-12 h-12 rounded bg-white" />
              </button>
            )}

            {recordingState === 'preview' && (
              <>
                <button onClick={retake} className="px-10 py-5 bg-white/10 text-white rounded-full text-xl font-bold hover:bg-white/20 transition-all active:scale-95">
                  Retake
                </button>
                <button onClick={() => uploadMedia('VIDEO')} className="px-14 py-5 bg-green-600 text-white rounded-full text-xl font-bold hover:bg-green-700 transition-all active:scale-95">
                  Submit
                </button>
              </>
            )}

            {recordingState === 'uploading' && (
              <div className="flex items-center gap-4 text-white text-xl">
                <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="font-medium">Uploading your video...</span>
              </div>
            )}
          </div>

          {recordingState === 'ready' && (
            <p className="text-center text-white/60 text-lg mt-6">Tap the button to start recording</p>
          )}
        </div>
      </div>
    );
  }

  // AUDIO RECORDING SCREEN
  if (viewState === 'audio') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-slate-900 to-purple-900 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white mb-8">Audio Message</h2>

          {/* Waveform visualizer */}
          <div className="bg-black/30 backdrop-blur rounded-3xl p-8 mb-8">
            <div className="flex items-end justify-center gap-1 h-40">
              {audioWaveform.map((value, index) => (
                <div
                  key={index}
                  className={cn(
                    'w-2 rounded-full transition-all duration-75',
                    recordingState === 'recording' ? 'bg-purple-400' : 'bg-white/30'
                  )}
                  style={{ height: `${Math.max(8, value * 100)}%` }}
                />
              ))}
            </div>
          </div>

          {/* Timer */}
          <div className="mb-8">
            <span className="text-6xl font-mono font-bold text-white">{formatDuration(recordingTime)}</span>
            <span className="text-white/60 text-2xl ml-3">/ {formatDuration(config?.maxRecordingDuration || 120)}</span>
          </div>

          {/* Controls */}
          <div className="flex justify-center items-center gap-8">
            {(recordingState === 'idle' || permissionState === 'checking') && (
              <div className="flex items-center gap-4 text-white/60 text-xl">
                <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Accessing microphone...</span>
              </div>
            )}

            {recordingState === 'ready' && (
              <button
                onClick={startAudioRecording}
                className="w-28 h-28 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xl"
              >
                <div className="w-12 h-12 rounded-full bg-white" />
              </button>
            )}

            {recordingState === 'recording' && (
              <button
                onClick={stopAudioRecording}
                className="w-28 h-28 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center transition-all active:scale-95 shadow-2xl animate-pulse"
              >
                <div className="w-12 h-12 rounded bg-white" />
              </button>
            )}

            {recordingState === 'preview' && (
              <>
                <button onClick={retake} className="px-10 py-5 bg-white/10 text-white rounded-full text-xl font-bold hover:bg-white/20 transition-all active:scale-95">
                  Retake
                </button>
                <button onClick={() => uploadMedia('AUDIO')} className="px-14 py-5 bg-green-600 text-white rounded-full text-xl font-bold hover:bg-green-700 transition-all active:scale-95">
                  Submit
                </button>
              </>
            )}

            {recordingState === 'uploading' && (
              <div className="flex items-center gap-4 text-white text-xl">
                <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="font-medium">Uploading your audio...</span>
              </div>
            )}
          </div>

          {recordingState === 'ready' && (
            <p className="text-white/60 text-lg mt-6">Tap the button to start recording</p>
          )}
        </div>
      </div>
    );
  }

  // PHOTO UPLOAD SCREEN
  if (viewState === 'photo') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-green-900 via-slate-900 to-green-900 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Upload Photos</h2>
            <p className="text-white/60 text-xl">{selectedPhotos.length} photo(s) selected</p>
          </div>

          {/* Photo grid */}
          {selectedPhotos.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4 mb-8">
              {photoPreviewUrls.map((url, index) => (
                <div key={index} className="relative aspect-square rounded-2xl overflow-hidden bg-black/30">
                  <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />

                  {/* Upload progress overlay */}
                  {recordingState === 'uploading' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      {uploadProgress[index] === 100 ? (
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : uploadProgress[index] === -1 ? (
                        <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      ) : currentUploadIndex === index ? (
                        <svg className="animate-spin h-10 w-10 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : null}
                    </div>
                  )}

                  {/* Remove button */}
                  {recordingState !== 'uploading' && (
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              {/* Add more button */}
              {recordingState !== 'uploading' && selectedPhotos.length < 20 && (
                <label className="aspect-square rounded-2xl border-2 border-dashed border-white/30 hover:border-green-400 cursor-pointer flex flex-col items-center justify-center transition-colors bg-white/5 hover:bg-green-500/10">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  <svg className="w-12 h-12 text-white/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-white/50">Add More</span>
                </label>
              )}
            </div>
          )}

          {/* Empty state */}
          {selectedPhotos.length === 0 && (
            <label className="block border-2 border-dashed border-white/30 hover:border-green-400 rounded-3xl p-16 text-center cursor-pointer transition-colors bg-white/5 hover:bg-green-500/10 mb-8">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <div className="w-24 h-24 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-white mb-2">Tap to Select Photos</p>
              <p className="text-white/60 text-lg">or drag and drop your images</p>
            </label>
          )}

          {/* Upload button */}
          {selectedPhotos.length > 0 && (
            <div className="flex justify-center gap-6">
              {recordingState !== 'uploading' && (
                <button
                  onClick={resetToWelcome}
                  className="px-10 py-5 bg-white/10 text-white rounded-full text-xl font-bold hover:bg-white/20 transition-all active:scale-95"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={uploadPhotos}
                disabled={recordingState === 'uploading'}
                className="px-14 py-5 bg-green-600 text-white rounded-full text-xl font-bold hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {recordingState === 'uploading' ? (
                  <span className="flex items-center gap-3">
                    <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading {currentUploadIndex + 1} / {selectedPhotos.length}
                  </span>
                ) : (
                  `Upload ${selectedPhotos.length} Photo${selectedPhotos.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

