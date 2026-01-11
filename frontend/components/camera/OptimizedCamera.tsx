'use client';

import { useEffect, useRef, useState } from 'react';
import {
  initializeCamera,
  getOptimalVideoConstraints,
  getOptimalPhotoConstraints,
  capturePhoto,
  startVideoRecording,
  stopVideoRecording,
  stopCamera,
  applyMirrorEffect,
} from '@/lib/cameraUtils';

interface OptimizedCameraProps {
  mode: 'photo' | 'video' | 'both';
  facingMode?: 'user' | 'environment';
  onPhotoCapture?: (blob: Blob) => void;
  onVideoRecord?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  className?: string;
  showControls?: boolean;
  autoStart?: boolean;
}

export default function OptimizedCamera({
  mode,
  facingMode = 'user',
  onPhotoCapture,
  onVideoRecord,
  onError,
  className = '',
  showControls = true,
  autoStart = true,
}: OptimizedCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (autoStart && !isInitialized) {
      startCamera();
    }

    return () => {
      cleanup();
    };
  }, [autoStart, facingMode]);

  const startCamera = async () => {
    if (!videoRef.current) return;

    try {
      setError(null);
      const constraints = mode === 'photo' 
        ? getOptimalPhotoConstraints(facingMode)
        : getOptimalVideoConstraints(facingMode);

      const stream = await initializeCamera(
        videoRef.current,
        constraints,
        (err) => {
          setError(err.message);
          if (onError) onError(err);
        }
      );

      if (stream) {
        streamRef.current = stream;
        setIsInitialized(true);
      }
    } catch (err: any) {
      setError(err.message);
      if (onError) onError(err);
    }
  };

  const cleanup = () => {
    if (streamRef.current) {
      stopCamera(streamRef.current);
      streamRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsInitialized(false);
    setIsRecording(false);
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current || !isInitialized) return;

    try {
      const blob = await capturePhoto(videoRef.current, 0.95);
      if (onPhotoCapture) {
        onPhotoCapture(blob);
      }
    } catch (err: any) {
      setError(err.message);
      if (onError) onError(err);
    }
  };

  const handleStartRecording = async () => {
    if (!streamRef.current || isRecording) return;

    try {
      const recorder = startVideoRecording(streamRef.current);
      if (!recorder) {
        throw new Error('Failed to start recording');
      }

      recorderRef.current = recorder;
      recorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (err: any) {
      setError(err.message);
      if (onError) onError(err);
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;

    try {
      const blob = await stopVideoRecording(recorderRef.current);
      if (onVideoRecord) {
        onVideoRecord(blob);
      }
      recorderRef.current = null;
      setIsRecording(false);
    } catch (err: any) {
      setError(err.message);
      if (onError) onError(err);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  if (error) {
    return (
      <div className={`bg-surface-100 rounded-lg p-6 text-center ${className}`}>
        <p className="text-rose-600 mb-4">{error}</p>
        <button onClick={startCamera} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover rounded-lg"
        style={{
          transform: 'none', // Mirroring removed - cameras handle their own orientation
        }}
      />
      
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-900/50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2" />
            <p className="text-white text-sm">Initializing camera...</p>
          </div>
        </div>
      )}

      {showControls && isInitialized && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
          {(mode === 'photo' || mode === 'both') && (
            <button
              onClick={handleCapturePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-surface-300 hover:border-navy-500 transition-colors flex items-center justify-center"
              aria-label="Capture photo"
            >
              <div className="w-12 h-12 rounded-full bg-navy-900" />
            </button>
          )}
          
          {(mode === 'video' || mode === 'both') && (
            <button
              onClick={handleToggleRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-white hover:bg-surface-100'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? (
                <div className="w-6 h-6 bg-white rounded-sm" />
              ) : (
                <div className="w-0 h-0 border-l-[12px] border-l-navy-900 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1" />
              )}
            </button>
          )}
        </div>
      )}

      {isRecording && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-rose-600 text-white px-3 py-1 rounded-full">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-sm font-medium">Recording</span>
        </div>
      )}
    </div>
  );
}

