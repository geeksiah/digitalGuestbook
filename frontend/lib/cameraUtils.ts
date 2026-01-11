/**
 * Camera utilities for optimal video and photo capture
 * - Maximum device quality
 * - Real-time mirroring
 * - High FPS
 * - Optimized file sizes without quality loss
 */

export interface CameraConstraints {
  video: MediaTrackConstraints;
  audio?: MediaTrackConstraints;
}

/**
 * Get optimal video constraints for maximum quality
 * Uses device capabilities while maintaining reasonable file sizes
 */
export function getOptimalVideoConstraints(facingMode: 'user' | 'environment' = 'user'): CameraConstraints {
  return {
    video: {
      facingMode,
      width: { ideal: 1920, max: 3840 }, // 1080p ideal, 4K max
      height: { ideal: 1080, max: 2160 },
      frameRate: { ideal: 30, min: 24 }, // High FPS for smooth video
      aspectRatio: { ideal: 16 / 9 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000, // High quality audio
      channelCount: 2, // Stereo
    },
  };
}

/**
 * Get optimal photo constraints for maximum quality
 */
export function getOptimalPhotoConstraints(facingMode: 'user' | 'environment' = 'user'): CameraConstraints {
  return {
    video: {
      facingMode,
      width: { ideal: 3840, max: 7680 }, // Higher resolution for photos
      height: { ideal: 2160, max: 4320 },
      frameRate: { ideal: 30, min: 24 },
      aspectRatio: { ideal: 4 / 3 }, // Common photo aspect ratio
    },
  };
}

/**
 * Apply mirror effect to video element (for front camera)
 */
export function applyMirrorEffect(videoElement: HTMLVideoElement, shouldMirror: boolean = true): void {
  if (shouldMirror) {
    videoElement.style.transform = 'scaleX(-1)';
    videoElement.style.webkitTransform = 'scaleX(-1)';
  } else {
    videoElement.style.transform = '';
    videoElement.style.webkitTransform = '';
  }
}

/**
 * Get available camera devices
 */
export async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  } catch (error) {
    console.error('Error enumerating devices:', error);
    return [];
  }
}

/**
 * Get the best camera device (usually the one with highest resolution)
 */
export async function getBestCameraDevice(): Promise<MediaDeviceInfo | null> {
  const cameras = await getCameraDevices();
  if (cameras.length === 0) return null;

  // Try to find a camera with "back" or "environment" label (usually better quality)
  const backCamera = cameras.find(cam => 
    cam.label.toLowerCase().includes('back') || 
    cam.label.toLowerCase().includes('environment') ||
    cam.label.toLowerCase().includes('rear')
  );

  return backCamera || cameras[0];
}

/**
 * Initialize camera with optimal settings
 */
export async function initializeCamera(
  videoElement: HTMLVideoElement,
  constraints: CameraConstraints,
  onError?: (error: Error) => void
): Promise<MediaStream | null> {
  try {
    // Request optimal constraints
    let stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Try to get the actual capabilities and adjust if needed
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const capabilities = videoTrack.getCapabilities();
      
      // If device supports higher resolution, use it
      if (capabilities.width?.max && capabilities.width.max > 1920) {
        const settings = videoTrack.getSettings();
        // Already using optimal settings from constraints
      }

      // Apply mirror for front camera
      const facingMode = videoTrack.getSettings().facingMode;
      if (facingMode === 'user') {
        applyMirrorEffect(videoElement, true);
      }
    }

    videoElement.srcObject = stream;
    await videoElement.play();

    return stream;
  } catch (error: any) {
    console.error('Error initializing camera:', error);
    
    // Fallback to basic constraints if optimal fails
    if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
      console.warn('Optimal constraints not supported, falling back to basic constraints');
      try {
        const fallbackConstraints: CameraConstraints = {
          video: {
            facingMode: constraints.video.facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        };
        const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        videoElement.srcObject = stream;
        await videoElement.play();
        
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack?.getSettings().facingMode === 'user') {
          applyMirrorEffect(videoElement, true);
        }
        
        return stream;
      } catch (fallbackError: any) {
        if (onError) onError(fallbackError);
        return null;
      }
    }
    
    if (onError) onError(error);
    return null;
  }
}

/**
 * Capture photo from video stream with optimal quality
 */
export function capturePhoto(videoElement: HTMLVideoElement, quality: number = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Apply mirror if needed (for front camera)
      const isMirrored = videoElement.style.transform === 'scaleX(-1)';
      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Convert to blob with high quality
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        quality // High quality (0.95 = 95% quality)
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Record video with optimal settings
 * Uses MediaRecorder with high quality codecs
 */
export function startVideoRecording(
  stream: MediaStream,
  options: {
    mimeType?: string;
    videoBitsPerSecond?: number;
    audioBitsPerSecond?: number;
  } = {}
): MediaRecorder | null {
  try {
    // Try to use best available codec
    const codecs = [
      'video/webm;codecs=vp9,opus', // Best quality, good compression
      'video/webm;codecs=vp8,opus', // Good quality, better compatibility
      'video/webm;codecs=h264,opus', // H.264 if supported
      'video/webm', // Fallback
      'video/mp4', // Last resort
    ];

    let mimeType = options.mimeType;
    if (!mimeType) {
      for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
          mimeType = codec;
          break;
        }
      }
    }

    if (!mimeType) {
      console.warn('No supported codec found, using default');
      mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: options.videoBitsPerSecond || 5000000, // 5 Mbps for high quality
      audioBitsPerSecond: options.audioBitsPerSecond || 128000, // 128 kbps for audio
    });

    return recorder;
  } catch (error) {
    console.error('Error creating MediaRecorder:', error);
    return null;
  }
}

/**
 * Stop recording and get blob
 */
export function stopVideoRecording(recorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      resolve(blob);
    };

    recorder.onerror = (error) => {
      reject(error);
    };

    if (recorder.state === 'recording') {
      recorder.stop();
    } else {
      reject(new Error('Recorder is not recording'));
    }
  });
}

/**
 * Clean up camera stream
 */
export function stopCamera(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop();
    });
  }
}

