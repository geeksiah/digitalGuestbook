'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Camera, Mic, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PermissionGateProps {
  requiredPermissions: 'video' | 'audio' | 'both'
  onGranted: () => void
  onDenied?: () => void
}

export default function PermissionGate({ requiredPermissions, onGranted, onDenied }: PermissionGateProps) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const [preview, setPreview] = useState<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      if (preview) {
        preview.getTracks().forEach(track => track.stop())
      }
    }
  }, [preview])

  async function requestPermission() {
    setStatus('requesting')
    try {
      const constraints: MediaStreamConstraints = {}
      if (requiredPermissions === 'video' || requiredPermissions === 'both') {
        constraints.video = true
      }
      if (requiredPermissions === 'audio' || requiredPermissions === 'both') {
        constraints.audio = true
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setPreview(stream)
      setStatus('granted')
      onGranted()
    } catch (err) {
      console.error('Permission denied:', err)
      setStatus('denied')
      if (onDenied) onDenied()
    }
  }

  const needsVideo = requiredPermissions === 'video' || requiredPermissions === 'both'
  const needsAudio = requiredPermissions === 'audio' || requiredPermissions === 'both'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === 'granted' ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          )}
          Permission Required
        </CardTitle>
        <CardDescription>
          We need access to your {needsVideo && needsAudio ? 'camera and microphone' : needsVideo ? 'camera' : 'microphone'} to record your message
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'idle' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                To record your message, we need permission to access:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                {needsVideo && (
                  <li className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Camera (for video recording)
                  </li>
                )}
                {needsAudio && (
                  <li className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Microphone (for audio recording)
                  </li>
                )}
              </ul>
            </div>
            <Button onClick={requestPermission} className="w-full" size="lg">
              Grant Permission
            </Button>
          </div>
        )}

        {status === 'requesting' && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-sm text-gray-500">Requesting permission...</p>
          </div>
        )}

        {status === 'granted' && preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium mb-2">Permission granted!</p>
              <p className="text-xs text-green-600">You're ready to record</p>
            </div>
            {needsVideo && (
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  srcObject={preview}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {needsAudio && !needsVideo && (
              <div className="p-8 bg-gray-50 rounded-lg text-center">
                <Mic className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm text-gray-600">Microphone ready</p>
              </div>
            )}
          </motion.div>
        )}

        {status === 'denied' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium mb-2">Permission denied</p>
            <p className="text-xs text-red-600 mb-4">
              Please allow camera/microphone access in your browser settings and try again.
            </p>
            <Button onClick={requestPermission} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

