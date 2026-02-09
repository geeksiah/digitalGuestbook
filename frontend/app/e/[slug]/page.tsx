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

  // ALL HOOKS AT THE TOP - UNCONDITIONALLY
  const [data, setData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase-aware template checks
  // We check for BOTH invitation and live templates, then decide based on actual phase
  const [checkedInvitationTemplate, setCheckedInvitationTemplate] = useState(false);
  const [useInvitationTemplate, setUseInvitationTemplate] = useState(false);
  const [checkedLiveTemplate, setCheckedLiveTemplate] = useState(false);
  const [useLiveTemplate, setUseLiveTemplate] = useState(false);
  const [checkedEndedTemplate, setCheckedEndedTemplate] = useState(false);
  const [useEndedTemplate, setUseEndedTemplate] = useState(false);

  // Backend template check for invitation
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API_BASE_URL}/api/public/event/${slug}/invitation`);
        const ct = res.headers.get('content-type') || '';
        if (!cancelled && res.ok && ct.includes('text/html')) {
          setUseInvitationTemplate(true);
        }
      } catch (e) {
        // ignore — will fall back to default UI
      } finally {
        if (!cancelled) setCheckedInvitationTemplate(true);
      }
    };
    if (slug) check();
    return () => { cancelled = true; };
  }, [slug]);

  // Backend template check for live landing
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API_BASE_URL}/api/public/event/${slug}/live`);
        const ct = res.headers.get('content-type') || '';
        if (!cancelled && res.ok && ct.includes('text/html')) {
          setUseLiveTemplate(true);
        }
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setCheckedLiveTemplate(true);
      }
    };
    if (slug) check();
    return () => { cancelled = true; };
  }, [slug]);

  // Backend template check for event ended
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API_BASE_URL}/api/public/event/${slug}/ended`);
        const ct = res.headers.get('content-type') || '';
        if (!cancelled && res.ok && ct.includes('text/html')) {
          setUseEndedTemplate(true);
        }
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setCheckedEndedTemplate(true);
      }
    };
    if (slug) check();
    return () => { cancelled = true; };
  }, [slug]);

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

  // ─── Loading state ─────────────────────────────────────────────────────────
  // Wait for BOTH the event data AND the relevant template check to complete
  // before rendering anything, to prevent the default UI flash.
  const templateChecksComplete =
    checkedInvitationTemplate && checkedLiveTemplate && checkedEndedTemplate;

  if (loading || !templateChecksComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────
  if (error || !data) {
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

  const { event, urls } = data;

  // ─── PHASE-AWARE ROUTING ───────────────────────────────────────────────────

  // POST_EVENT phase → show ended template or default thank-you
  if (event.phase === 'POST_EVENT') {
    if (useEndedTemplate) {
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
          <p className="text-surface-600">
            We are deeply grateful for your presence, your love, and your support.
          </p>
          <p className="font-serif italic text-primary-600 mt-8">
            With love,<br />The Happy Couple
          </p>
        </div>
      </div>
    );
  }

  // LIVE phase → show live landing template, else default live UI
  if (event.phase === 'LIVE') {
    if (useLiveTemplate) {
      return <BackendTemplateFrame slug={slug} endpoint="live" />;
    }
    // Default live landing UI (with links to guestbook, etc.)
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
                {/* Live indicator */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-200 mb-6">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span className="text-sm font-medium text-red-700">Event is Live</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-display font-bold text-navy-900 mb-3">
                  {event.name}
                </h1>

                {event.description && (
                  <p className="text-surface-600 mb-6">{event.description}</p>
                )}

                {event.venue && (
                  <p className="text-surface-500 text-sm mb-8">
                    📍 {event.venue}
                  </p>
                )}

                <div className="space-y-3">
                  {urls.guestbook && (
                    <Link
                      href={urls.guestbook}
                      className="block w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors"
                    >
                      📖 Open Guestbook
                    </Link>
                  )}
                  {urls.booth && (
                    <Link
                      href={urls.booth}
                      className="block w-full py-3 px-6 bg-navy-800 hover:bg-navy-900 text-white font-semibold rounded-xl transition-colors"
                    >
                      📸 Photo Booth
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PRE_EVENT phase → show invitation template, else default invitation UI
  if (useInvitationTemplate) {
    return <BackendTemplateFrame slug={slug} endpoint="invitation" />;
  }

  // Default PRE_EVENT / invitation UI
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
              <p className="text-sm uppercase tracking-widest text-primary-500 font-medium mb-4">
                You&apos;re Invited
              </p>

              <h1 className="text-3xl sm:text-4xl font-display font-bold text-navy-900 mb-3">
                {event.name}
              </h1>

              {event.description && (
                <p className="text-surface-600 italic mb-8">{event.description}</p>
              )}

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-center gap-3 text-surface-700">
                  <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">{formatDate(event.date)}</span>
                </div>

                {event.venue && (
                  <div className="flex items-center justify-center gap-3 text-surface-700">
                    <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{event.venue}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {event.services.rsvp && event.capabilities.canSubmitRsvp && urls.rsvp && (
                  <Link
                    href={urls.rsvp}
                    className="block w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors"
                  >
                    RSVP Now
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}