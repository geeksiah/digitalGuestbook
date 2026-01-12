'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { publicApi, guestbookApi } from '@/lib/api';
import { formatDuration, getDeviceId, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type ViewState = 'welcome' | 'menu' | 'video' | 'audio' | 'photo' | 'photo-preview' | 'download-qr' | 'success';
type RecordingState = 'idle' | 'countdown' | 'ready' | 'recording' | 'preview' | 'uploading';
type PermissionState = 'checking' | 'granted' | 'denied';

const AUTO_RESET_SECONDS = 10;
const SHUTTER_COUNTDOWN = 3;

interface TemplateData {
  id: string;
  name: string;
  htmlContent: string;
  cssContent?: string;
  jsContent?: string;
}

interface BoothConfig {
  eventId: string;
  eventName: string;
  maxRecordingDuration: number;
  minRecordingDuration: number;
  maxPhotosPerSession: number;
  shutterCountdown: number;
  primaryColor: string;
  secondaryColor: string;
  template?: TemplateData | null;        // Main booth template
  videoTemplate?: TemplateData | null;   // Video recording page
  audioTemplate?: TemplateData | null;   // Audio recording page
  photoTemplate?: TemplateData | null;   // Photo capture page
}

export default function BoothPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [config, setConfig] = useState<BoothConfig | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#e0e7ff');

  // UI state
  const [viewState, setViewState] = useState<ViewState>('welcome');
  const [guestName, setGuestName] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [resetCountdown, setResetCountdown] = useState(AUTO_RESET_SECONDS);

  // Photo capture state
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]); // base64 data URLs
  const [capturedBlobs, setCapturedBlobs] = useState<Blob[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(-1);
  const [shutterCountdown, setShutterCountdown] = useState(0);
  const [flashActive, setFlashActive] = useState(false);
  // Download QR code for session (all photos)
  const [sessionQRCode, setSessionQRCode] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Audio visualization state
  const [audioWaveform, setAudioWaveform] = useState<number[]>(new Array(50).fill(0));

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

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
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventKeyboard);
      cleanup();
    };
  }, []);

  // Auto-reset after success
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
    }
    return () => {
      if (resetTimerRef.current) {
        clearInterval(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [viewState]);

  // Cleanup function
  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (resetTimerRef.current) clearInterval(resetTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    stopStream();
    
    // Clean up photo URLs
    capturedPhotos.forEach(url => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  };

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
    setCapturedPhotos([]);
    setCapturedBlobs([]);
    setUploadProgress([]);
    setCurrentUploadIndex(-1);
    setShutterCountdown(0);
    setSessionQRCode(null);
    setSessionStartTime(null);
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
  const requestMediaPermission = async (type: 'video' | 'audio' | 'photo'): Promise<boolean> => {
    setPermissionState('checking');

    try {
      const constraints = type === 'video' || type === 'photo'
        ? { 
            video: { 
              facingMode: 'user',
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              frameRate: { ideal: 30 }
            }, 
            audio: type === 'video' 
          }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setPermissionState('granted');
      return true;
    } catch (err) {
      console.error('Permission error:', err);
      setPermissionState('denied');
      return false;
    }
  };

  // ==================== VIDEO FUNCTIONS ====================
  const initializeVideo = async () => {
    setViewState('video');
    setRecordingState('idle');
    
    const granted = await requestMediaPermission('video');
    if (!granted) return;

    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
      setRecordingState('ready');
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setRecordingTime(0);
    setRecordingState('recording');

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp9',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      recordedBlobRef.current = blob;
      
      if (previewVideoRef.current) {
        previewVideoRef.current.src = URL.createObjectURL(blob);
      }
      
      stopStream();
      setRecordingState('preview');
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);

    const maxDuration = config?.maxRecordingDuration || 120;
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const newTime = prev + 1;
        if (newTime >= maxDuration) {
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
    }
  };

  // ==================== AUDIO FUNCTIONS ====================
  const initializeAudio = async () => {
    setViewState('audio');
    setRecordingState('idle');
    
    const granted = await requestMediaPermission('audio');
    if (!granted) return;

    // Set up audio visualization
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 128;
    
    if (streamRef.current) {
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      source.connect(analyserRef.current);
    }

    setRecordingState('ready');
    visualizeAudio();
  };

  const visualizeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const update = () => {
      analyserRef.current?.getByteFrequencyData(dataArray);
      const normalized = Array.from(dataArray.slice(0, 50)).map(v => v / 255);
      setAudioWaveform(normalized);
      animationRef.current = requestAnimationFrame(update);
    };
    
    update();
  };

  const startAudioRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setRecordingTime(0);
    setRecordingState('recording');

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'audio/webm',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      recordedBlobRef.current = blob;
      stopStream();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setRecordingState('preview');
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);

    const maxDuration = config?.maxRecordingDuration || 120;
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const newTime = prev + 1;
        if (newTime >= maxDuration) {
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
  const initializePhoto = async () => {
    setViewState('photo');
    setRecordingState('idle');
    setCapturedPhotos([]);
    setCapturedBlobs([]);
    setUploadProgress([]);
    setCurrentUploadIndex(-1);
    setSessionStartTime(new Date()); // Track session start time
    
    const granted = await requestMediaPermission('photo');
    if (!granted) return;

    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
      setRecordingState('ready');
    }
  };

  const startShutterCountdown = () => {
    setShutterCountdown(SHUTTER_COUNTDOWN);
    setRecordingState('countdown');
    
    countdownTimerRef.current = setInterval(() => {
      setShutterCountdown(prev => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          capturePhoto();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setShutterCountdown(0);
    setRecordingState('ready');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !photoCanvasRef.current) return;

    const video = videoRef.current;
    const canvas = photoCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Set canvas to high resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw image directly (no mirroring - cameras handle their own orientation)
    ctx.drawImage(video, 0, 0);

    // Flash effect
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);

    // Get high quality image
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          setCapturedPhotos(prev => [...prev, dataUrl]);
          setCapturedBlobs(prev => [...prev, blob]);
          setUploadProgress(prev => [...prev, 0]);
          setRecordingState('ready');
        }
      },
      'image/jpeg',
      0.95
    );
  };

  const removePhoto = (index: number) => {
    setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
    setCapturedBlobs(prev => prev.filter((_, i) => i !== index));
    setUploadProgress(prev => prev.filter((_, i) => i !== index));
  };

  const goToPhotoPreview = () => {
    stopStream();
    setViewState('photo-preview');
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
    if (capturedBlobs.length === 0 || !config) return;

    setRecordingState('uploading');
    const newProgress = [...uploadProgress];
    const sessionStart = sessionStartTime || new Date();

    // Upload all photos
    for (let i = 0; i < capturedBlobs.length; i++) {
      setCurrentUploadIndex(i);
      try {
        const file = new File([capturedBlobs[i]], `booth-photo-${i + 1}.jpg`, {
          type: 'image/jpeg'
        });

        const formData = new FormData();
        formData.append('media', file);
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
      // Generate session download QR code
      try {
        const response = await guestbookApi.generateSessionQR(
          config.eventId,
          getDeviceId(),
          sessionStart.toISOString()
        );
        
        if (response.data.qrCodeData) {
          setSessionQRCode(response.data.qrCodeData);
          setTimeout(() => setViewState('download-qr'), 500);
        } else {
          toast.error('Failed to generate download QR code');
          setRecordingState('preview');
        }
      } catch (err: any) {
        console.error('Failed to generate session QR:', err);
        toast.error(err.response?.data?.error || 'Failed to generate download QR code');
        setRecordingState('preview');
      }
    } else {
      toast.error('Upload failed. Please try again.');
      setRecordingState('preview');
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

  const retakePhotos = async () => {
    setCapturedPhotos([]);
    setCapturedBlobs([]);
    setUploadProgress([]);
    await initializePhoto();
  };

  const startNewSession = () => {
    setViewState('menu');
    setGuestName('');
  };

  const cancelSession = () => {
    cleanup();
    resetToWelcome();
  };

  // Max photos for session
  const maxPhotosPerSession = config?.maxPhotosPerSession || 10;
  const canTakeMorePhotos = capturedPhotos.length < maxPhotosPerSession;

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
  if (permissionState === 'denied' && (viewState === 'video' || viewState === 'audio' || viewState === 'photo')) {
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
            Please allow camera and microphone access to use the booth.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={cancelSession}
              className="px-8 py-4 bg-white/10 text-white rounded-full text-lg font-bold hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (viewState === 'video') initializeVideo();
                else if (viewState === 'audio') initializeAudio();
                else if (viewState === 'photo') initializePhoto();
              }}
              className="px-8 py-4 bg-white text-slate-900 rounded-full text-lg font-bold hover:bg-white/90 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDERS ====================

  // Welcome Screen
  if (viewState === 'welcome') {
    return (
      <div 
        className="fixed inset-0 flex flex-col items-center justify-center p-8 touch-none select-none"
        style={{ background: `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}40, ${primaryColor}20)` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-purple-900/80 to-slate-900/90" />
        
        <div className="relative z-10 text-center max-w-2xl">
          <div className="w-32 h-32 mx-auto rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mb-8 animate-pulse">
            <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            {eventName || 'Welcome'}
          </h1>
          
          <p className="text-2xl text-white/70 mb-12">
            Tap to leave a special message
          </p>
          
          <button
            onClick={() => setViewState('menu')}
            className="px-16 py-6 bg-white text-slate-900 rounded-full text-2xl font-bold hover:scale-105 transition-transform active:scale-95 shadow-2xl"
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  // Menu Screen
  if (viewState === 'menu') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col p-8">
        {/* Cancel Button */}
        <div className="absolute top-6 left-6 z-20">
          <button
            onClick={cancelSession}
            className="px-6 py-3 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Guest Name Input */}
          <div className="w-full max-w-md mb-12">
            <label className="block text-white/60 text-lg mb-3 text-center">Your Name (Optional)</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-6 py-5 bg-white/10 border border-white/20 rounded-2xl text-white text-xl text-center placeholder-white/40 focus:outline-none focus:border-white/40 focus:bg-white/15"
            />
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-white mb-10">Choose Your Message Type</h2>

          {/* Options Grid - Tablet Optimized */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            {/* Video */}
            <button
              onClick={initializeVideo}
              className="group p-10 bg-white/10 hover:bg-red-500/20 rounded-3xl transition-all hover:scale-105 active:scale-95 border border-white/10 hover:border-red-400/50"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-6 group-hover:bg-red-500/30 transition-colors">
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Video Message</h3>
              <p className="text-white/60 text-lg">Record a video</p>
            </button>

            {/* Audio */}
            <button
              onClick={initializeAudio}
              className="group p-10 bg-white/10 hover:bg-blue-500/20 rounded-3xl transition-all hover:scale-105 active:scale-95 border border-white/10 hover:border-blue-400/50"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center mb-6 group-hover:bg-blue-500/30 transition-colors">
                <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Audio Message</h3>
              <p className="text-white/60 text-lg">Record your voice</p>
            </button>

            {/* Take Photos */}
            <button
              onClick={initializePhoto}
              className="group p-10 bg-white/10 hover:bg-green-500/20 rounded-3xl transition-all hover:scale-105 active:scale-95 border border-white/10 hover:border-green-400/50"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-6 group-hover:bg-green-500/30 transition-colors">
                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Take Photos</h3>
              <p className="text-white/60 text-lg">Capture memories</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Video Recording Screen
  if (viewState === 'video') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Cancel Button */}
        <div className="absolute top-6 left-6 z-20">
          <button
            onClick={cancelSession}
            className="px-6 py-3 bg-black/50 text-white rounded-full font-semibold hover:bg-black/70 transition-all flex items-center gap-2 backdrop-blur-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
        </div>

        {/* Video Preview */}
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              recordingState === 'preview' && "hidden"
            )}
            style={{ transform: 'none' }}
          />
          
          {/* Preview Video */}
          {recordingState === 'preview' && (
            <video
              ref={previewVideoRef}
              controls
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />
          )}

          {/* Recording Indicator */}
          {recordingState === 'recording' && (
            <div className="absolute top-6 right-6 flex items-center gap-3 bg-black/50 px-5 py-3 rounded-full backdrop-blur-sm">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white text-xl font-mono">{formatDuration(recordingTime)}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gradient-to-t from-black/90 to-transparent p-8">
          <div className="flex items-center justify-center gap-8">
            {recordingState === 'ready' && (
              <button
                onClick={startVideoRecording}
                className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors active:scale-95 shadow-2xl"
              >
                <div className="w-10 h-10 bg-white rounded-full" />
              </button>
            )}

            {recordingState === 'recording' && (
              <button
                onClick={stopVideoRecording}
                className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors active:scale-95 shadow-2xl animate-pulse"
              >
                <div className="w-10 h-10 bg-white rounded-md" />
              </button>
            )}

            {recordingState === 'preview' && (
              <>
                <button
                  onClick={retake}
                  className="px-10 py-5 bg-white/10 text-white rounded-full text-xl font-bold hover:bg-white/20 transition-all active:scale-95"
                >
                  Retake
                </button>
                <button
                  onClick={() => uploadMedia('VIDEO')}
                  className="px-14 py-5 bg-green-600 text-white rounded-full text-xl font-bold hover:bg-green-700 transition-all active:scale-95"
                >
                  Submit
                </button>
              </>
            )}

            {recordingState === 'uploading' && (
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-white text-xl">Uploading...</span>
              </div>
            )}
          </div>

          {/* Duration hint */}
          {recordingState === 'ready' && (
            <p className="text-center text-white/60 mt-4 text-lg">
              Tap to start recording (max {config?.maxRecordingDuration || 120}s)
            </p>
          )}
        </div>
      </div>
    );
  }

  // Audio Recording Screen
  if (viewState === 'audio') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
        {/* Cancel Button */}
        <div className="absolute top-6 left-6 z-20">
          <button
            onClick={cancelSession}
            className="px-6 py-3 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
        </div>

        {/* Visualization */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-end justify-center gap-1 h-64">
            {audioWaveform.map((value, i) => (
              <div
                key={i}
                className="w-2 md:w-3 bg-blue-400 rounded-full transition-all duration-75"
                style={{ 
                  height: `${Math.max(8, value * 250)}px`,
                  opacity: recordingState === 'recording' ? 0.8 + value * 0.2 : 0.3
                }}
              />
            ))}
          </div>
        </div>

        {/* Timer */}
        {(recordingState === 'recording' || recordingState === 'preview') && (
          <div className="text-center pb-4">
            <span className="text-white text-5xl font-mono">{formatDuration(recordingTime)}</span>
          </div>
        )}

        {/* Controls */}
        <div className="p-8">
          <div className="flex items-center justify-center gap-8">
            {recordingState === 'ready' && (
              <button
                onClick={startAudioRecording}
                className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors active:scale-95 shadow-2xl"
              >
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}

            {recordingState === 'recording' && (
              <button
                onClick={stopAudioRecording}
                className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors active:scale-95 shadow-2xl animate-pulse"
              >
                <div className="w-10 h-10 bg-white rounded-md" />
              </button>
            )}

            {recordingState === 'preview' && (
              <>
                <button
                  onClick={retake}
                  className="px-10 py-5 bg-white/10 text-white rounded-full text-xl font-bold hover:bg-white/20 transition-all active:scale-95"
                >
                  Retake
                </button>
                <button
                  onClick={() => uploadMedia('AUDIO')}
                  className="px-14 py-5 bg-green-600 text-white rounded-full text-xl font-bold hover:bg-green-700 transition-all active:scale-95"
                >
                  Submit
                </button>
              </>
            )}

            {recordingState === 'uploading' && (
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-white text-xl">Uploading...</span>
              </div>
            )}
          </div>

          {recordingState === 'ready' && (
            <p className="text-center text-white/60 mt-4 text-lg">
              Tap to start recording (max {config?.maxRecordingDuration || 120}s)
            </p>
          )}
        </div>
      </div>
    );
  }

  // Photo Capture Screen
  if (viewState === 'photo') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Flash Effect */}
        {flashActive && (
          <div className="absolute inset-0 bg-white z-50 animate-flash" />
        )}

        {/* Hidden Canvas for Capture */}
        <canvas ref={photoCanvasRef} className="hidden" />

        {/* Cancel Button */}
        <div className="absolute top-6 left-6 z-20">
          <button
            onClick={cancelSession}
            className="px-6 py-3 bg-black/50 text-white rounded-full font-semibold hover:bg-black/70 transition-all flex items-center gap-2 backdrop-blur-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
        </div>

        {/* Photo Count */}
        <div className="absolute top-6 right-6 z-20">
          <div className="px-5 py-3 bg-black/50 text-white rounded-full font-semibold backdrop-blur-sm text-lg">
            {capturedPhotos.length} / {maxPhotosPerSession}
          </div>
        </div>

        {/* Camera Preview */}
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'none' }}
          />

          {/* Countdown Overlay */}
          {recordingState === 'countdown' && shutterCountdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-[200px] font-bold text-white animate-pulse">
                {shutterCountdown}
              </div>
            </div>
          )}

          {/* Thumbnail Strip */}
          {capturedPhotos.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <div className="flex gap-3 overflow-x-auto pb-2">
                {capturedPhotos.map((photo, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <img
                      src={photo}
                      alt={`Captured ${i + 1}`}
                      className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-xl border-2 border-white/50"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gradient-to-t from-black/90 to-transparent p-8">
          <div className="flex items-center justify-center gap-8">
            {/* Shutter Button */}
            {recordingState === 'ready' && canTakeMorePhotos && (
              <button
                onClick={startShutterCountdown}
                className="w-24 h-24 bg-white rounded-full flex items-center justify-center hover:bg-white/90 transition-colors active:scale-95 shadow-2xl border-4 border-white/30"
              >
                <div className="w-16 h-16 bg-white rounded-full border-4 border-gray-300" />
              </button>
            )}

            {/* Cancel Countdown Button */}
            {recordingState === 'countdown' && (
              <button
                onClick={cancelCountdown}
                className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors active:scale-95 shadow-2xl"
              >
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Done Button (when photos taken) */}
            {recordingState === 'ready' && capturedPhotos.length > 0 && (
              <button
                onClick={goToPhotoPreview}
                className="px-12 py-5 bg-green-600 text-white rounded-full text-xl font-bold hover:bg-green-700 transition-all active:scale-95"
              >
                Done ({capturedPhotos.length})
              </button>
            )}
          </div>

          {recordingState === 'ready' && canTakeMorePhotos && (
            <p className="text-center text-white/60 mt-4 text-lg">
              Tap the button to take a photo ({3} second countdown)
            </p>
          )}

          {!canTakeMorePhotos && (
            <p className="text-center text-amber-400 mt-4 text-lg">
              Maximum photos reached. Tap Done to continue.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Photo Preview Screen
  if (viewState === 'photo-preview') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-green-900 to-slate-900 flex flex-col p-8">
        {/* Cancel Button */}
        <div className="absolute top-6 left-6 z-20">
          <button
            onClick={cancelSession}
            className="px-6 py-3 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
        </div>

        <h2 className="text-3xl font-bold text-white text-center mt-8 mb-8">
          Review Your Photos ({capturedPhotos.length})
        </h2>

        {/* Photo Grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {capturedPhotos.map((photo, i) => (
              <div key={i} className="relative aspect-square">
                <img
                  src={photo}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover rounded-2xl"
                />
                {recordingState !== 'uploading' && (
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-2 right-2 w-10 h-10 bg-red-500/90 text-white rounded-full flex items-center justify-center text-xl font-bold hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
                {/* Upload Progress */}
                {uploadProgress[i] === 100 && (
                  <div className="absolute inset-0 bg-green-500/30 rounded-2xl flex items-center justify-center">
                    <svg className="w-16 h-16 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {uploadProgress[i] === -1 && (
                  <div className="absolute inset-0 bg-red-500/30 rounded-2xl flex items-center justify-center">
                    <svg className="w-16 h-16 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                {currentUploadIndex === i && (
                  <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-6 mt-8">
          {recordingState !== 'uploading' && (
            <>
              <button
                onClick={retakePhotos}
                className="px-10 py-5 bg-white/10 text-white rounded-full text-xl font-bold hover:bg-white/20 transition-all active:scale-95"
              >
                Retake All
              </button>
              <button
                onClick={uploadPhotos}
                disabled={capturedPhotos.length === 0}
                className="px-14 py-5 bg-green-600 text-white rounded-full text-xl font-bold hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download Photos
              </button>
            </>
          )}

          {recordingState === 'uploading' && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-white text-xl">
                Processing {currentUploadIndex + 1} of {capturedBlobs.length}...
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Download QR Code Screen
  if (viewState === 'download-qr' && sessionQRCode) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-green-900 to-slate-900 flex flex-col p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full flex flex-col items-center justify-center min-h-full">
          <h2 className="text-4xl font-bold text-white text-center mb-4">
            Download Your Photos
          </h2>
          <p className="text-xl text-white/70 text-center mb-8">
            Scan the QR code with your phone camera to download all {capturedPhotos.length} photo{capturedPhotos.length !== 1 ? 's' : ''}
          </p>

          <div className="bg-white/10 rounded-3xl p-8 backdrop-blur-sm mb-8">
            <div className="flex flex-col items-center gap-6">
              <img
                src={sessionQRCode}
                alt="QR Code to download all photos"
                className="w-80 h-80 bg-white p-4 rounded-2xl"
              />
              <p className="text-white/60 text-sm text-center max-w-md">
                Open your phone camera and scan this QR code. All your photos will be downloaded as a ZIP file.
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-6">
            <button
              onClick={startNewSession}
              className="px-12 py-5 bg-white text-slate-900 rounded-full text-xl font-bold hover:bg-white/90 transition-all active:scale-95"
            >
              Take More Photos
            </button>
            <button
              onClick={resetToWelcome}
              className="px-12 py-5 bg-white/10 text-white rounded-full text-xl font-bold hover:bg-white/20 transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success Screen
  if (viewState === 'success') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-green-900 to-slate-900 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-8 animate-bounce">
            <svg className="w-16 h-16 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 className="text-5xl font-bold text-white mb-4">Thank You!</h2>
          <p className="text-2xl text-white/70 mb-12">Your message has been recorded</p>
          
          <div className="space-y-4">
            <button
              onClick={startNewSession}
              className="block w-full px-12 py-5 bg-white text-slate-900 rounded-full text-xl font-bold hover:bg-white/90 transition-all active:scale-95"
            >
              Leave Another Message
            </button>
            
            <p className="text-white/50 text-lg">
              Resetting in {resetCountdown}s...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
