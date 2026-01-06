'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Heart, CheckCircle } from 'lucide-react'

export default function ThankYouPage() {
  const params = useParams()
  const slug = params.slug as string
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadThankYou()
  }, [slug])

  async function loadThankYou() {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'
      const response = await fetch(`${baseUrl}/e/${slug}/thanks`)
      if (!response.ok) {
        throw new Error('Thank-you page not available')
      }
      const text = await response.text()
      setHtml(text)
    } catch (err) {
      setHtml(`
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; background: linear-gradient(to bottom right, #f9fafb, #ffffff);">
          <div style="text-align: center; max-width: 600px;">
            <div style="padding: 1rem; background: #f0fdf4; border-radius: 9999px; width: 64px; height: 64px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center;">
              <svg style="width: 32px; height: 32px; color: #16a34a;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 style="font-size: 2rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Thank You!</h1>
            <p style="color: #6b7280; font-size: 1.125rem;">Thank you for being part of this special event.</p>
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
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  )
}

