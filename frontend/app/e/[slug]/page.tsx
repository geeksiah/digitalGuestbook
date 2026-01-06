'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Calendar, Users, Heart } from 'lucide-react'

export default function PublicInvitationPage() {
  const params = useParams()
  const slug = params.slug as string
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInvitation()
  }, [slug])

  async function loadInvitation() {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'
      const response = await fetch(`${baseUrl}/e/${slug}`)
      if (!response.ok) {
        throw new Error('Invitation not found')
      }
      const text = await response.text()
      setHtml(text)
    } catch (err) {
      setHtml(`
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; background: linear-gradient(to bottom right, #f9fafb, #ffffff);">
          <div style="text-align: center; max-width: 600px;">
            <h1 style="font-size: 2rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Event Invitation</h1>
            <p style="color: #6b7280; margin-bottom: 2rem;">Event: ${slug}</p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <a href="/e/${slug}/rsvp" style="display: inline-block; padding: 0.75rem 2rem; background: #111827; color: white; border-radius: 0.5rem; text-decoration: none; font-weight: 500;">RSVP</a>
              <a href="/e/${slug}/guestbook" style="display: inline-block; padding: 0.75rem 2rem; background: white; color: #111827; border: 1px solid #e5e7eb; border-radius: 0.5rem; text-decoration: none; font-weight: 500;">View Guestbook</a>
            </div>
          </div>
        </div>
      `)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading invitation...</div>
      </div>
    )
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  )
}

