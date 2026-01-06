'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Calendar, Settings, FileText, CheckCircle, XCircle } from 'lucide-react'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Event {
  id: string
  slug: string
  name: string
  dateTime: string
  timezone: string
  phase: string
  activePhase?: string
  invitationOnly: boolean
  featureInvitationWebsite: boolean
  featureRsvp: boolean
  featureGuestbook: boolean
  manualPhaseOverride: string | null
}

interface Template {
  id: string
  name: string
  type: string
  version: number
}

interface TemplateAssignment {
  id: string
  templateType: string
  template: Template
}

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const apiKey = localStorage.getItem('adminApiKey') || ''
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phaseOverrideOpen, setPhaseOverrideOpen] = useState(false)
  const [templateAssignOpen, setTemplateAssignOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [assignments, setAssignments] = useState<TemplateAssignment[]>([])
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>('')

  useEffect(() => {
    if (apiKey && eventId) {
      loadEvent()
      loadTemplates()
      loadAssignments()
    } else {
      router.push('/admin')
    }
  }, [apiKey, eventId])

  async function loadEvent() {
    try {
      const data = await apiGet<Event>(`/v1/admin/events/${eventId}`, {
        'x-api-key': apiKey
      })
      setEvent(data)
    } catch (err) {
      console.error('Failed to load event:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadTemplates() {
    try {
      const data = await apiGet<Template[]>('/v1/admin/templates', {
        'x-api-key': apiKey
      })
      setTemplates(data)
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  async function loadAssignments() {
    try {
      const data = await apiGet<TemplateAssignment[]>(`/v1/admin/events/${eventId}/templates`, {
        'x-api-key': apiKey
      })
      setAssignments(data)
    } catch (err) {
      console.error('Failed to load assignments:', err)
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const data: any = {}
    
    if (formData.get('name')) data.name = formData.get('name')
    if (formData.get('slug')) data.slug = formData.get('slug')
    if (formData.get('dateTime')) data.dateTime = new Date(formData.get('dateTime') as string).toISOString()
    if (formData.get('timezone')) data.timezone = formData.get('timezone')
    data.invitationOnly = formData.has('invitationOnly')
    data.featureInvitationWebsite = formData.has('featureInvitationWebsite')
    data.featureRsvp = formData.has('featureRsvp')
    data.featureGuestbook = formData.has('featureGuestbook')

    try {
      await apiPatch(`/v1/admin/events/${eventId}`, data, {
        'x-api-key': apiKey
      })
      loadEvent()
      alert('Event updated successfully')
    } catch (err) {
      alert('Failed to update: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePhaseOverride(phase: string | null) {
    try {
      await apiPost(`/v1/admin/events/${eventId}/phase-override`, { phase }, {
        'x-api-key': apiKey
      })
      loadEvent()
      setPhaseOverrideOpen(false)
    } catch (err) {
      alert('Failed to override phase: ' + (err as Error).message)
    }
  }

  async function handleTemplateAssign(templateId: string) {
    try {
      await apiPost(`/v1/admin/events/${eventId}/templates/assign`, {
        templateType: selectedTemplateType,
        templateId
      }, {
        'x-api-key': apiKey
      })
      loadAssignments()
      setTemplateAssignOpen(false)
    } catch (err) {
      alert('Failed to assign template: ' + (err as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading event...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Event not found</p>
          <Button onClick={() => router.push('/admin/events')}>Back to Events</Button>
        </div>
      </div>
    )
  }

  const activePhase = event.activePhase || event.phase

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="outline" onClick={() => router.push('/admin/events')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{event.name}</h1>
          <p className="text-gray-500 mt-1">Event ID: {event.id}</p>
        </div>
      </motion.div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="phase">Phase Control</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 shadow-sm"
          >
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
              <CardDescription>Update event information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Event Name</Label>
                    <Input id="name" name="name" defaultValue={event.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input id="slug" name="slug" defaultValue={event.slug} required />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateTime">Date & Time</Label>
                    <Input
                      id="dateTime"
                      name="dateTime"
                      type="datetime-local"
                      defaultValue={new Date(event.dateTime).toISOString().slice(0, 16)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input id="timezone" name="timezone" defaultValue={event.timezone} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="invitationOnly" name="invitationOnly" defaultChecked={event.invitationOnly} />
                    <Label htmlFor="invitationOnly">Invitation Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="featureInvitationWebsite" name="featureInvitationWebsite" defaultChecked={event.featureInvitationWebsite} />
                    <Label htmlFor="featureInvitationWebsite">Invitation Website</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="featureRsvp" name="featureRsvp" defaultChecked={event.featureRsvp} />
                    <Label htmlFor="featureRsvp">RSVP System</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="featureGuestbook" name="featureGuestbook" defaultChecked={event.featureGuestbook} />
                    <Label htmlFor="featureGuestbook">Digital Guestbook</Label>
                  </div>
                </div>
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </motion.div>
        </TabsContent>

        <TabsContent value="phase" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
          >
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Current Phase</h3>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                    activePhase === 'LIVE' ? 'bg-green-100 text-green-800' :
                    activePhase === 'POST_EVENT' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {activePhase || 'PRE_EVENT'}
                  </span>
                  {event.manualPhaseOverride && (
                    <span className="text-sm text-gray-500">(Manually overridden)</span>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Phase Override</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Manually override the event phase. Leave as "Automatic" to use date-based phase switching.
                </p>
                <Button onClick={() => setPhaseOverrideOpen(true)} variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Override Phase
                </Button>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Template Assignments</h3>
                <p className="text-sm text-gray-500 mt-1">Assign templates to this event's pages</p>
              </div>
              <Button onClick={() => setTemplateAssignOpen(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Assign Template
              </Button>
            </div>
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{assignment.template.name}</p>
                    <p className="text-sm text-gray-500">{assignment.templateType}</p>
                  </div>
                </div>
              ))}
              {assignments.length === 0 && (
                <p className="text-center text-gray-500 py-8">No templates assigned</p>
              )}
            </div>
            <div className="mt-6 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => router.push(`/admin/events/${eventId}/devices`)}
                className="w-full"
              >
                Manage Check-In Devices
              </Button>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      <Dialog open={phaseOverrideOpen} onOpenChange={setPhaseOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Event Phase</DialogTitle>
            <DialogDescription>
              Manually set the event phase or reset to automatic
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Phase</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(e) => {
                  const value = e.target.value
                  handlePhaseOverride(value === 'AUTOMATIC' ? null : value)
                }}
              >
                <option value="AUTOMATIC">Automatic (based on date)</option>
                <option value="PRE_EVENT">Pre-Event</option>
                <option value="LIVE">Live</option>
                <option value="POST_EVENT">Post-Event</option>
              </select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templateAssignOpen} onOpenChange={setTemplateAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Template</DialogTitle>
            <DialogDescription>
              Assign a template to a page type for this event
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const templateId = formData.get('templateId') as string
              if (templateId && selectedTemplateType) {
                handleTemplateAssign(templateId)
              }
            }}
            className="space-y-4 py-4"
          >
            <div className="space-y-2">
              <Label>Template Type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedTemplateType}
                onChange={(e) => setSelectedTemplateType(e.target.value)}
                required
              >
                <option value="">Select type...</option>
                <option value="INVITATION">Invitation</option>
                <option value="RSVP">RSVP</option>
                <option value="GUESTBOOK">Guestbook</option>
                <option value="THANK_YOU">Thank You</option>
              </select>
            </div>
            {selectedTemplateType && (
              <div className="space-y-2">
                <Label>Template</Label>
                <select
                  name="templateId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select template...</option>
                  {templates
                    .filter(t => t.type === selectedTemplateType)
                    .map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name} (v{template.version})
                      </option>
                    ))}
                </select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTemplateAssignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Assign</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

