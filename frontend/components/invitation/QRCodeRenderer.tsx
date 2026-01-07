'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { QrCode, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QRCodeRendererProps {
  qrPayload: string
  size?: number
  showDownload?: boolean
}

export default function QRCodeRenderer({ qrPayload, size = 200, showDownload = false }: QRCodeRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function generateQR() {
      if (!canvasRef.current || !qrPayload) return

      try {
        // Dynamic import of qrcode library
        const QRCode = (await import('qrcode')).default
        await QRCode.toCanvas(canvasRef.current, qrPayload, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        setError(null)
      } catch (err) {
        console.error('QR generation error:', err)
        setError('Failed to generate QR code')
      }
    }

    generateQR()
  }, [qrPayload, size])

  function handleDownload() {
    if (!canvasRef.current) return
    const url = canvasRef.current.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'invitation-qr.png'
    a.click()
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 bg-white border border-gray-200 rounded-lg"
      >
        <canvas ref={canvasRef} className="block" />
      </motion.div>
      {showDownload && (
        <Button onClick={handleDownload} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download QR
        </Button>
      )}
    </div>
  )
}

