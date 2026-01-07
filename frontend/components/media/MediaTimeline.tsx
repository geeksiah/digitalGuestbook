'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Video, Mic, Image as ImageIcon, Download, Play, Filter } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import VideoPlayerCard from './VideoPlayerCard'
import AudioPlayerCard from './AudioPlayerCard'
import PhotoGallery from './PhotoGallery'
import MediaFilterControls from './MediaFilterControls'
import EmptyState from '@/components/dashboard/EmptyState'

interface MediaAsset {
  id: string
  type: 'VIDEO' | 'AUDIO' | 'PHOTO'
  source: 'PERSONAL' | 'BOOTH'
  durationSec: number | null
  createdAt: string
  downloadUrl: string
}

interface MediaTimelineProps {
  assets: MediaAsset[]
  onDownload?: (assetId: string) => void
  onDownloadAll?: () => void
  loading?: boolean
}

export default function MediaTimeline({ assets, onDownload, onDownloadAll, loading }: MediaTimelineProps) {
  const [filter, setFilter] = useState<'ALL' | 'VIDEO' | 'AUDIO' | 'PHOTO'>('ALL')
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'PERSONAL' | 'BOOTH'>('ALL')

  const filteredAssets = assets.filter(asset => {
    if (filter !== 'ALL' && asset.type !== filter) return false
    if (sourceFilter !== 'ALL' && asset.source !== sourceFilter) return false
    return true
  })

  const videos = filteredAssets.filter(a => a.type === 'VIDEO')
  const audios = filteredAssets.filter(a => a.type === 'AUDIO')
  const photos = filteredAssets.filter(a => a.type === 'PHOTO')

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading media...</div>
  }

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="No media submissions yet"
        description="Guest messages will appear here"
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Media Timeline</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filteredAssets.length} of {assets.length} items
          </p>
        </div>
        {onDownloadAll && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDownloadAll}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download All
          </motion.button>
        )}
      </div>

      <MediaFilterControls
        typeFilter={filter}
        sourceFilter={sourceFilter}
        onTypeFilterChange={setFilter}
        onSourceFilterChange={setSourceFilter}
      />

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All ({filteredAssets.length})</TabsTrigger>
          <TabsTrigger value="videos">Videos ({videos.length})</TabsTrigger>
          <TabsTrigger value="audios">Audio ({audios.length})</TabsTrigger>
          <TabsTrigger value="photos">Photos ({photos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          <div className="space-y-6">
            {filteredAssets.map((asset, index) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {asset.type === 'VIDEO' && (
                  <VideoPlayerCard asset={asset} onDownload={onDownload} />
                )}
                {asset.type === 'AUDIO' && (
                  <AudioPlayerCard asset={asset} onDownload={onDownload} />
                )}
                {asset.type === 'PHOTO' && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <PhotoGallery assets={[asset]} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="space-y-6">
          {videos.map((asset, index) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <VideoPlayerCard asset={asset} onDownload={onDownload} />
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="audios" className="space-y-6">
          {audios.map((asset, index) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <AudioPlayerCard asset={asset} onDownload={onDownload} />
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="photos">
          <PhotoGallery assets={photos} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

