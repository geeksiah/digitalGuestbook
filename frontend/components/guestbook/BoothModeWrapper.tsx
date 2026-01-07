'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface BoothModeWrapperProps {
  children: React.ReactNode
  onReset?: () => void
  autoResetDelay?: number
}

export default function BoothModeWrapper({ children, onReset, autoResetDelay = 30000 }: BoothModeWrapperProps) {
  useEffect(() => {
    // Prevent navigation
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Auto-reset after delay
    let resetTimer: NodeJS.Timeout | null = null
    if (autoResetDelay > 0 && onReset) {
      resetTimer = setTimeout(() => {
        onReset()
      }, autoResetDelay)
    }

    // Fullscreen on mobile
    if ('requestFullscreen' in document.documentElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (resetTimer) clearTimeout(resetTimer)
    }
  }, [autoResetDelay, onReset])

  return (
    <div className="fixed inset-0 bg-gray-900 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full w-full flex items-center justify-center p-4"
      >
        {children}
      </motion.div>
    </div>
  )
}

