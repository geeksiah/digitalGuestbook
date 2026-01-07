'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Mail, MessageSquare, Phone, Globe, Settings } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ServiceTogglePanel from './ServiceTogglePanel'
import CommunicationSettingsPanel from './CommunicationSettingsPanel'
import PhaseControlWidget from './PhaseControlWidget'

interface EventCreateFormProps {
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function EventCreateForm({ onSubmit, onCancel, loading }: EventCreateFormProps) {
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    dateTime: '',
    timezone: 'UTC',
    description: '',
    invitationOnly: false,
    featureInvitationWebsite: false,
    featureRsvp: false,
    featureGuestbook: false,
    communicationDefaults: {
      email: true,
      sms: false,
      whatsapp: false
    },
    initialPhase: 'AUTO' as 'AUTO' | 'PRE_EVENT' | 'LIVE' | 'POST_EVENT'
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const newErrors: Record<string, string> = {}
    if (!formData.slug.trim()) newErrors.slug = 'Slug is required'
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.dateTime) newErrors.dateTime = 'Date and time is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const submitData = {
      ...formData,
      dateTime: new Date(formData.dateTime).toISOString()
    }
    await onSubmit(submitData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="phase">Phase</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Event Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="demo-wedding"
                required
              />
              {errors.slug && <p className="text-sm text-red-600">{errors.slug}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Demo Wedding"
                required
              />
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Event description..."
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateTime">Date & Time *</Label>
              <Input
                id="dateTime"
                type="datetime-local"
                value={formData.dateTime}
                onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                required
              />
              {errors.dateTime && <p className="text-sm text-red-600">{errors.dateTime}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                placeholder="UTC"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="invitationOnly"
              checked={formData.invitationOnly}
              onChange={(e) => setFormData({ ...formData, invitationOnly: e.target.checked })}
              className="rounded border-gray-300"
            />
            <Label htmlFor="invitationOnly">Invitation Only Event</Label>
          </div>
        </TabsContent>

        <TabsContent value="services">
          <ServiceTogglePanel
            features={{
              invitationWebsite: formData.featureInvitationWebsite,
              rsvp: formData.featureRsvp,
              guestbook: formData.featureGuestbook
            }}
            onChange={(features) => setFormData({ ...formData, ...features })}
          />
        </TabsContent>

        <TabsContent value="communication">
          <CommunicationSettingsPanel
            defaults={formData.communicationDefaults}
            onChange={(defaults) => setFormData({ ...formData, communicationDefaults: defaults })}
          />
        </TabsContent>

        <TabsContent value="phase">
          <PhaseControlWidget
            initialPhase={formData.initialPhase}
            onChange={(phase) => setFormData({ ...formData, initialPhase: phase })}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Event'}
        </Button>
      </div>
    </form>
  )
}

