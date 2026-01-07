'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
import { useEffect } from 'react'

interface CheckInResultToastProps {
  type: 'success' | 'error' | 'warning'
  message: string
  partyName?: string
  onClose: () => void
  duration?: number
}

export default function CheckInResultToast({
  type,
  message,
  partyName,
  onClose,
  duration = 5000
}: CheckInResultToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-600'
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600'
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600'
    }
  }

  const { icon: Icon, bgColor, borderColor, textColor, iconColor } = config[type]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className={`
          fixed top-4 right-4 z-50
          ${bgColor} ${borderColor} border-2
          rounded-lg shadow-lg p-4
          max-w-sm
        `}
      >
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 ${iconColor} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <p className={`font-medium ${textColor}`}>{message}</p>
            {partyName && (
              <p className={`text-sm mt-1 ${textColor} opacity-80`}>{partyName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className={`${textColor} opacity-60 hover:opacity-100 transition-opacity`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

