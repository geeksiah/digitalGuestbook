'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { publicApi, rsvpApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface EventData {
  event: {
    id: string;
    slug: string;
    name: string;
    date: string;
    venue: string | null;
    phase: string;
    invitationOnly: boolean;
    capabilities: {
      canSubmitRsvp: boolean;
    };
  };
}

export default function RSVPPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    primaryName: '',
    secondaryName: '',
    email: '',
    phone: '',
    attendance: '',
    guestCount: 1,
    mealPreference: '',
    dietaryNotes: '',
    note: '',
  });

  useEffect(() => {
    fetchEvent();
  }, [slug]);

  const fetchEvent = async () => {
    try {
      const response = await publicApi.getEvent(slug);
      setEventData(response.data);
      
      if (!response.data.event.capabilities.canSubmitRsvp) {
        setError('RSVP is closed for this event');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Event not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.attendance) {
      toast.error('Please select your attendance');
      return;
    }

    setSubmitting(true);

    try {
      await rsvpApi.submit(slug, {
        primaryName: formData.primaryName,
        secondaryName: formData.secondaryName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        attendance: formData.attendance,
        guestCount: formData.guestCount,
        mealPreference: formData.mealPreference || undefined,
        dietaryNotes: formData.dietaryNotes || undefined,
        note: formData.note || undefined,
        submissionChannel: 'WEB',
      });

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit RSVP');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-white mb-4">
            {error || 'Event Not Found'}
          </h1>
          <Link href={`/e/${slug}`} className="btn-primary">
            Back to Event
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-elegant max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-display font-bold text-navy-900 mb-4">
            Thank You!
          </h1>
          <p className="text-surface-600 mb-6">
            {eventData.event.invitationOnly
              ? 'Your RSVP has been submitted and is pending approval. You will receive your invitation once approved.'
              : 'Your RSVP has been confirmed. We look forward to seeing you!'}
          </p>
          <Link href={`/e/${slug}`} className="btn-primary">
            Back to Event
          </Link>
        </div>
      </div>
    );
  }

  const { event } = eventData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Event Header */}
        <div className="text-center mb-8">
          <Link href={`/e/${slug}`} className="inline-flex items-center text-surface-400 hover:text-white mb-4">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Invitation
          </Link>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            RSVP
          </h1>
          <p className="text-primary-500">{event.name}</p>
          <p className="text-surface-400 text-sm mt-1">
            {formatDate(event.date, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* RSVP Form */}
        <div className="bg-white rounded-2xl shadow-elegant p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Names */}
            <div>
              <label htmlFor="primaryName" className="label">Your Name *</label>
              <input
                id="primaryName"
                type="text"
                required
                className="input"
                placeholder="John Smith"
                value={formData.primaryName}
                onChange={(e) => setFormData({ ...formData, primaryName: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="secondaryName" className="label">Guest Name (if applicable)</label>
              <input
                id="secondaryName"
                type="text"
                className="input"
                placeholder="Jane Smith"
                value={formData.secondaryName}
                onChange={(e) => setFormData({ ...formData, secondaryName: e.target.value })}
              />
            </div>

            {/* Contact */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="phone" className="label">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  placeholder="+1 234 567 8900"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Attendance */}
            <div>
              <label className="label">Will you attend? *</label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[
                  { value: 'YES', label: 'Yes!', emoji: '🎉' },
                  { value: 'NO', label: 'No', emoji: '😔' },
                  { value: 'MAYBE', label: 'Maybe', emoji: '🤔' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`
                      flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${formData.attendance === option.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-surface-200 hover:border-surface-300'}
                    `}
                  >
                    <input
                      type="radio"
                      name="attendance"
                      value={option.value}
                      className="sr-only"
                      checked={formData.attendance === option.value}
                      onChange={(e) => setFormData({ ...formData, attendance: e.target.value })}
                    />
                    <span className="text-2xl mb-1">{option.emoji}</span>
                    <span className="font-medium text-navy-900">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Guest Count */}
            {formData.attendance === 'YES' && (
              <>
                <div>
                  <label htmlFor="guestCount" className="label">Number of Guests</label>
                  <select
                    id="guestCount"
                    className="input"
                    value={formData.guestCount}
                    onChange={(e) => setFormData({ ...formData, guestCount: parseInt(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="mealPreference" className="label">Meal Preference</label>
                  <select
                    id="mealPreference"
                    className="input"
                    value={formData.mealPreference}
                    onChange={(e) => setFormData({ ...formData, mealPreference: e.target.value })}
                  >
                    <option value="">Select preference</option>
                    <option value="standard">Standard</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="halal">Halal</option>
                    <option value="kosher">Kosher</option>
                    <option value="gluten-free">Gluten-Free</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="dietaryNotes" className="label">Dietary Notes / Allergies</label>
                  <input
                    id="dietaryNotes"
                    type="text"
                    className="input"
                    placeholder="Any allergies or dietary requirements"
                    value={formData.dietaryNotes}
                    onChange={(e) => setFormData({ ...formData, dietaryNotes: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Note */}
            <div>
              <label htmlFor="note" className="label">Message for the Couple</label>
              <textarea
                id="note"
                rows={3}
                className="input"
                placeholder="Share your wishes..."
                maxLength={500}
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
              <p className="text-xs text-surface-500 mt-1 text-right">
                {formData.note.length}/500
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 text-base"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </span>
              ) : (
                'Submit RSVP'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
