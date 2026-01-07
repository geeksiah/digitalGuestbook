'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Copy, Check, Calendar, Settings } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import EmptyState from '@/components/dashboard/EmptyState'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import EventCreateForm from '@/components/admin/EventCreateForm'

interface Event {
  id: string
  slug: string
  name: string
  dateTime: string
  timezone: string
  phase: string
  invitationOnly: boolean
  featureInvitationWebsite: boolean
  featureRsvp: boolean
  featureGuestbook: boolean
  coupleAccessKey: string
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string>('')

  useEffect(() => {
    // Access localStorage only on client side
    if (typeof window !== 'undefined') {
      const key = localStorage.getItem('adminApiKey') || ''
      setApiKey(key)
      if (key) {
        loadEvents(key)
      } else {
        window.location.href = '/admin'
      }
    }
  }, [])

  async function loadEvents(key?: string) {
    const authKey = key || apiKey
    if (!authKey) return
    
    try {
      const data = await apiGet<Event[]>('/v1/admin/events', {
        'x-api-key': authKey
      })
      setEvents(data)
    } catch (err) {
      console.error('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data = {
      slug: formData.get('slug'),
      name: formData.get('name'),
      dateTime: new Date(formData.get('dateTime') as string).toISOString(),
      timezone: formData.get('timezone') || 'UTC',
      invitationOnly: formData.has('invitationOnly'),
      featureInvitationWebsite: formData.has('featureInvitationWebsite'),
      featureRsvp: formData.has('featureRsvp'),
      featureGuestbook: formData.has('featureGuestbook'),
    }

    try {
      await apiPost('/v1/admin/events', data, { 'x-api-key': apiKey })
      setCreateOpen(false)
      loadEvents()
    } catch (err) {
      alert('Failed to create event: ' + (err as Error).message)
    }
  }

  function copyCoupleKey(key: string) {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Events</h1>
          <p className="text-gray-500 mt-1">Manage all events</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Event
        </motion.button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm"
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Events</h2>
          <p className="text-sm text-gray-500 mt-1">View and manage your events</p>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No events yet"
              description="Create your first event to get started"
              action={{
                label: 'Create Event',
                onClick: () => setCreateOpen(true)
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event, index) => (
                    <motion.tr
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b hover:bg-gray-50"
                    >
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell className="text-gray-500">{event.slug}</TableCell>
                      <TableCell>
                        {new Date(event.dateTime).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          event.phase === 'LIVE' ? 'bg-green-100 text-green-800' :
                          event.phase === 'POST_EVENT' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {event.phase || 'PRE_EVENT'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {event.featureRsvp && <span className="mr-2">RSVP</span>}
                        {event.featureGuestbook && <span>Guestbook</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => window.location.href = `/admin/events/${event.id}`}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => copyCoupleKey(event.coupleAccessKey)}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                          >
                            {copiedKey === event.coupleAccessKey ? (
                              <>
                                <Check className="h-4 w-4 text-green-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy Key
                              </>
                            )}
                          </motion.button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>
              Configure a new event for your platform
            </DialogDescription>
          </DialogHeader>
          <EventCreateForm
            onSubmit={async (data) => {
              try {
                await apiPost('/v1/admin/events', {
                  slug: data.slug,
                  name: data.name,
                  dateTime: data.dateTime,
                  timezone: data.timezone,
                  invitationOnly: data.invitationOnly,
                  featureInvitationWebsite: data.featureInvitationWebsite,
                  featureRsvp: data.featureRsvp,
                  featureGuestbook: data.featureGuestbook
                }, { 'x-api-key': apiKey })
                setCreateOpen(false)
                loadEvents()
              } catch (err) {
                throw err
              }
            }}
            onCancel={() => setCreateOpen(false)}
            loading={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

