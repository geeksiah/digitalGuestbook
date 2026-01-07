'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, Mic, Image as ImageIcon, Camera, CheckCircle, AlertCircle, Upload, Clock, X } from 'lucide-react'
import { apiPost } from '@/lib/api'
import GuestModeSelector from './GuestModeSelector'
import PermissionGate from './PermissionGate'
import RecordingProgressOverlay from './RecordingProgressOverlay'
import UploadProgressIndicator from './UploadProgressIndicator'
import AudioRecorder from './AudioRecorder'

const MAX_VIDEO_DURATION = 120 // 2 minutes
const MAX_AUDIO_DURATION = 180 // 3 minutes
const MAX_PHOTOS = 5

type Mode = 'VIDEO' | 'AUDIO' | 'PHOTO' | null
type Step = 'mode-selection' | 'permission' | 'recording' | 'uploading' | 'success'

interface GuestbookFlowProps {
  eventSlug: string
  isBoothMode?: boolean
}

export default function GuestbookFlow({ eventSlug, isBoothMode = false }: GuestbookFlowProps) {
  const [step, setStep] = useState<Step>('mode-selection')
  const [mode, setMode] = useState<Mode>(null)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [photoCount, setPhotoCount] = useState(0)
  const [permissionGranted, setPermissionGranted] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Recording timer
  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const maxDuration = mode === 'VIDEO' ? MAX_VIDEO_DURATION : MAX_AUDIO_DURATION
          if (prev >= maxDuration) {
            stopRecording()
            return maxDuration
          }
          return prev + 1
        })
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [recording, mode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  async function requestPermission() {
    if (!mode || mode === 'PHOTO') {
      setPermissionGranted(true)
      setStep('recording')
      return
    }

    try {
      const constraints = mode === 'VIDEO' 
        ? { video: true, audio: true } 
        : { audio: true }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      
      if (videoRef.current && mode === 'VIDEO') {
        videoRef.current.srcObject = stream
      }
      
      setPermissionGranted(true)
      setStep('recording')
    } catch (err) {
      setError('Camera or microphone access is required. Please allow access and try again.')
    }
  }

  function startRecording() {
    if (!streamRef.current || !mode || mode === 'PHOTO') return

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      setRecordingTime(0)
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      
      mediaRecorder.start()
      setRecording(true)
    } catch (err) {
      setError('Failed to start recording. Please try again.')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  async function handleUpload(file?: File) {
    if (!mode) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)
    setStep('uploading')

    let fileToUpload = file
    if (!fileToUpload && chunksRef.current.length > 0) {
      const blob = new Blob(chunksRef.current, { 
        type: mode === 'VIDEO' ? 'video/webm' : 'audio/webm' 
      })
      fileToUpload = new File([blob], 'recording.webm', { type: blob.type })
    }

    if (!fileToUpload) {
      setError('Please record or select a file')
      setUploading(false)
      return
    }

    if (fileToUpload.size > 200 * 1024 * 1024) {
      setError('File size exceeds 200MB limit. Please record a shorter message.')
      setUploading(false)
      return
    }

    try {
      const init = await apiPost<{ assetId: string; uploadUrl: string }>('/v1/media/upload-init', {
        eventSlug,
        type: mode,
        source: isBoothMode ? 'BOOTH' : 'PERSONAL',
        durationSec: mode !== 'PHOTO' ? recordingTime : undefined
      })

      const formData = new FormData()
      formData.append('file', fileToUpload)

      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setStep('success')
            chunksRef.current = []
            setRecordingTime(0)
            if (mode === 'PHOTO') {
              setPhotoCount(prev => prev + 1)
            }
            setUploading(false)
            
            if (isBoothMode) {
              setTimeout(() => {
                resetFlow()
              }, 3000)
            }
            resolve()
          } else {
            throw new Error(`Upload failed: ${xhr.statusText}`)
          }
        })

        xhr.addEventListener('error', () => {
          setError('Upload failed. Please check your connection and try again.')
          setUploading(false)
          reject(new Error('Upload failed'))
        })

        xhr.timeout = 60000
        xhr.open('POST', `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'}${init.uploadUrl}`)
        xhr.send(formData)
      })
    } catch (err) {
      setError((err as Error).message)
      setUploading(false)
    }
  }

  function resetFlow() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setStep('mode-selection')
    setMode(null)
    setRecording(false)
    setRecordingTime(0)
    setUploading(false)
    setUploadProgress(0)
    setError(null)
    chunksRef.current = []
  }

  return (
    <div className={`${isBoothMode ? 'fixed inset-0' : 'min-h-screen'} bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4`}>
      {recording && mode && mode !== 'PHOTO' && (
        <RecordingProgressOverlay
          duration={recordingTime}
          maxDuration={mode === 'VIDEO' ? MAX_VIDEO_DURATION : MAX_AUDIO_DURATION}
          isRecording={recording}
        />
      )}
      <div className="w-full max-w-4xl">
        <AnimatePresence mode="wait">
          {/* Step 1: Mode Selection */}
          {step === 'mode-selection' && (
            <motion.div
              key="mode-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2 mb-8">
                <h1 className="text-4xl font-semibold text-gray-900">Leave a Message</h1>
                <p className="text-gray-600">Choose how you'd like to share your thoughts</p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMode('VIDEO')
                    setStep('permission')
                  }}
                  className="group relative p-8 bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-900 transition-all shadow-lg hover:shadow-xl"
                >
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-gray-100 rounded-full group-hover:bg-gray-900 transition-colors">
                      <Video className="h-8 w-8 text-gray-900 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Video Message</h3>
                      <p className="text-sm text-gray-600">Record a personal video message</p>
                      <p className="text-xs text-gray-500 mt-2">Up to 2 minutes</p>
                    </div>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMode('AUDIO')
                    setStep('permission')
                  }}
                  className="group relative p-8 bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-900 transition-all shadow-lg hover:shadow-xl"
                >
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-gray-100 rounded-full group-hover:bg-gray-900 transition-colors">
                      <Mic className="h-8 w-8 text-gray-900 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Audio Message</h3>
                      <p className="text-sm text-gray-600">Record an audio message</p>
                      <p className="text-xs text-gray-500 mt-2">Up to 3 minutes</p>
                    </div>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMode('PHOTO')
                    setStep('recording')
                  }}
                  className="group relative p-8 bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-900 transition-all shadow-lg hover:shadow-xl"
                >
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-gray-100 rounded-full group-hover:bg-gray-900 transition-colors">
                      <ImageIcon className="h-8 w-8 text-gray-900 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Photo</h3>
                      <p className="text-sm text-gray-600">Upload a photo</p>
                      <p className="text-xs text-gray-500 mt-2">Up to {MAX_PHOTOS} photos</p>
                    </div>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Permission Request */}
          {step === 'permission' && mode && mode !== 'PHOTO' && (
            <motion.div
              key="permission"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto"
            >
              <PermissionGate
                requiredPermissions={mode === 'VIDEO' ? 'both' : 'audio'}
                onGranted={() => {
                  setPermissionGranted(true)
                  setStep('recording')
                }}
                onDenied={() => {
                  setError('Permission denied. Please allow access and try again.')
                }}
              />
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setStep('mode-selection')}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Recording Interface */}
          {step === 'recording' && mode && (
            <motion.div
              key="recording"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {mode === 'PHOTO' ? (
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto">
                  <div className="text-center space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Upload Photo</h2>
                      <p className="text-gray-600 mb-4">
                        {photoCount < MAX_PHOTOS 
                          ? `You can upload ${MAX_PHOTOS - photoCount} more photo${MAX_PHOTOS - photoCount !== 1 ? 's' : ''}`
                          : `Upload limit reached (${MAX_PHOTOS} photos)`
                        }
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture
                      disabled={photoCount >= MAX_PHOTOS || uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file && photoCount < MAX_PHOTOS) {
                          handleUpload(file)
                        }
                        e.target.value = ''
                      }}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 transition-colors cursor-pointer"
                    />
                    {error && (
                      <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm">
                        {error}
                      </div>
                    )}
                    <button
                      onClick={() => setStep('mode-selection')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                  {/* Video Preview */}
                  {mode === 'VIDEO' && (
                    <div className="relative bg-black aspect-video">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {recording && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="w-20 h-20 border-4 border-red-500 rounded-full flex items-center justify-center"
                          >
                            <div className="w-12 h-12 bg-red-500 rounded-full" />
                          </motion.div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Controls */}
                  <div className="p-8 space-y-6">
                    {/* Timer */}
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-5 w-5 text-gray-600" />
                      <span className="text-2xl font-semibold text-gray-900">
                        {formatTime(recordingTime)}
                      </span>
                      <span className="text-gray-500">
                        / {formatTime(mode === 'VIDEO' ? MAX_VIDEO_DURATION : MAX_AUDIO_DURATION)}
                      </span>
                    </div>

                    {/* Recording Button */}
                    {!recording ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={startRecording}
                        className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold text-lg hover:bg-gray-800 transition-colors"
                      >
                        Start Recording
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={stopRecording}
                        className="w-full py-4 bg-red-600 text-white rounded-xl font-semibold text-lg hover:bg-red-700 transition-colors"
                      >
                        Stop Recording
                      </motion.button>
                    )}

                    {/* Upload Button */}
                    {chunksRef.current.length > 0 && !recording && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleUpload()}
                        disabled={uploading}
                        className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        Upload Recording
                      </motion.button>
                    )}

                    {error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (streamRef.current) {
                          streamRef.current.getTracks().forEach(track => track.stop())
                          streamRef.current = null
                        }
                        setStep('mode-selection')
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 4: Uploading */}
          {step === 'uploading' && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto"
            >
              <UploadProgressIndicator
                progress={uploadProgress}
                status="uploading"
                message="Please wait while we save your message..."
              />
            </motion.div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto text-center space-y-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="flex justify-center"
              >
                <div className="p-4 bg-green-100 rounded-full">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
              </motion.div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Thank You!</h2>
                <p className="text-gray-600">Your message has been uploaded successfully.</p>
              </div>
              {!isBoothMode && (
                <button
                  onClick={resetFlow}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  Leave Another Message
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

