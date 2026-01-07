'use client'

import { motion } from 'framer-motion'
import { Mail, MessageSquare, Phone } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface CommunicationSettingsPanelProps {
  defaults: {
    email: boolean
    sms: boolean
    whatsapp: boolean
  }
  onChange: (defaults: { email: boolean; sms: boolean; whatsapp: boolean }) => void
}

export default function CommunicationSettingsPanel({ defaults, onChange }: CommunicationSettingsPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Communication Defaults</h3>
        <p className="text-sm text-gray-500">Set default communication channels for this event</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card className={`cursor-pointer transition-all ${defaults.email ? 'border-gray-900 bg-gray-50' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Mail className="h-5 w-5 text-gray-600" />
                <input
                  type="checkbox"
                  checked={defaults.email}
                  onChange={(e) => onChange({ ...defaults, email: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </div>
              <CardTitle className="text-base">Email</CardTitle>
              <CardDescription>Send notifications via email</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card className={`cursor-pointer transition-all ${defaults.sms ? 'border-gray-900 bg-gray-50' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <MessageSquare className="h-5 w-5 text-gray-600" />
                <input
                  type="checkbox"
                  checked={defaults.sms}
                  onChange={(e) => onChange({ ...defaults, sms: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </div>
              <CardTitle className="text-base">SMS</CardTitle>
              <CardDescription>Send notifications via SMS</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card className={`cursor-pointer transition-all ${defaults.whatsapp ? 'border-gray-900 bg-gray-50' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Phone className="h-5 w-5 text-gray-600" />
                <input
                  type="checkbox"
                  checked={defaults.whatsapp}
                  onChange={(e) => onChange({ ...defaults, whatsapp: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </div>
              <CardTitle className="text-base">WhatsApp</CardTitle>
              <CardDescription>Send notifications via WhatsApp</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

