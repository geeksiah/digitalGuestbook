'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { publicApi, guestbookApi } from '@/lib/api';
import { formatDuration, getDeviceId, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type ViewState = 'menu' | 'video' | 'audio' | 'photo' | 'success';
type RecordingState = 'idle' | 'ready' | 'recording' | 'preview' | 'uploading';
type PermissionState = 'checking' | 'granted' | 'denied' | 'prompt';

// Persistent access code storage per event
const getStoredAccessCode = (slug: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`guestbook_access_${slug}`);
  } catch {
    return null;
  }
};

const storeAccessCode = (slug: string, code: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`guestbook_access_${slug}`, code);
  } catch {}
};

export default function GuestbookPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const urlCode = searchParams.get('code');
  const urlToken = searchParams.get('token');

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [invitationOnly, setInvitationOnly] = useState(false);
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);

  // UI state
  const [viewState, setViewState] = useState<ViewState>('menu');
  const [guestName, setGuestName] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');

  // Access code input
  const [accessCodeInput, setAccessCodeInput] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);

  // Photo upload state
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(-1);

  // Audio visualization state
  const [audioWaveform, setAudioWaveform] = useState<number[]>(new Array(40).fill(0));
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize on mount
  useEffect(() => {
    const storedCode = getStoredAccessCode(slug);
    const initialCode = urlCode || urlToken || storedCode;
    if (initialCode) {
      setVerifiedCode(initialCode);
      if (urlCode || urlToken) {
        storeAccessCode(slug, urlCode || urlToken || '');
      }
    }
    fetchEventInfo();

    return () => cleanup();
  }, [slug]);

  // Fetch config when event is ready
  useEffect(() => {
    if (eventId && (verifiedCode || !invitationOnly)) {
      fetchConfig();
    }
  }, [eventId, verifiedCode, invitationOnly]);

  // Cleanup function
  const cleanup = useCallback(() => {
    stopStream();
    if (timerRef.current) clearInterval(timerRef.current);
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

  // API calls
  const fetchEventInfo = async () => {
    try {
      const eventRes = await publicApi.getEvent(slug);
      const event = eventRes.data.event;

      if (!event.capabilities.canAccessGuestbook) {
        setError('Guestbook is not available at this time');
        setLoading(false);
        return;
      }

      setEventName(event.name);
      setEventId(event.id);
      setInvitationOnly(event.invitationOnly);

      const storedCode = getStoredAccessCode(slug);
      const codeToUse = urlCode || urlToken || storedCode;

      if (!event.invitationOnly) {
        // Not invitation-only, will fetch config via useEffect
      } else if (codeToUse) {
        if (!verifiedCode) setVerifiedCode(codeToUse);
      } else {
        setNeedsAuth(true);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load guestbook');
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    if (!eventId) return;
    try {
      const configRes = await guestbookApi.getConfig(eventId, verifiedCode || undefined);
      setConfig(configRes.data.config);
      setNeedsAuth(false);
      setLoading(false);
      if (verifiedCode) storeAccessCode(slug, verifiedCode);
    } catch (err: any) {
      if (err.response?.status === 401 && invitationOnly) {
        setNeedsAuth(true);
        setVerifiedCode(null);
        localStorage.removeItem(`guestbook_access_${slug}`);
      } else {
        setError(err.response?.data?.error || 'Failed to load guestbook');
      }
      setLoading(false);
    }
  };

  // Access code handlers with paste support
  const handleCodeChange = (index: number, value: string) => {
    // Handle paste of multiple digits
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = [...accessCodeInput];
      digits.forEach((digit, i) => {
        if (index + i < 6) newCode[index + i] = digit;
      });
      setAccessCodeInput(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      document.getElementById(`guestbook-code-${nextIndex}`)?.focus();
      if (newCode.every(d => d) && newCode.join('').length === 6) {
        verifyAccessCode(newCode.join(''));
      }
      return;
    }

    if (!/^\d*$/.test(value)) return;
    const newCode = [...accessCodeInput];
    newCode[index] = value.slice(-1);
    setAccessCodeInput(newCode);

    if (value && index < 5) {
      document.getElementById(`guestbook-code-${index + 1}`)?.focus();
    }

    if (newCode.every(d => d) && newCode.join('').length === 6) {
      verifyAccessCode(newCode.join(''));
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !accessCodeInput[index] && index > 0) {
      document.getElementById(`guestbook-code-${index - 1}`)?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newCode = pasted.split('').concat(new Array(6 - pasted.length).fill(''));
      setAccessCodeInput(newCode.slice(0, 6));
      if (pasted.length === 6) {
        verifyAccessCode(pasted);
      } else {
        document.getElementById(`guestbook-code-${pasted.length}`)?.focus();
      }
    }
  };

  const verifyAccessCode = async (code: string) => {
    if (!eventId) return;
    setVerifying(true);
    try {
      const configRes = await guestbookApi.getConfig(eventId, code);
      setConfig(configRes.data.config);
      setVerifiedCode(code);
      setNeedsAuth(false);
      storeAccessCode(slug, code);
      toast.success('Access verified!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid access code');
      setAccessCodeInput(['', '', '', '', '', '']);
      setTimeout(() => document.getElementById('guestbook-code-0')?.focus(), 100);
    } finally {
      setVerifying(false);
    }
  };

  // Permission handling
  const requestMediaPermission = async (type: 'video' | 'audio'): Promise<boolean> => {
    setPermissionState('checking');

    try {
      const constraints = type === 'video'
        ? { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setPermissionState('granted');
      return true;
    } catch (err: any) {
      console.error('Permission error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
      } else {
        setPermissionState('prompt');
        toast.error('Could not access camera/microphone');
      }
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

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      recordedBlobRef.current = new Blob(chunksRef.current, { type: 'video/webm' });
      // Show preview
      if (previewVideoRef.current) {
        previewVideoRef.current.src = URL.createObjectURL(recordedBlobRef.current);
      }
      setRecordingState('preview');
    };

    mediaRecorder.start(1000); // Collect data every second
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
    setAudioWaveform(new Array(40).fill(0));

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

        // Sample 40 bars from frequency data
        const bars = 40;
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

    const mimeType = 'audio/webm';
    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      recordedBlobRef.current = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = URL.createObjectURL(recordedBlobRef.current);
      }
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

  const playAudioPreview = () => {
    if (audioPreviewRef.current) {
      if (isPlayingPreview) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.currentTime = 0;
        setIsPlayingPreview(false);
      } else {
        audioPreviewRef.current.play();
        setIsPlayingPreview(true);
        audioPreviewRef.current.onended = () => setIsPlayingPreview(false);
      }
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

    const maxPhotos = config?.maxPhotosPerGuest || 5;
    const remainingSlots = maxPhotos - selectedPhotos.length;
    const newFiles = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast.error(`You can only upload ${maxPhotos} photos total`);
    }

    // Create preview URLs
    const newUrls = newFiles.map(file => URL.createObjectURL(file));

    setSelectedPhotos(prev => [...prev, ...newFiles]);
    setPhotoPreviewUrls(prev => [...prev, ...newUrls]);
    setUploadProgress(prev => [...prev, ...new Array(newFiles.length).fill(0)]);

    // Reset file input
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
      const file = new File([recordedBlobRef.current], `recording.${ext}`, {
        type: type === 'VIDEO' ? 'video/webm' : 'audio/webm'
      });

      const formData = new FormData();
      formData.append('media', file);
      formData.append('type', type);
      formData.append('guestName', guestName);
      formData.append('captureMode', 'PERSONAL');
      formData.append('deviceId', getDeviceId());
      formData.append('duration', recordingTime.toString());

      await guestbookApi.upload(config.eventId, formData, verifiedCode || undefined);
      setViewState('success');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
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
        formData.append('guestName', guestName);
        formData.append('captureMode', 'PERSONAL');
        formData.append('deviceId', getDeviceId());

        await guestbookApi.upload(config.eventId, formData, verifiedCode || undefined);

        newProgress[i] = 100;
        setUploadProgress([...newProgress]);
      } catch (err: any) {
        newProgress[i] = -1; // Error state
        setUploadProgress([...newProgress]);
        toast.error(`Failed to upload photo ${i + 1}`);
      }
    }

    setCurrentUploadIndex(-1);
    const successCount = newProgress.filter(p => p === 100).length;
    if (successCount > 0) {
      setTimeout(() => setViewState('success'), 500);
    } else {
      setRecordingState('idle');
    }
  };

  // ==================== NAVIGATION ====================
  const retake = async () => {
    recordedBlobRef.current = null;
    chunksRef.current = [];
    setRecordingTime(0);
    setIsPlayingPreview(false);

    if (viewState === 'video') {
      await initializeVideo();
    } else if (viewState === 'audio') {
      await initializeAudio();
    }
  };

  const backToMenu = () => {
    cleanup();
    setViewState('menu');
    setRecordingState('idle');
    setPermissionState('prompt');
    setSelectedPhotos([]);
    setPhotoPreviewUrls([]);
    setUploadProgress([]);
    setCurrentUploadIndex(-1);
    setIsPlayingPreview(false);
    recordedBlobRef.current = null;
    chunksRef.current = [];
    setRecordingTime(0);
    setAudioWaveform(new Array(40).fill(0));
  };

  const recordAnother = () => {
    backToMenu();
  };

  // ==================== RENDER STATES ====================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-display font-bold text-white mb-2">{error}</h1>
          <Link href={`/e/${slug}`} className="btn-primary mt-4 inline-block">Back to Event</Link>
        </div>
      </div>
    );
  }

  // Access code entry
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link href={`/e/${slug}`} className="inline-flex items-center text-surface-400 hover:text-white mb-4 transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Invitation
            </Link>
            <h1 className="text-3xl font-display font-bold text-white mb-2">Enter Access Code</h1>
            <p className="text-surface-400">Enter your 6-digit invitation code</p>
          </div>

            <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex justify-center gap-2 sm:gap-3 mb-6" onPaste={handleCodePaste}>
              {accessCodeInput.map((digit, index) => (
                <input
                  key={index}
                  id={`guestbook-code-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(index, e)}
                  onPaste={handleCodePaste}
                  disabled={verifying}
                  className={cn(
                    'w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 bg-surface-50',
                    'focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20',
                    'disabled:opacity-50 transition-all'
                  )}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {verifying && (
              <div className="flex items-center justify-center gap-2 text-surface-600">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Verifying...</span>
              </div>
            )}

            <p className="text-center text-sm text-surface-500 mt-6">
              You can paste your code directly
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Permission denied screen
  if (permissionState === 'denied' && (viewState === 'video' || viewState === 'audio')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-navy-900 mb-3">Permission Required</h2>
          <p className="text-surface-600 mb-6">
            To record a {viewState === 'video' ? 'video' : 'audio'} message, please allow access to your {viewState === 'video' ? 'camera and microphone' : 'microphone'}.
          </p>

          <div className="bg-surface-50 rounded-xl p-4 mb-6 text-left">
            <p className="font-medium text-navy-900 mb-2">How to enable:</p>
            <ol className="text-sm text-surface-600 space-y-2">
              <li>1. Look for the camera/lock icon in your browser's address bar</li>
              <li>2. Click it and allow access to camera/microphone</li>
              <li>3. Refresh this page</li>
            </ol>
          </div>

          <div className="flex gap-3">
            <button onClick={backToMenu} className="btn-outline flex-1">Go Back</button>
            <button onClick={() => window.location.reload()} className="btn-primary flex-1">Refresh Page</button>
          </div>
        </div>
      </div>
    );
  }

  // Success screen
  if (viewState === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-display font-bold text-navy-900 mb-3">Thank You!</h1>
          <p className="text-surface-600 mb-8">Your message has been saved. The couple will love it!</p>
          <div className="space-y-3">
            <button onClick={recordAnother} className="btn-primary w-full py-3">
              Leave Another Message
            </button>
            <Link href={`/e/${slug}`} className="btn-outline w-full py-3 block text-center">
              Back to Invitation
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Main guestbook interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex flex-col">
      {/* Header */}
      <header className="p-4 sm:p-6 flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {viewState === 'menu' ? (
            <Link href={`/e/${slug}`} className="inline-flex items-center text-surface-400 hover:text-white transition-colors">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Back to Invitation</span>
              <span className="sm:hidden">Back</span>
            </Link>
          ) : (
            <button onClick={backToMenu} className="inline-flex items-center text-surface-400 hover:text-white transition-colors">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          )}
          <div className="text-right">
            <p className="text-white font-display font-semibold text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">{eventName}</p>
            <p className="text-primary-500 text-xs sm:text-sm">Digital Guestbook</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-lg">
          {/* MENU VIEW */}
          {viewState === 'menu' && (
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 animate-in fade-in duration-300">
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-navy-900 mb-2">Leave a Message</h1>
                <p className="text-surface-600">Record a special message for the couple</p>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium text-navy-900 mb-2">Your Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border-2 border-surface-200 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                  placeholder="Enter your name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                {/* Video Option */}
                <button
                  onClick={initializeVideo}
                  className="w-full p-5 rounded-2xl border-2 border-surface-200 hover:border-red-300 hover:bg-red-50 transition-all flex items-center gap-4 group active:scale-[0.98]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center flex-shrink-0 transition-colors">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-navy-900 text-lg">Video Message</p>
                    <p className="text-surface-500 text-sm">Record up to {config?.maxRecordingDuration || 120} seconds</p>
                  </div>
                  <svg className="w-5 h-5 text-surface-400 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Audio Option */}
                <button
                  onClick={initializeAudio}
                  className="w-full p-5 rounded-2xl border-2 border-surface-200 hover:border-purple-300 hover:bg-purple-50 transition-all flex items-center gap-4 group active:scale-[0.98]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center flex-shrink-0 transition-colors">
                    <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-navy-900 text-lg">Audio Message</p>
                    <p className="text-surface-500 text-sm">Record up to {config?.maxRecordingDuration || 120} seconds</p>
                  </div>
                  <svg className="w-5 h-5 text-surface-400 group-hover:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Photo Option */}
                <button
                  onClick={initializePhoto}
                  className="w-full p-5 rounded-2xl border-2 border-surface-200 hover:border-green-300 hover:bg-green-50 transition-all flex items-center gap-4 group active:scale-[0.98]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-green-100 group-hover:bg-green-200 flex items-center justify-center flex-shrink-0 transition-colors">
                    <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-navy-900 text-lg">Upload Photos</p>
                    <p className="text-surface-500 text-sm">Share up to {config?.maxPhotosPerGuest || 5} photos</p>
                  </div>
                  <svg className="w-5 h-5 text-surface-400 group-hover:text-green-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* VIDEO VIEW */}
          {viewState === 'video' && (
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-300">
              {/* Video Preview - Fullscreen style */}
              <div className="relative aspect-[4/3] bg-black">
                {recordingState !== 'preview' ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <video
                    ref={previewVideoRef}
                    className="w-full h-full object-contain bg-black"
                    controls
                    playsInline
                    autoPlay
                  />
                )}

                {/* Recording indicator */}
                {recordingState === 'recording' && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full animate-pulse z-20">
                    <span className="w-3 h-3 rounded-full bg-white" />
                    <span className="font-medium">REC</span>
                  </div>
                )}

                {/* Loading overlay */}
                {(recordingState === 'idle' || permissionState === 'checking') && (
                  <div className="absolute inset-0 bg-navy-900/80 flex items-center justify-center z-20">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-3" />
                      <p className="text-white">Accessing camera...</p>
                    </div>
                  </div>
                )}

                {/* Controls - Overlay style, no background covering screen */}
                {recordingState !== 'idle' && permissionState !== 'checking' && (
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                    {/* Timer */}
                    <div className="text-center mb-6">
                      <span className="text-4xl font-mono font-bold text-white drop-shadow-lg">{formatDuration(recordingTime)}</span>
                      <span className="text-white/70 text-lg ml-2 drop-shadow">/ {formatDuration(config?.maxRecordingDuration || 120)}</span>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-center items-center gap-4">
                      {recordingState === 'ready' && (
                        <button
                          onClick={startVideoRecording}
                          className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg"
                        >
                          <div className="w-8 h-8 rounded-full bg-white" />
                        </button>
                      )}

                      {recordingState === 'recording' && (
                        <button
                          onClick={stopVideoRecording}
                          className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all active:scale-95 shadow-lg animate-pulse"
                        >
                          <div className="w-8 h-8 rounded bg-white" />
                        </button>
                      )}

                      {recordingState === 'preview' && (
                        <>
                          <button onClick={retake} className="px-8 py-3 bg-white/90 text-navy-900 rounded-full font-semibold hover:bg-white transition-all">
                            Retake
                          </button>
                          <button onClick={() => uploadMedia('VIDEO')} className="px-8 py-3 bg-green-600 text-white rounded-full font-semibold hover:bg-green-700 transition-all">
                            Submit
                          </button>
                        </>
                      )}

                      {recordingState === 'uploading' && (
                        <div className="flex items-center gap-3 text-white drop-shadow-lg">
                          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="font-medium">Uploading...</span>
                        </div>
                      )}
                    </div>

                    {recordingState === 'ready' && (
                      <p className="text-center text-white/70 text-sm mt-4 drop-shadow">Tap the button to start recording</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AUDIO VIEW */}
          {viewState === 'audio' && (
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-display font-bold text-navy-900 text-center mb-6">Audio Message</h2>

              {/* Waveform Visualizer */}
              <div className="bg-navy-900 rounded-2xl p-6 mb-6">
                <div className="flex items-end justify-center gap-1 h-24">
                  {audioWaveform.map((value, index) => (
                    <div
                      key={index}
                      className={cn(
                        'w-2 rounded-full transition-all duration-75',
                        recordingState === 'recording' ? 'bg-primary-500' : 'bg-surface-600'
                      )}
                      style={{
                        height: `${Math.max(8, value * 100)}%`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Hidden audio element for preview */}
              <audio ref={audioPreviewRef} className="hidden" />

              {/* Timer */}
              <div className="text-center mb-6">
                <span className="text-4xl font-mono font-bold text-navy-900">{formatDuration(recordingTime)}</span>
                <span className="text-surface-500 text-lg ml-2">/ {formatDuration(config?.maxRecordingDuration || 120)}</span>
              </div>

              {/* Controls */}
              <div className="flex justify-center items-center gap-4">
                {(recordingState === 'idle' || permissionState === 'checking') && (
                  <div className="flex items-center gap-3 text-surface-600">
                    <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Accessing microphone...</span>
                  </div>
                )}

                {recordingState === 'ready' && (
                  <button
                    onClick={startAudioRecording}
                    className="w-20 h-20 rounded-full bg-purple-500 hover:bg-purple-600 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg"
                  >
                    <div className="w-8 h-8 rounded-full bg-white" />
                  </button>
                )}

                {recordingState === 'recording' && (
                  <button
                    onClick={stopAudioRecording}
                    className="w-20 h-20 rounded-full bg-purple-500 hover:bg-purple-600 flex items-center justify-center transition-all active:scale-95 shadow-lg animate-pulse"
                  >
                    <div className="w-8 h-8 rounded bg-white" />
                  </button>
                )}

                {recordingState === 'preview' && (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <button
                      onClick={playAudioPreview}
                      className={cn(
                        'w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg',
                        isPlayingPreview
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'bg-purple-500 hover:bg-purple-600'
                      )}
                    >
                      {isPlayingPreview ? (
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    <p className="text-sm text-surface-500">
                      {isPlayingPreview ? 'Playing...' : 'Tap to preview'}
                    </p>
                    <div className="flex gap-3 w-full">
                      <button onClick={retake} className="btn-outline flex-1 py-3">
                        Retake
                      </button>
                      <button onClick={() => uploadMedia('AUDIO')} className="btn-primary flex-1 py-3">
                        Submit
                      </button>
                    </div>
                  </div>
                )}

                {recordingState === 'uploading' && (
                  <div className="flex items-center gap-3 text-surface-600">
                    <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="font-medium">Uploading...</span>
                  </div>
                )}
              </div>

              {recordingState === 'ready' && (
                <p className="text-center text-surface-500 text-sm mt-4">Tap the button to start recording</p>
              )}
            </div>
          )}

          {/* PHOTO VIEW */}
          {viewState === 'photo' && (
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-display font-bold text-navy-900 text-center mb-2">Upload Photos</h2>
              <p className="text-surface-500 text-center mb-6">
                {selectedPhotos.length} / {config?.maxPhotosPerGuest || 5} photos selected
              </p>

              {/* Photo Grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {photoPreviewUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-surface-100">
                    <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />

                    {/* Upload progress overlay */}
                    {recordingState === 'uploading' && (
                      <div className="absolute inset-0 bg-navy-900/60 flex items-center justify-center">
                        {uploadProgress[index] === 100 ? (
                          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : uploadProgress[index] === -1 ? (
                          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                        ) : currentUploadIndex === index ? (
                          <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/30" />
                        )}
                      </div>
                    )}

                    {/* Remove button */}
                    {recordingState !== 'uploading' && (
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}

                {/* Add more button */}
                {selectedPhotos.length < (config?.maxPhotosPerGuest || 5) && recordingState !== 'uploading' && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-surface-300 hover:border-primary-500 hover:bg-primary-50 cursor-pointer flex flex-col items-center justify-center transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    <svg className="w-8 h-8 text-surface-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs text-surface-500">Add</span>
                  </label>
                )}
              </div>

              {/* Empty state */}
              {selectedPhotos.length === 0 && (
                <label className="block border-2 border-dashed border-surface-300 hover:border-primary-500 rounded-2xl p-8 text-center cursor-pointer transition-colors mb-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  <div className="w-16 h-16 mx-auto rounded-full bg-surface-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="font-medium text-navy-900 mb-1">Tap to select photos</p>
                  <p className="text-sm text-surface-500">or drag and drop</p>
                </label>
              )}

              {/* Upload button */}
              {selectedPhotos.length > 0 && (
                <button
                  onClick={uploadPhotos}
                  disabled={recordingState === 'uploading'}
                  className="btn-primary w-full py-3 disabled:opacity-50"
                >
                  {recordingState === 'uploading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Uploading {currentUploadIndex + 1} of {selectedPhotos.length}...
                    </span>
                  ) : (
                    `Upload ${selectedPhotos.length} Photo${selectedPhotos.length !== 1 ? 's' : ''}`
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
