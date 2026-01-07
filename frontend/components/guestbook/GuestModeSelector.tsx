'use client'

import { motion } from 'framer-motion'
import { Video, Mic, Image as ImageIcon, Heart } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface GuestModeSelectorProps {
  onSelect: (mode: 'VIDEO' | 'AUDIO' | 'PHOTO') => void
}

export default function GuestModeSelector({ onSelect }: GuestModeSelectorProps) {
  const modes = [
    {
      type: 'VIDEO' as const,
      icon: Video,
      title: 'Video Message',
      description: 'Record a personal video message',
      color: 'from-red-500 to-pink-500'
    },
    {
      type: 'AUDIO' as const,
      icon: Mic,
      title: 'Audio Message',
      description: 'Record an audio message',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      type: 'PHOTO' as const,
      icon: ImageIcon,
      title: 'Photo Upload',
      description: 'Share photos from the event',
      color: 'from-green-500 to-emerald-500'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">How would you like to share?</h2>
        <p className="text-gray-600">Choose how you want to leave your message</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {modes.map((mode, index) => {
          const Icon = mode.icon
          return (
            <motion.div
              key={mode.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Card
                className="cursor-pointer transition-all hover:shadow-lg border-2 hover:border-gray-900"
                onClick={() => onSelect(mode.type)}
              >
                <CardHeader>
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${mode.color} flex items-center justify-center mb-4 mx-auto`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-center">{mode.title}</CardTitle>
                  <CardDescription className="text-center">{mode.description}</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

