'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { publicApi, checkInApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type CheckInState = 'idle' | 'checking' | 'success' | 'error';
type InputMode = 'scan' | 'manual';

export default function CheckInPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [inputMode, setInputMode] = useState<InputMode>('scan');
  const [accessCode, setAccessCode] = useState(['', '', '', '', '', '']);
  const [checkInState, setCheckInState] = useState<CheckInState>('idle');
  const [guestInfo, setGuestInfo] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  // QR Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchEvent();
    return () => {
      stopScanner();
    };
  }, [slug]);

  useEffect(() => {
    if (inputMode === 'scan' && checkInState === 'idle' && eventId) {
      startScanner();
    } else {
      stopScanner();
    }
  }, [inputMode, checkInState, eventId]);

  const fetchEvent = async () => {
    try {
      const response = await publicApi.getEvent(slug);
      if (!response.data.event.capabilities.canCheckIn) {
        setError('Check-in is not available at this time');
      } else {
        setEventId(response.data.event.id);
        setEventName(response.data.event.name);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Event not found');
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setScannerActive(true);
      
      // Start scanning for QR codes
      scanIntervalRef.current = setInterval(() => {
        scanQRCode();
      }, 250);
    } catch (err) {
      console.error('Camera error:', err);
      setHasCamera(false);
      setInputMode('manual');
    }
  };

  const stopScanner = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScannerActive(false);
  };

  const scanQRCode = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Use BarcodeDetector API if available
    if ('BarcodeDetector' in window) {
      try {
        // @ts-ignore
        const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await barcodeDetector.detect(imageData);
        
        if (barcodes.length > 0) {
          const qrData = barcodes[0].rawValue;
          handleQRResult(qrData);
        }
      } catch (err) {
        // BarcodeDetector failed, continue scanning
      }
    }
  };

  const handleQRResult = (data: string) => {
    stopScanner();
    
    try {
      // Try to parse as JSON (our QR format)
      const parsed = JSON.parse(data);
      if (parsed.token) {
        handleCheckIn(undefined, parsed.token);
      } else if (parsed.code) {
        handleCheckIn(parsed.code, undefined);
      }
    } catch {
      // Not JSON, might be just a token string
      if (data.length === 6 && /^\d+$/.test(data)) {
        handleCheckIn(data, undefined);
      } else {
        handleCheckIn(undefined, data);
      }
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Handle pasted multi-digit input
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = [...accessCode];
      digits.forEach((digit, i) => {
        if (index + i < 6) newCode[index + i] = digit;
      });
      setAccessCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      document.getElementById(`code-${nextIndex}`)?.focus();
      if (newCode.every(d => d) && newCode.join('').length === 6) {
        handleCheckIn(newCode.join(''), undefined);
      }
      return;
    }

    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...accessCode];
    newCode[index] = value.slice(-1);
    setAccessCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit when complete
    if (newCode.every(d => d) && newCode.join('').length === 6) {
      handleCheckIn(newCode.join(''), undefined);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !accessCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newCode = pasted.split('').concat(new Array(6 - pasted.length).fill(''));
      setAccessCode(newCode.slice(0, 6));
      if (pasted.length === 6) {
        handleCheckIn(pasted, undefined);
      } else {
        document.getElementById(`code-${pasted.length}`)?.focus();
      }
    }
  };

  const handleCheckIn = async (accessCode?: string, token?: string) => {
    if (!eventId) return;
    
    setCheckInState('checking');
    setErrorMessage('');

    try {
      const response = await checkInApi.checkIn(eventId, {
        accessCode,
        token,
        method: token ? 'QR_SCAN' : 'MANUAL_CODE',
      });

      if (response.data.success) {
        setCheckInState('success');
        setGuestInfo(response.data.guest);
        // Vibrate on success (mobile)
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }
      }
    } catch (err: any) {
      setCheckInState('error');
      setErrorMessage(err.response?.data?.error || 'Check-in failed');
      // Vibrate pattern on error (mobile)
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  };

  const reset = () => {
    setAccessCode(['', '', '', '', '', '']);
    setCheckInState('idle');
    setGuestInfo(null);
    setErrorMessage('');
    
    if (inputMode === 'manual') {
      setTimeout(() => {
        document.getElementById('code-0')?.focus();
      }, 100);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-white mb-4">{error}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col touch-manipulation">
      {/* Header - Compact for tablet/mobile */}
      <header className="p-4 sm:p-6 text-center border-b border-white/10 safe-area-top">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white truncate">{eventName}</h1>
        <p className="text-primary-500 text-sm sm:text-base">Guest Check-In</p>
      </header>

      {/* Main Content - Fills available space */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        {/* Success State */}
        {checkInState === 'success' && guestInfo ? (
          <div className="text-center animate-in w-full max-w-md">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full bg-green-500 flex items-center justify-center mb-4 sm:mb-6">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-2">Welcome!</h2>
            <p className="text-xl sm:text-2xl text-primary-500 mb-2">{guestInfo.name}</p>
            {guestInfo.guestCount > 1 && (
              <p className="text-surface-400">Party of {guestInfo.guestCount}</p>
            )}
            <button 
              onClick={reset} 
              className="btn-primary mt-6 sm:mt-8 px-10 sm:px-12 py-3 text-base sm:text-lg active:scale-95 transition-transform"
            >
              Next Guest
            </button>
          </div>
        ) : checkInState === 'error' ? (
          /* Error State */
          <div className="text-center animate-in w-full max-w-md">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full bg-red-500 flex items-center justify-center mb-4 sm:mb-6">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">Check-In Failed</h2>
            <p className="text-red-400 mb-6 sm:mb-8 text-sm sm:text-base">{errorMessage}</p>
            <button 
              onClick={reset} 
              className="btn-primary px-10 sm:px-12 py-3 text-base sm:text-lg active:scale-95 transition-transform"
            >
              Try Again
            </button>
          </div>
        ) : checkInState === 'checking' ? (
          /* Checking State */
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4">
              <svg className="animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-white text-lg">Verifying...</p>
          </div>
        ) : (
          /* Input State */
          <div className="w-full max-w-lg">
            {/* Mode Toggle */}
            {hasCamera && (
              <div className="flex bg-white/10 rounded-xl p-1 mb-6">
                <button
                  onClick={() => setInputMode('scan')}
                  className={cn(
                    'flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                    inputMode === 'scan'
                      ? 'bg-primary-500 text-navy-900'
                      : 'text-white hover:bg-white/10'
                  )}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <span className="hidden sm:inline">Scan QR</span>
                  <span className="sm:hidden">Scan</span>
                </button>
                <button
                  onClick={() => setInputMode('manual')}
                  className={cn(
                    'flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                    inputMode === 'manual'
                      ? 'bg-primary-500 text-navy-900'
                      : 'text-white hover:bg-white/10'
                  )}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <span className="hidden sm:inline">Enter Code</span>
                  <span className="sm:hidden">Code</span>
                </button>
              </div>
            )}

            {/* QR Scanner Mode */}
            {inputMode === 'scan' && hasCamera && (
              <div className="space-y-4">
                <div className="relative aspect-square max-h-[50vh] mx-auto rounded-2xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  {/* Scanner overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 sm:w-64 sm:h-64 relative">
                      {/* Corner markers */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500 rounded-br-lg" />
                      {/* Scanning line animation */}
                      {scannerActive && (
                        <div className="absolute left-2 right-2 h-0.5 bg-primary-500 animate-scan" />
                      )}
                    </div>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <p className="text-center text-surface-400 text-sm sm:text-base">
                  Position the QR code within the frame
                </p>
              </div>
            )}

            {/* Manual Code Entry Mode */}
            {inputMode === 'manual' && (
              <div className="text-center">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-2">Enter Access Code</h2>
                <p className="text-surface-400 mb-6 sm:mb-8 text-sm sm:text-base">Enter your 6-digit invitation code</p>

                <div className="flex justify-center gap-2 sm:gap-3 mb-6" onPaste={handleCodePaste}>
                  {accessCode.map((digit, index) => (
                    <input
                      key={index}
                      id={`code-${index}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handleCodePaste}
                      className={cn(
                        'w-11 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 bg-white/10 text-white',
                        'focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
                        'transition-all'
                      )}
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer - Safe area for mobile */}
      <footer className="p-4 text-center border-t border-white/10 safe-area-bottom space-y-2">
        <img 
          src="/img/logo-light.svg" 
          alt="Digital Event Platform" 
          className="h-6 w-auto mx-auto opacity-80"
        />
        <p className="text-surface-400 text-xs">
          © {new Date().getFullYear()} Digital Event Platform. All rights reserved.
        </p>
        <p className="text-surface-500 text-xs sm:text-sm">
          {inputMode === 'scan' ? 'Scan QR code from invitation' : 'Enter 6-digit code from invitation'}
        </p>
      </footer>

      {/* Custom styles for scanning animation */}
      <style jsx>{`
        @keyframes scan {
          0%, 100% { top: 0; }
          50% { top: calc(100% - 2px); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
        .safe-area-top {
          padding-top: max(1rem, env(safe-area-inset-top));
        }
        .safe-area-bottom {
          padding-bottom: max(1rem, env(safe-area-inset-bottom));
        }
      `}</style>
    </div>
  );
}
