'use client';

import { useEffect, useState } from 'react';
import BackendTemplateFrame from '@/components/BackendTemplateFrame';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { publicApi } from '@/lib/api';

interface EventData {
  event: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    date: string;
    venue: string | null;
    phase: string;
    invitationOnly: boolean;
  };
}

export default function ThankYouPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const rsvpId = searchParams.get('rsvp');
  
  const [event, setEvent] = useState<EventData['event'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvent();
  }, [slug]);

  // Backend template check (render backend HTML if assigned)
  const [checkedTemplate, setCheckedTemplate] = useState(false);
  const [useBackendTemplate, setUseBackendTemplate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API_BASE_URL}/api/public/event/${slug}/thank-you`);
        const ct = res.headers.get('content-type') || '';
        if (!cancelled && res.ok && ct.includes('text/html')) {
          setUseBackendTemplate(true);
        }
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setCheckedTemplate(true);
      }
    };

    if (slug) check();
    return () => { cancelled = true; };
  }, [slug]);

  if (checkedTemplate && useBackendTemplate) {
    return <BackendTemplateFrame slug={slug} endpoint="thank-you" />;
  }

  const fetchEvent = async () => {
    try {
      const response = await publicApi.getEvent(slug);
      setEvent(response.data.event);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Event not found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-white mb-4">
            Event Not Found
          </h1>
          <p className="text-surface-400 mb-8">{error}</p>
          <Link href="/" className="btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary-500/5 blur-3xl" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-xl">
          {/* Thank You Card */}
          <div className="bg-white rounded-2xl shadow-elegant overflow-hidden">
            {/* Header accent */}
            <div className="h-2 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-400" />

            <div className="p-8 sm:p-12 text-center">
              {/* Success Icon */}
              <div className="w-16 h-16 mx-auto rounded-full bg-primary-500/20 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Thank You Message */}
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-navy-900 mb-4">
                Thank You!
              </h1>
              <h2 className="text-xl text-surface-700 mb-6">
                Your RSVP has been received
              </h2>

              {/* Event Info */}
              <div className="bg-surface-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-navy-900 mb-3">{event.name}</h3>
                {event.description && (
                  <p className="text-sm text-surface-600 mb-4">{event.description}</p>
                )}
                <div className="space-y-2 text-sm text-surface-600">
                  {event.venue && (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{event.venue}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Message */}
              {event.invitationOnly ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    Your RSVP is pending approval. You'll receive an email confirmation once it's been reviewed.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-800">
                    Your RSVP has been confirmed! We're looking forward to seeing you at the event.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <Link
                  href={`/e/${event.slug}`}
                  className="btn-primary w-full sm:w-auto px-8 py-3 text-base"
                >
                  View Event Details
                </Link>
                <div>
                  <Link
                    href="/"
                    className="text-sm text-surface-500 hover:text-primary-500 transition-colors"
                  >
                    Return to Home
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 space-y-2">
            <img 
              src="/img/logo-light.svg" 
              alt="EventPeepo" 
              className="h-6 w-auto mx-auto opacity-80"
            />
            <p className="text-surface-500 text-sm">
              Powered by EventPeepo
            </p>
            <p className="text-surface-400 text-xs">
              © {new Date().getFullYear()} EventPeepo. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

