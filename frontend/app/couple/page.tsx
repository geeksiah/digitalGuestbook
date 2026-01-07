'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Image, MessageSquare, Clock, Download, Heart } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import EmptyState from '@/components/dashboard/EmptyState'
import StatCard from '@/components/dashboard/StatCard'
import { apiGet, apiPost } from '@/lib/api'
import RSVPApprovalTable from '@/components/rsvp/RSVPApprovalTable'
import MediaTimeline from '@/components/media/MediaTimeline'

interface RSVP {
  id: string
  partyName: string
  response: string
  status: string
  guestCount: number
  createdAt: string
}

interface MediaAsset {
  id: string
  type: string
  source: string
  durationSec: number | null
  createdAt: string
  downloadUrl: string
}

export default function CoupleDashboard() {
  const [coupleKey, setCoupleKey] = useState('')
  const [eventId, setEventId] = useState('')
  const [rsvps, setRsvps] = useState<RSVP[]>([])
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [mediaLoading, setMediaLoading] = useState(false)
  const [playingAsset, setPlayingAsset] = useState<string | null>(null)
  const [showKeyInput, setShowKeyInput] = useState(true)

  useEffect(() => {
    const storedKey = localStorage.getItem('coupleKey')
    const storedEventId = localStorage.getItem('eventId')
    if (storedKey && storedEventId) {
      setCoupleKey(storedKey)
      setEventId(storedEventId)
      setShowKeyInput(false)
      loadPortal(storedKey, storedEventId)
    }
  }, [])

  async function loadPortal(key: string, eventId: string) {
    setLoading(true)
    setMediaLoading(true)
    try {
      const [rsvpData, mediaData] = await Promise.all([
        apiGet<RSVP[]>(`/v1/couple/events/${eventId}/rsvps`, {
          'x-couple-key': key
        }).catch(() => []),
        apiGet<MediaAsset[]>(`/v1/couple/events/${eventId}/media`, {
          'x-couple-key': key
        }).catch(() => [])
      ])
      setRsvps(rsvpData)
      setMediaAssets(mediaData)
    } catch (err) {
      console.error('Failed to load portal:', err)
    } finally {
      setLoading(false)
      setMediaLoading(false)
    }
  }

  function handleKeySubmit(key: string, eventId: string) {
    localStorage.setItem('coupleKey', key)
    localStorage.setItem('eventId', eventId)
    setCoupleKey(key)
    setEventId(eventId)
    setShowKeyInput(false)
    loadPortal(key, eventId)
  }

  async function approveRSVP(id: string) {
    try {
      const result = await apiPost<{ ok: boolean; invitation?: { id: string; sixDigitCode: string; attendeeToken: string } }>(`/v1/couple/rsvps/${id}/approve`, {}, {
        'x-couple-key': coupleKey
      })
      if (result.invitation) {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'
        const pdfUrl = `${baseUrl}/v1/couple/rsvps/${id}/invitation-card.pdf?x-couple-key=${encodeURIComponent(coupleKey)}`
        alert(`RSVP approved! Invitation code: ${result.invitation.sixDigitCode}\n\nYou can download the invitation card from the RSVP details.`)
      }
      loadPortal(coupleKey, eventId)
    } catch (err) {
      alert('Failed to approve: ' + (err as Error).message)
    }
  }

  async function rejectRSVP(id: string) {
    if (!confirm('Reject this RSVP?')) return
    try {
      await apiPost(`/v1/couple/rsvps/${id}/reject`, {}, {
        'x-couple-key': coupleKey
      })
      loadPortal(coupleKey, eventId)
    } catch (err) {
      alert('Failed to reject: ' + (err as Error).message)
    }
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return ''
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function getMediaUrl(asset: MediaAsset): string {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'
    return `${baseUrl}${asset.downloadUrl}?x-couple-key=${encodeURIComponent(coupleKey)}`
  }

  async function downloadAllMedia() {
    if (!coupleKey || !eventId) return
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'
      const url = `${baseUrl}/v1/couple/events/${eventId}/media.zip`
      const response = await fetch(url, {
        headers: {
          'x-couple-key': coupleKey
        }
      })
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `event-media-${eventId}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      alert('Failed to download: ' + (err as Error).message)
    }
  }

  if (showKeyInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
        >
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-gray-100 rounded-full">
                <Heart className="h-12 w-12 text-gray-900" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Couple Portal Access</h2>
              <p className="text-gray-600">Enter your credentials to continue</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const key = formData.get('coupleKey') as string
                const eventId = formData.get('eventId') as string
                if (key && eventId) handleKeySubmit(key, eventId)
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="coupleKey">Couple Access Key</Label>
                <Input
                  id="coupleKey"
                  name="coupleKey"
                  placeholder="Enter couple key"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventId">Event ID</Label>
                <Input
                  id="eventId"
                  name="eventId"
                  placeholder="Enter event ID"
                  required
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Load Portal
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    )
  }

  const pendingRSVPs = rsvps.filter(r => r.status === 'PENDING')
  const approvedRSVPs = rsvps.filter(r => r.status === 'APPROVED')
  const totalMedia = mediaAssets.length

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-semibold text-gray-900">Couple Portal</h1>
        <p className="text-gray-500 mt-1">Manage your event</p>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total RSVPs"
          value={rsvps.length}
          description={`${approvedRSVPs.length} approved`}
          icon={Users}
        />
        <StatCard
          title="Pending"
          value={pendingRSVPs.length}
          description="Awaiting approval"
          icon={Clock}
        />
        <StatCard
          title="Media Messages"
          value={totalMedia}
          description="Guest submissions"
          icon={Image}
        />
      </div>

      <Tabs defaultValue="rsvps" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rsvps">RSVPs</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="rsvps" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 shadow-sm"
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">RSVPs</h2>
              <p className="text-sm text-gray-500 mt-1">Review and manage RSVP submissions</p>
            </div>
            <div className="p-6">
              <RSVPApprovalTable
                rsvps={rsvps}
                loading={loading}
                onApprove={approveRSVP}
                onReject={rejectRSVP}
                onDownloadInvitation={(id) => {
                  const url = `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'}/v1/couple/rsvps/${id}/invitation-card.pdf?x-couple-key=${encodeURIComponent(coupleKey)}`
                  window.open(url, '_blank')
                }}
              />
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 shadow-sm"
          >
            <div className="p-6">
              <MediaTimeline
                assets={mediaAssets.map(asset => ({
                  id: asset.id,
                  type: asset.type as 'VIDEO' | 'AUDIO' | 'PHOTO',
                  source: asset.source as 'PERSONAL' | 'BOOTH',
                  durationSec: asset.durationSec,
                  createdAt: asset.createdAt,
                  downloadUrl: getMediaUrl(asset)
                }))}
                onDownload={(assetId) => {
                  const asset = mediaAssets.find(a => a.id === assetId)
                  if (asset) {
                    const a = document.createElement('a')
                    a.href = getMediaUrl(asset)
                    a.download = `media-${assetId}`
                    a.click()
                  }
                }}
                onDownloadAll={downloadAllMedia}
                loading={mediaLoading}
              />
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 shadow-sm"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Broadcasts</h2>
                  <p className="text-sm text-gray-500 mt-1">Send messages to attendees</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const form = document.getElementById('broadcastForm') as HTMLFormElement
                    form?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  <MessageSquare className="h-4 w-4 mr-2 inline" />
                  New Broadcast
                </motion.button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <form
                id="broadcastForm"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const data = {
                    audience: formData.get('audience'),
                    channel: formData.get('channel'),
                    body: formData.get('body')
                  }
                  try {
                    await apiPost(`/v1/couple/events/${eventId}/broadcasts`, data, {
                      'x-couple-key': coupleKey
                    })
                    alert('Broadcast sent successfully!')
                    e.currentTarget.reset()
                  } catch (err) {
                    alert('Failed to send: ' + (err as Error).message)
                  }
                }}
                className="space-y-4 p-4 border border-gray-200 rounded-lg"
              >
                <div className="space-y-2">
                  <Label htmlFor="audience">Audience</Label>
                  <select
                    id="audience"
                    name="audience"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select audience...</option>
                    <option value="ALL_RSVPS">All RSVPs</option>
                    <option value="APPROVED_ONLY">Approved Only</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel">Channel</Label>
                  <select
                    id="channel"
                    name="channel"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select channel...</option>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">Message (max 480 characters)</Label>
                  <textarea
                    id="body"
                    name="body"
                    required
                    maxLength={480}
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Enter your message..."
                  />
                  <p className="text-xs text-gray-500">Maximum 480 characters</p>
                </div>
                <Button type="submit" className="w-full">
                  Send Broadcast
                </Button>
              </form>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

