'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, Download, Play, Pause, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface VideoPlayerCardProps {
  asset: {
    id: string
    source: string
    durationSec: number | null
    createdAt: string
    downloadUrl: string
  }
  onDownload?: (assetId: string) => void
}

export default function VideoPlayerCard({ asset, onDownload }: VideoPlayerCardProps) {
  const [playing, setPlaying] = useState(false)
  const [showPlayer, setShowPlayer] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  function formatDuration(seconds: number | null): string {
    if (!seconds) return ''
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function togglePlay() {
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setPlaying(!playing)
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Video className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium text-gray-900">
                Video {asset.source === 'BOOTH' && '(Booth)'}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(asset.createdAt).toLocaleString()}
                {asset.durationSec && ` • ${formatDuration(asset.durationSec)}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPlayer(!showPlayer)}
            >
              {showPlayer ? <X className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            {onDownload && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDownload(asset.id)}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showPlayer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={asset.downloadUrl}
                  controls
                  className="w-full"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

