'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Copy, Check, Smartphone } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import EmptyState from '@/components/dashboard/EmptyState'

interface Device {
  id: string
  name: string
  apiKey: string
  createdAt: string
}

export default function CheckInDevicesPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const [apiKey, setApiKey] = useState<string>('')
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    // Access localStorage only on client side
    if (typeof window !== 'undefined') {
      const key = localStorage.getItem('adminApiKey') || ''
      setApiKey(key)
      if (key && eventId) {
        loadDevices(key)
      } else {
        router.push('/admin')
      }
    }
  }, [eventId, router])

  async function loadDevices(key?: string) {
    const authKey = key || apiKey
    if (!authKey) return
    
    try {
      const data = await apiGet<Device[]>(`/v1/admin/${eventId}/devices`, {
        'x-api-key': authKey
      })
      setDevices(data)
    } catch (err) {
      console.error('Failed to load devices:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name')
    }

    try {
      const result = await apiPost<Device>(`/v1/admin/${eventId}/devices`, data, {
        'x-api-key': apiKey
      })
      setCreateOpen(false)
      loadDevices(apiKey)
      // Show the API key to copy
      setCopiedKey(result.apiKey)
      navigator.clipboard.writeText(result.apiKey)
      alert('Device created! API key copied to clipboard.')
    } catch (err) {
      alert('Failed to create device: ' + (err as Error).message)
    }
  }

  function copyApiKey(key: string) {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="outline" onClick={() => router.push(`/admin/events/${eventId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Check-In Devices</h1>
          <p className="text-gray-500 mt-1">Manage check-in devices for this event</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm"
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Devices</h2>
            <p className="text-sm text-gray-500 mt-1">Check-in devices for this event</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Device
          </motion.button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : devices.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="No devices yet"
              description="Create a check-in device to get started"
              action={{
                label: 'Add Device',
                onClick: () => setCreateOpen(true)
              }}
            />
          ) : (
            <div className="space-y-3">
              {devices.map((device, index) => (
                <motion.div
                  key={device.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{device.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Created {new Date(device.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      {device.apiKey.substring(0, 20)}...
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyApiKey(device.apiKey)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    {copiedKey === device.apiKey ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy API Key
                      </>
                    )}
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Check-In Device</DialogTitle>
            <DialogDescription>
              Create a new device for on-site check-in
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Device Name</Label>
                <Input id="name" name="name" required placeholder="Tablet 1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Device</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

