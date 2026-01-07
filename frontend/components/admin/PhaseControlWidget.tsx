'use client'

import { motion } from 'framer-motion'
import { Clock, Calendar, Radio } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

interface PhaseControlWidgetProps {
  initialPhase: 'AUTO' | 'PRE_EVENT' | 'LIVE' | 'POST_EVENT'
  onChange: (phase: 'AUTO' | 'PRE_EVENT' | 'LIVE' | 'POST_EVENT') => void
}

export default function PhaseControlWidget({ initialPhase, onChange }: PhaseControlWidgetProps) {
  const phases = [
    { value: 'AUTO', label: 'Automatic', description: 'Based on event date/time', icon: Clock },
    { value: 'PRE_EVENT', label: 'Pre-Event', description: 'Before event starts', icon: Calendar },
    { value: 'LIVE', label: 'Live', description: 'Event is happening now', icon: Radio },
    { value: 'POST_EVENT', label: 'Post-Event', description: 'After event ends', icon: Calendar }
  ] as const

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Initial Phase</h3>
        <p className="text-sm text-gray-500">Set how the event phase is determined</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {phases.map((phase) => {
          const Icon = phase.icon
          const isSelected = initialPhase === phase.value
          return (
            <motion.div
              key={phase.value}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`cursor-pointer transition-all ${
                  isSelected ? 'border-gray-900 bg-gray-50' : ''
                }`}
                onClick={() => onChange(phase.value)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-gray-600" />
                    <input
                      type="radio"
                      name="initialPhase"
                      value={phase.value}
                      checked={isSelected}
                      onChange={() => onChange(phase.value)}
                      className="text-gray-900"
                    />
                  </div>
                  <CardTitle className="text-base">{phase.label}</CardTitle>
                  <CardDescription>{phase.description}</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

