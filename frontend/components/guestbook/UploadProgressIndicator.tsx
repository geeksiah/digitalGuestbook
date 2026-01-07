'use client'

import { motion } from 'framer-motion'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface UploadProgressIndicatorProps {
  progress: number
  status: 'uploading' | 'success' | 'error'
  message?: string
}

export default function UploadProgressIndicator({ progress, status, message }: UploadProgressIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 p-6 bg-white border border-gray-200 rounded-xl"
    >
      <div className="flex items-center gap-3">
        {status === 'uploading' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Upload className="h-5 w-5 text-gray-600" />
          </motion.div>
        )}
        {status === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
        {status === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            {status === 'uploading' && 'Uploading your message...'}
            {status === 'success' && 'Upload complete!'}
            {status === 'error' && 'Upload failed'}
          </p>
          {message && <p className="text-xs text-gray-500 mt-1">{message}</p>}
        </div>
        {status === 'uploading' && (
          <span className="text-sm font-mono text-gray-600">{Math.round(progress)}%</span>
        )}
      </div>
      {status === 'uploading' && (
        <Progress value={progress} className="h-2" />
      )}
    </motion.div>
  )
}

