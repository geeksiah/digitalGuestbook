'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import QRCodeRenderer from './QRCodeRenderer'

interface InvitationCardPreviewProps {
  invitation: {
    id: string
    sixDigitCode: string
    qrPayload: string
    attendeeToken: string
  }
  eventName: string
  onDownload?: () => void
}

export default function InvitationCardPreview({ invitation, eventName, onDownload }: InvitationCardPreviewProps) {
  const [previewMode, setPreviewMode] = useState(false)

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Invitation Card</CardTitle>
        <CardDescription>Preview and download invitation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">{eventName}</h3>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">6-Digit Code</p>
            <p className="text-3xl font-mono font-bold text-gray-900 tracking-widest">
              {invitation.sixDigitCode}
            </p>
          </div>
          <QRCodeRenderer qrPayload={invitation.qrPayload} size={180} />
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setPreviewMode(!previewMode)} variant="outline" className="flex-1">
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Hide' : 'Preview'} PDF
          </Button>
          {onDownload && (
            <Button onClick={onDownload} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
        {previewMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 bg-gray-50 rounded-lg"
          >
            <p className="text-xs text-gray-500">
              PDF preview would show here. Click Download to get the full invitation card.
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}

