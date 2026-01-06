'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Upload, Trash2, FileText, Plus } from 'lucide-react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import EmptyState from '@/components/dashboard/EmptyState'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Template {
  id: string
  name: string
  type: string
  version: number
  createdAt: string
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const apiKey = localStorage.getItem('adminApiKey') || ''

  useEffect(() => {
    if (apiKey) {
      loadTemplates()
    } else {
      window.location.href = '/admin'
    }
  }, [apiKey])

  async function loadTemplates() {
    try {
      const data = await apiGet<Template[]>('/v1/admin/templates', {
        'x-api-key': apiKey
      })
      setTemplates(data)
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploading(true)
    const formData = new FormData(e.currentTarget)
    const file = formData.get('bundle') as File
    const name = formData.get('name') as string
    const type = formData.get('type') as string

    if (!file || !name || !type) {
      alert('Please fill all fields and select a file')
      setUploading(false)
      return
    }

    const uploadFormData = new FormData()
    uploadFormData.append('bundle', file)
    uploadFormData.append('name', name)
    uploadFormData.append('type', type)

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'
      const response = await fetch(`${baseUrl}/v1/admin/templates`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey
        },
        body: uploadFormData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      setUploadOpen(false)
      loadTemplates()
    } catch (err) {
      alert('Failed to upload: ' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    try {
      await apiDelete(`/v1/admin/templates/${id}`, {
        'x-api-key': apiKey
      })
      loadTemplates()
    } catch (err) {
      alert('Failed to delete: ' + (err as Error).message)
    }
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Templates</h1>
          <p className="text-gray-500 mt-1">Manage page templates</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Upload Template
        </motion.button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm"
      >
        <CardHeader>
          <CardTitle>All Templates</CardTitle>
          <CardDescription>Uploaded templates for events</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No templates uploaded"
              description="Upload your first template to get started"
              action={{
                label: 'Upload Template',
                onClick: () => setUploadOpen(true)
              }}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template, index) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {template.type} • Version {template.version}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </motion.div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Template</DialogTitle>
            <DialogDescription>
              Upload a ZIP file containing your template (must include index.html at root)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input id="name" name="name" required placeholder="Elegant Wedding Invitation" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Template Type</Label>
                <select
                  id="type"
                  name="type"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select type...</option>
                  <option value="INVITATION">Invitation</option>
                  <option value="RSVP">RSVP</option>
                  <option value="GUESTBOOK">Guestbook</option>
                  <option value="THANK_YOU">Thank You</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle">Template ZIP File</Label>
                <Input
                  id="bundle"
                  name="bundle"
                  type="file"
                  accept=".zip"
                  required
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500">
                  Upload a ZIP file containing your template. Must include index.html at the root.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

