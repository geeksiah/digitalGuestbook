'use client'

import { motion } from 'framer-motion'
import { Globe, Users, Heart } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

interface ServiceTogglePanelProps {
  features: {
    invitationWebsite: boolean
    rsvp: boolean
    guestbook: boolean
  }
  onChange: (features: { featureInvitationWebsite: boolean; featureRsvp: boolean; featureGuestbook: boolean }) => void
}

export default function ServiceTogglePanel({ features, onChange }: ServiceTogglePanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Event Services</h3>
        <p className="text-sm text-gray-500">Select which services to enable for this event</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card className={`cursor-pointer transition-all ${features.invitationWebsite ? 'border-gray-900 bg-gray-50' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Globe className="h-5 w-5 text-gray-600" />
                <input
                  type="checkbox"
                  checked={features.invitationWebsite}
                  onChange={(e) => onChange({ ...features, featureInvitationWebsite: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </div>
              <CardTitle className="text-base">Invitation Website</CardTitle>
              <CardDescription>Public-facing event invitation page</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card className={`cursor-pointer transition-all ${features.rsvp ? 'border-gray-900 bg-gray-50' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Users className="h-5 w-5 text-gray-600" />
                <input
                  type="checkbox"
                  checked={features.rsvp}
                  onChange={(e) => onChange({ ...features, featureRsvp: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </div>
              <CardTitle className="text-base">RSVP System</CardTitle>
              <CardDescription>Guest response and attendance tracking</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card className={`cursor-pointer transition-all ${features.guestbook ? 'border-gray-900 bg-gray-50' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Heart className="h-5 w-5 text-gray-600" />
                <input
                  type="checkbox"
                  checked={features.guestbook}
                  onChange={(e) => onChange({ ...features, featureGuestbook: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </div>
              <CardTitle className="text-base">Digital Guestbook</CardTitle>
              <CardDescription>Video, audio, and photo submissions</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

