'use client';

import { useEffect, useState } from 'react';
import BackendTemplateFrame, { useBackendTemplate } from '@/components/BackendTemplateFrame';
import { useParams } from 'next/navigation';
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
  const slug = params.slug as string;
  
  const [event, setEvent] = useState<EventData['event'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FIX: Use the hook from BackendTemplateFrame (consistent with other pages)
  const { loading: templateLoading, available: hasTemplate } = useBackendTemplate(slug, 'thank-you');

  useEffect(() => {
    fetchEvent();
  }, [slug]);

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

  // FIX: Show loading spinner while checking for backend template
  // This prevents the default UI from flashing before the template loads
  if (templateLoading || loading) {
    return (
      <div className="min-h-screen section-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-900" />
      </div>
    );
  }

  // FIX: If backend template is available, render it immediately (no flash)
  if (hasTemplate) {
    return <BackendTemplateFrame slug={slug} endpoint="thank-you" />;
  }

  if (error || !event) {
    return (
      <div className="min-h-screen section-gradient flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-brand-900 mb-4">
            Event Not Found
          </h1>
          <p className="text-surface-600 mb-8">{error}</p>
          <Link href="/" className="btn-accent">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen section-gradient">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-brand-700/10 blur-3xl" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-xl">
          {/* Thank You Card */}
          <div className="card-premium overflow-hidden">
            {/* Header accent */}
            <div className="h-2 bg-gradient-to-r from-red-400 via-red-500 to-red-400" />

            <div className="p-8 sm:p-12 text-center">
              {/* Success Icon */}
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    className="btn-accent w-full sm:w-auto px-8 py-3 text-base"
                  >
                    View Event Details
                  </Link>
                  <div>
                    <Link
                      href="/"
                      className="text-sm text-surface-500 hover:text-brand-700 transition-colors"
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
              (c) {new Date().getFullYear()} EventPeepo. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

