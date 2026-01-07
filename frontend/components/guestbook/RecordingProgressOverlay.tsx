'use client'

import { motion } from 'framer-motion'
import { Radio } from 'lucide-react'

interface RecordingProgressOverlayProps {
  duration: number
  maxDuration: number
  isRecording: boolean
}

export default function RecordingProgressOverlay({ duration, maxDuration, isRecording }: RecordingProgressOverlayProps) {
  const progress = (duration / maxDuration) * 100
  const isNearLimit = progress > 80

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
    >
      <div className={`
        px-6 py-4 rounded-full shadow-lg backdrop-blur-sm
        ${isNearLimit ? 'bg-red-500/90 text-white' : 'bg-gray-900/90 text-white'}
        flex items-center gap-3
      `}>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Radio className="h-5 w-5" />
        </motion.div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-mono font-bold">{formatTime(duration)}</span>
          <span className="text-sm opacity-80">/ {formatTime(maxDuration)}</span>
        </div>
        <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${isNearLimit ? 'bg-white' : 'bg-white'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  )
}

