'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { publicApi, guestbookApi } from '@/lib/api';
import { formatDuration, getDeviceId, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type MediaType = 'VIDEO' | 'AUDIO' | 'PHOTO';
type RecordingState = 'idle' | 'recording' | 'preview' | 'uploading' | 'done';

// Store access codes per event slug to prevent leaking between events
const getStoredAccessCode = (slug: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(`guestbook_access_${slug}`);
    return stored;
  } catch {
    return null;
  }
};

const storeAccessCode = (slug: string, code: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`guestbook_access_${slug}`, code);
  } catch {
    // Storage not available
  }
};

export default function GuestbookPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const urlCode = searchParams.get('code');
  const urlToken = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [invitationOnly, setInvitationOnly] = useState(false);
  
  // Access code input state
  const [accessCodeInput, setAccessCodeInput] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  
  const [selectedType, setSelectedType] = useState<MediaType | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [guestName, setGuestName] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize verified code from URL or localStorage
  useEffect(() => {
    const storedCode = getStoredAccessCode(slug);
    const initialCode = urlCode || urlToken || storedCode;
    if (initialCode) {
      setVerifiedCode(initialCode);
      // If code came from URL, store it for future visits
      if (urlCode || urlToken) {
        storeAccessCode(slug, urlCode || urlToken || '');
      }
    }
  }, [slug, urlCode, urlToken]);

  useEffect(() => {
    fetchEventInfo();
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slug]);

  useEffect(() => {
    if (eventId && (verifiedCode || !invitationOnly)) {
      fetchConfig();
    }
  }, [eventId, verifiedCode, invitationOnly]);

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

      // Check for stored code
      const storedCode = getStoredAccessCode(slug);
      const codeToUse = urlCode || urlToken || storedCode;

      if (!event.invitationOnly) {
        // Not invitation-only, proceed directly
      } else if (codeToUse) {
        // We have a code, will verify when fetching config
        if (!verifiedCode) {
          setVerifiedCode(codeToUse);
        }
      } else {
        // Need to prompt for access code
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
      const codeParam = verifiedCode || undefined;
      const configRes = await guestbookApi.getConfig(eventId, codeParam);
      setConfig(configRes.data.config);
      setNeedsAuth(false);
      setLoading(false);
      
      // Store the verified code for future visits
      if (verifiedCode) {
        storeAccessCode(slug, verifiedCode);
      }
    } catch (err: any) {
      if (err.response?.status === 401 && invitationOnly) {
        setNeedsAuth(true);
        setVerifiedCode(null);
        // Clear invalid stored code
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`guestbook_access_${slug}`);
        }
      } else {
        setError(err.response?.data?.error || 'Failed to load guestbook');
      }
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...accessCodeInput];
    newCode[index] = value.slice(-1);
    setAccessCodeInput(newCode);

    if (value && index < 5) {
      const nextInput = document.getElementById(`guestbook-code-${index + 1}`);
      nextInput?.focus();
    }

    if (newCode.every(d => d) && newCode.join('').length === 6) {
      verifyAccessCode(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !accessCodeInput[index] && index > 0) {
      const prevInput = document.getElementById(`guestbook-code-${index - 1}`);
      prevInput?.focus();
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
      // Store for future visits
      storeAccessCode(slug, code);
      toast.success('Access verified!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid access code');
      setAccessCodeInput(['', '', '', '', '', '']);
      setTimeout(() => {
        document.getElementById('guestbook-code-0')?.focus();
      }, 100);
    } finally {
      setVerifying(false);
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (!selectedType || selectedType === 'PHOTO') return;

    try {
      const constraints = selectedType === 'VIDEO'
        ? { video: { facingMode: 'user' }, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current && selectedType === 'VIDEO') {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mimeType = selectedType === 'VIDEO' ? 'video/webm' : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        setRecordingState('preview');
      };

      mediaRecorder.start();
      setRecordingState('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (config && newTime >= config.maxRecordingDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    } catch (err) {
      toast.error('Could not access camera/microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleUpload = async () => {
    if (chunksRef.current.length === 0 || !config) return;
    setRecordingState('uploading');

    try {
      const mimeType = selectedType === 'VIDEO' ? 'video/webm' : 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const file = new File([blob], `recording.webm`, { type: mimeType });

      const formData = new FormData();
      formData.append('media', file);
      formData.append('type', selectedType!);
      formData.append('guestName', guestName);
      formData.append('captureMode', 'PERSONAL');
      formData.append('deviceId', getDeviceId());
      formData.append('duration', recordingTime.toString());

      await guestbookApi.upload(config.eventId, formData, verifiedCode || undefined);
      setRecordingState('done');
      stopStream();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
      setRecordingState('preview');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !config) return;
    setRecordingState('uploading');

    try {
      const formData = new FormData();
      formData.append('media', file);
      formData.append('type', 'PHOTO');
      formData.append('guestName', guestName);
      formData.append('captureMode', 'PERSONAL');
      formData.append('deviceId', getDeviceId());

      await guestbookApi.upload(config.eventId, formData, verifiedCode || undefined);
      setRecordingState('done');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
      setRecordingState('idle');
    }
  };

  const reset = () => {
    stopStream();
    chunksRef.current = [];
    setSelectedType(null);
    setRecordingState('idle');
    setRecordingTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

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
          <h1 className="text-2xl font-display font-bold text-white mb-4">{error}</h1>
          <Link href={`/e/${slug}`} className="btn-primary">Back to Event</Link>
        </div>
      </div>
    );
  }

  // Access code entry screen for invitation-only events
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link href={`/e/${slug}`} className="inline-flex items-center text-surface-400 hover:text-white mb-4">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <h1 className="text-3xl font-display font-bold text-white mb-2">Enter Access Code</h1>
            <p className="text-surface-400">Enter your 6-digit invitation code to access the guestbook</p>
          </div>

          <div className="bg-white rounded-2xl shadow-elegant p-8">
            <div className="flex justify-center gap-2 sm:gap-3 mb-6">
              {accessCodeInput.map((digit, index) => (
                <input
                  key={index}
                  id={`guestbook-code-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={verifying}
                  className={cn(
                    'w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-lg border-2 bg-surface-50',
                    'focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
                    'disabled:opacity-50'
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
                Verifying...
              </div>
            )}

            <p className="text-center text-sm text-surface-500 mt-4">
              You can find this code on your invitation
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (recordingState === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-elegant max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-display font-bold text-navy-900 mb-4">Thank You!</h1>
          <p className="text-surface-600 mb-6">Your message has been saved.</p>
          <div className="flex gap-4">
            <button onClick={reset} className="btn-outline flex-1">Record Another</button>
            <Link href={`/e/${slug}`} className="btn-primary flex-1">Done</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 py-8 sm:py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <Link href={`/e/${slug}`} className="inline-flex items-center text-surface-400 hover:text-white mb-4">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">Leave a Message</h1>
          <p className="text-primary-500">{eventName}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-elegant p-5 sm:p-8">
          {!selectedType && (
            <>
              <div className="mb-6">
                <label className="label">Your Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter your name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <p className="label">Choose message type:</p>
                <button
                  onClick={() => setSelectedType('VIDEO')}
                  className="w-full p-4 rounded-xl border-2 border-surface-200 hover:border-primary-500 hover:bg-primary-50 transition-all flex items-center gap-4 active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-navy-900">Video Message</p>
                    <p className="text-sm text-surface-500">{config?.minRecordingDuration || 30}-{config?.maxRecordingDuration || 120} seconds</p>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedType('AUDIO')}
                  className="w-full p-4 rounded-xl border-2 border-surface-200 hover:border-primary-500 hover:bg-primary-50 transition-all flex items-center gap-4 active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-navy-900">Audio Message</p>
                    <p className="text-sm text-surface-500">{config?.minRecordingDuration || 30}-{config?.maxRecordingDuration || 120} seconds</p>
                  </div>
                </button>

                <label className="w-full p-4 rounded-xl border-2 border-surface-200 hover:border-primary-500 hover:bg-primary-50 transition-all flex items-center gap-4 cursor-pointer active:scale-[0.98]">
                  <input type="file" accept="image/*" className="sr-only" onChange={handlePhotoUpload} />
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-navy-900">Upload Photo</p>
                    <p className="text-sm text-surface-500">Share a memory</p>
                  </div>
                </label>
              </div>
            </>
          )}

          {selectedType && selectedType !== 'PHOTO' && (
            <div className="space-y-6">
              {selectedType === 'VIDEO' && (
                <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  {recordingState === 'recording' && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      REC
                    </div>
                  )}
                </div>
              )}

              {selectedType === 'AUDIO' && (
                <div className="h-32 bg-surface-100 rounded-xl flex items-center justify-center">
                  {recordingState === 'recording' ? (
                    <div className="flex items-end gap-1 h-16">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="w-3 bg-primary-500 rounded-full animate-pulse"
                          style={{
                            height: `${30 + Math.sin(Date.now() / 200 + i) * 20}px`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <svg className="w-12 h-12 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </div>
              )}

              <div className="text-center">
                <span className="text-4xl font-mono font-bold text-navy-900">{formatDuration(recordingTime)}</span>
                <span className="text-surface-500 ml-2">/ {formatDuration(config?.maxRecordingDuration || 120)}</span>
              </div>

              <div className="flex justify-center gap-4">
                {recordingState === 'idle' && (
                  <>
                    <button onClick={reset} className="btn-ghost">Cancel</button>
                    <button onClick={startRecording} className="btn-primary px-6 sm:px-8">Start Recording</button>
                  </>
                )}
                {recordingState === 'recording' && (
                  <button onClick={stopRecording} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center active:scale-95 transition-transform">
                    <div className="w-6 h-6 bg-white rounded" />
                  </button>
                )}
                {recordingState === 'preview' && (
                  <>
                    <button onClick={reset} className="btn-ghost">Retake</button>
                    <button onClick={handleUpload} className="btn-primary px-6 sm:px-8">Submit</button>
                  </>
                )}
                {recordingState === 'uploading' && (
                  <div className="flex items-center gap-2 text-surface-600">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
