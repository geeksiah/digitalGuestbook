'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { publicApi } from '@/lib/api';
import BackendTemplateFrame, { useBackendTemplate } from '@/components/BackendTemplateFrame';
import { formatDate } from '@/lib/utils';

interface EventData {
  event: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    date: string;
    venue: string | null;
    phase: string;
    capabilities: {
      canViewInvitation: boolean;
      canSubmitRsvp: boolean;
      canAccessGuestbook: boolean;
      canCheckIn: boolean;
      canViewThankYou: boolean;
    };
    services: {
      invitation: boolean;
      rsvp: boolean;
      guestbook: boolean;
      checkIn: boolean;
    };
    invitationOnly: boolean;
  };
  urls: {
    rsvp: string | null;
    guestbook: string | null;
    booth: string | null;
    thankYou: string;
  };
}

export default function EventPage() {
  const params = useParams();
  const slug = params.slug as string;

  // ── ALL HOOKS AT THE TOP — unconditionally ──────────────────────────────────
  const [data, setData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check all three phase templates using the hook
  // The hook does a fast HEAD request first, so unused ones are cheap
  const { loading: invLoading, available: hasInvitation } = useBackendTemplate(slug, 'invitation');
  const { loading: liveLoading, available: hasLive } = useBackendTemplate(slug, 'live');
  const { loading: endedLoading, available: hasEnded } = useBackendTemplate(slug, 'ended');

  // Fetch event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await publicApi.getEvent(slug);
        setData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Event not found');
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchEvent();
  }, [slug]);

  // ── Wait for event data AND all template checks ─────────────────────────────
  const allChecksComplete = !loading && !invLoading && !liveLoading && !endedLoading;

  if (!allChecksComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-white mb-4">
            Event Not Found
          </h1>
          <p className="text-surface-400 mb-8">{error}</p>
          <Link href="/" className="btn-primary">Go Home</Link>
        </div>
      </div>
    );
  }

  const { event, urls } = data;

  // ── PHASE-AWARE TEMPLATE ROUTING ─────────────────────────────────────────────

  // POST_EVENT → ended template or default thank-you UI
  if (event.phase === 'POST_EVENT') {
    if (hasEnded) {
      return <BackendTemplateFrame slug={slug} endpoint="ended" />;
    }
    // Default thank-you UI
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -right-1/4 w-[500px] h-[500px] rounded-full bg-primary-500/10 blur-3xl" />
        </div>
        <div className="relative bg-white max-w-lg rounded-2xl shadow-elegant p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary-500/20 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-display font-bold text-navy-900 mb-4">Thank You</h1>
          <h2 className="text-xl text-surface-700 mb-6">For Being Part of Our Special Day</h2>
          <p className="text-surface-600">We are deeply grateful for your presence, your love, and your support.</p>
        </div>
      </div>
    );
  }

  // LIVE → live landing template or default live UI
  if (event.phase === 'LIVE') {
    if (hasLive) {
      return <BackendTemplateFrame slug={slug} endpoint="live" />;
    }
    // Default live UI — show guestbook/booth links
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-primary-500/10 blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary-500/5 blur-3xl" />
        </div>
        <div className="relative min-h-screen flex items-center justify-center p-4 py-12">
          <div className="w-full max-w-xl">
            <div className="bg-white rounded-2xl shadow-elegant overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-400" />
              <div className="p-8 sm:p-12 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-3xl sm:text-4xl font-display font-bold text-navy-900 mb-4">{event.name}</h1>
                <p className="text-lg text-green-600 font-medium mb-6">Event is Live!</p>
                {event.description && <p className="text-surface-600 mb-8">{event.description}</p>}

                <div className="space-y-3">
                  {event.services?.guestbook && (
                    <Link href={`/e/${event.slug}/guestbook`} className="block w-full bg-primary-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-600 transition-colors">
                      Open Guestbook
                    </Link>
                  )}
                  <Link href={`/e/${event.slug}/booth`} className="block w-full bg-surface-100 text-navy-900 py-3 px-6 rounded-lg font-medium hover:bg-surface-200 transition-colors">
                    Photo Booth
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PRE_EVENT → invitation template or default invitation UI
  if (hasInvitation) {
    return <BackendTemplateFrame slug={slug} endpoint="invitation" />;
  }

  // Default invitation UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary-500/5 blur-3xl" />
      </div>
      <div className="relative min-h-screen flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-2xl shadow-elegant overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-400" />
            <div className="p-8 sm:p-12 text-center">
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-navy-900 mb-4">{event.name}</h1>
              {event.description && <p className="text-surface-600 mb-6">{event.description}</p>}

              <div className="bg-surface-50 rounded-lg p-6 mb-6">
                <div className="space-y-2 text-sm text-surface-600">
                  {event.date && (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(event.date)}</span>
                    </div>
                  )}
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

              <div className="space-y-3">
                {event.services?.rsvp && (
                  <Link href={`/e/${event.slug}/rsvp`} className="block w-full bg-primary-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-600 transition-colors">
                    RSVP Now
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="text-center mt-8">
            <p className="text-surface-500 text-sm">Powered by EventPeepo</p>
          </div>
        </div>
      </div>
    </div>
  );
}