'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Film, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ReelGenerationPanelProps {
  eventId: string
  onGenerate: () => Promise<string> // Returns download URL
}

export default function ReelGenerationPanel({ eventId, onGenerate }: ReelGenerationPanelProps) {
  const [generating, setGenerating] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setDownloadUrl(null)

    try {
      const url = await onGenerate()
      setDownloadUrl(url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload() {
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `event-reel-${eventId}.mp4`
    a.click()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          Premium Reel Generation
        </CardTitle>
        <CardDescription>
          Generate a curated video reel from all guestbook submissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!downloadUrl ? (
          <>
            <p className="text-sm text-gray-600">
              Create a beautiful compilation video from all guest messages. This process may take a few minutes.
            </p>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Reel...
                </>
              ) : (
                <>
                  <Film className="h-5 w-5 mr-2" />
                  Generate Reel
                </>
              )}
            </Button>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4"
          >
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-800 mb-2">Reel Generated Successfully!</p>
              <p className="text-xs text-green-600">Your premium reel is ready to download</p>
            </div>
            <Button onClick={handleDownload} className="w-full" size="lg">
              <Download className="h-5 w-5 mr-2" />
              Download Reel (MP4)
            </Button>
            <Button
              onClick={() => {
                setDownloadUrl(null)
                setError(null)
              }}
              variant="outline"
              className="w-full"
            >
              Generate New Reel
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}

