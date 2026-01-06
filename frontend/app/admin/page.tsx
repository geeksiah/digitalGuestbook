'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Users, Clock, Plus, AlertCircle } from 'lucide-react'
import StatCard from '@/components/dashboard/StatCard'
import EmptyState from '@/components/dashboard/EmptyState'
import { apiGet } from '@/lib/api'

interface Event {
  id: string
  slug: string
  name: string
  dateTime: string
  phase: string
  featureRsvp: boolean
  featureGuestbook: boolean
}

export default function AdminDashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('adminApiKey')
    if (stored) {
      setApiKey(stored)
      setShowKeyInput(false)
      loadEvents(stored)
    } else {
      setLoading(false)
    }
  }, [])

  async function loadEvents(key: string) {
    try {
      const data = await apiGet<Event[]>('/v1/admin/events', {
        'x-api-key': key
      })
      setEvents(data)
    } catch (err) {
      console.error('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleKeySubmit(key: string) {
    localStorage.setItem('adminApiKey', key)
    setApiKey(key)
    setShowKeyInput(false)
    loadEvents(key)
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
                <AlertCircle className="h-12 w-12 text-gray-900" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Admin Access</h2>
              <p className="text-gray-600">Enter your API key to continue</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const key = formData.get('key') as string
                if (key) handleKeySubmit(key)
              }}
              className="space-y-4"
            >
              <input
                type="password"
                name="key"
                placeholder="Admin API Key"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                autoFocus
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Continue
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    )
  }

  const totalEvents = events.length
  const liveEvents = events.filter(e => e.phase === 'LIVE').length
  const upcomingEvents = events.filter(e => e.phase === 'PRE_EVENT').length
  const pastEvents = events.filter(e => e.phase === 'POST_EVENT').length

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Event management overview</p>
        </div>
        <motion.a
          href="/admin/events"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Event
        </motion.a>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Events"
          value={totalEvents}
          description="All events"
          icon={Calendar}
        />
        <StatCard
          title="Live Events"
          value={liveEvents}
          description="Currently active"
          icon={Users}
        />
        <StatCard
          title="Upcoming"
          value={upcomingEvents}
          description="Pre-event phase"
          icon={Clock}
        />
        <StatCard
          title="Past Events"
          value={pastEvents}
          description="Post-event phase"
          icon={Calendar}
        />
      </div>

      {/* Recent Events */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm"
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Events</h2>
          <p className="text-sm text-gray-500 mt-1">Your most recent event activity</p>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading events...</div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No events yet"
              description="Create your first event to get started"
              action={{
                label: 'Create Event',
                onClick: () => window.location.href = '/admin/events'
              }}
            />
          ) : (
            <div className="space-y-3">
              {events.slice(0, 5).map((event, index) => (
                <motion.a
                  key={event.id}
                  href={`/admin/events?event=${event.id}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer group"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 group-hover:text-gray-900">{event.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(event.dateTime).toLocaleDateString()} • {event.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      event.phase === 'LIVE' ? 'bg-green-100 text-green-800' :
                      event.phase === 'PRE_EVENT' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {event.phase || 'PRE_EVENT'}
                    </span>
                  </div>
                </motion.a>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

