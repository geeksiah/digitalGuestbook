'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, ArrowRight, User, Mail, Phone, Users, Utensils, MessageSquare } from 'lucide-react'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Step = 'info' | 'details' | 'confirmation'

export default function PublicRSVPPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const [step, setStep] = useState<Step>('info')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [formData, setFormData] = useState({
    partyName: '',
    response: '',
    guestCount: '',
    mealPreference: '',
    contactEmail: '',
    contactPhone: '',
    note: ''
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const data = {
      partyName: formData.partyName,
      response: formData.response,
      guestCount: formData.guestCount ? parseInt(formData.guestCount) : undefined,
      mealPreference: formData.mealPreference || undefined,
      note: formData.note || undefined,
      contactEmail: formData.contactEmail || undefined,
      contactPhone: formData.contactPhone || undefined,
    }

    try {
      const result = await apiPost<{ ok: boolean; status: string; message?: string }>(`/v1/events/${slug}/rsvp`, data)
      if (result.status === 'PENDING') {
        setMessage({ type: 'success', text: result.message || 'Thank you for your response. The event organizers will be in touch.' })
        setStep('confirmation')
      } else {
        setMessage({ type: 'success', text: 'RSVP submitted successfully!' })
        setStep('confirmation')
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {step === 'info' && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="text-3xl">RSVP</CardTitle>
                  <CardDescription>Please respond to the invitation</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => {
                    e.preventDefault()
                    if (formData.partyName && formData.response) {
                      setStep('details')
                    }
                  }} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="partyName" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Name(s) *
                      </Label>
                      <Input
                        id="partyName"
                        value={formData.partyName}
                        onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                        required
                        placeholder="Enter your name(s)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="response" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Attendance *
                      </Label>
                      <select
                        id="response"
                        value={formData.response}
                        onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="YES">Yes, I'll be there</option>
                        <option value="NO">No, I can't make it</option>
                        <option value="MAYBE">Maybe</option>
                      </select>
                    </div>
                    <Button type="submit" className="w-full" disabled={!formData.partyName || !formData.response}>
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Additional Details</CardTitle>
                  <CardDescription>Optional information</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="guestCount" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Number of Guests
                      </Label>
                      <Input
                        id="guestCount"
                        type="number"
                        min="1"
                        value={formData.guestCount}
                        onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mealPreference" className="flex items-center gap-2">
                        <Utensils className="h-4 w-4" />
                        Meal Preference
                      </Label>
                      <Input
                        id="mealPreference"
                        value={formData.mealPreference}
                        onChange={(e) => setFormData({ ...formData, mealPreference: e.target.value })}
                        placeholder="e.g., Vegetarian, Gluten-free"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email (optional)
                      </Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone (optional)
                      </Label>
                      <Input
                        id="contactPhone"
                        type="tel"
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="note" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Note
                      </Label>
                      <textarea
                        id="note"
                        rows={3}
                        value={formData.note}
                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    {message && (
                      <div className={`p-3 rounded-md flex items-start gap-2 ${
                        message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}>
                        {message.type === 'success' ? (
                          <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm">{message.text}</p>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep('info')}
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button type="submit" className="flex-1" disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit RSVP'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 'confirmation' && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-6 py-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="flex justify-center"
                    >
                      <div className="p-4 bg-green-100 rounded-full">
                        <CheckCircle className="h-12 w-12 text-green-600" />
                      </div>
                    </motion.div>
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Thank You!</h2>
                      <p className="text-gray-600">{message?.text || 'Your RSVP has been submitted successfully.'}</p>
                    </div>
                    <Button onClick={() => router.push(`/e/${slug}`)} variant="outline">
                      Return to Invitation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

