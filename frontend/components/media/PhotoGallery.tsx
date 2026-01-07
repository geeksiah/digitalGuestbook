'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PhotoAsset {
  id: string
  downloadUrl: string
  createdAt: string
  source?: string
}

interface PhotoGalleryProps {
  assets: PhotoAsset[]
  onDownload?: (assetId: string) => void
}

export default function PhotoGallery({ assets, onDownload }: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  function openLightbox(index: number) {
    setSelectedIndex(index)
  }

  function closeLightbox() {
    setSelectedIndex(null)
  }

  function navigate(direction: 'prev' | 'next') {
    if (selectedIndex === null) return
    if (direction === 'prev') {
      setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : assets.length - 1)
    } else {
      setSelectedIndex(selectedIndex < assets.length - 1 ? selectedIndex + 1 : 0)
    }
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No photos available</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((asset, index) => (
          <motion.div
            key={asset.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="relative group cursor-pointer"
            onClick={() => openLightbox(index)}
          >
            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
              <img
                src={asset.downloadUrl}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
              <ImageIcon className="h-8 w-8 text-white" />
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-5xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={assets[selectedIndex].downloadUrl}
                alt={`Photo ${selectedIndex + 1}`}
                className="max-w-full max-h-[90vh] object-contain"
              />
              <button
                onClick={closeLightbox}
                className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              {assets.length > 1 && (
                <>
                  <button
                    onClick={() => navigate('prev')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={() => navigate('next')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
              {onDownload && (
                <button
                  onClick={() => onDownload(assets[selectedIndex].id)}
                  className="absolute bottom-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                >
                  <Download className="h-6 w-6" />
                </button>
              )}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
                {selectedIndex + 1} / {assets.length}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

