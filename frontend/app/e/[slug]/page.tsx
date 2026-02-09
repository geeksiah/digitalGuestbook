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
  const [checkedInvitationTemplate, setCheckedInvitationTemplate] = useState(false);
  const [useInvitationTemplate, setUseInvitationTemplate] = useState(false);

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
        // ignore
      } finally {
        if (!cancelled) setCheckedInvitationTemplate(true);
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
    
    fetchEvent();
  }, [slug]);

  // RENDER LOGIC AFTER ALL HOOKS
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

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

  // POST_EVENT phase - show thank you
  if (event.phase === 'POST_EVENT') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -right-1/4 w-[500px] h-[500px] rounded-full bg-primary-500/10 blur-3xl" />
        </div>
        
        {/* Content */}
        <div className="relative bg-white max-w-lg rounded-2xl shadow-elegant p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary-500/20 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-display font-bold text-navy-900 mb-4">
            Thank You
          </h1>
          <h2 className="text-xl text-surface-700 mb-6">
            For Being Part of Our Special Day
          </h2>
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

  // If invitation template exists on backend, render it for PRE_EVENT or LIVE
  if ((event.phase === 'PRE_EVENT' || event.phase === 'LIVE') && checkedInvitationTemplate && useInvitationTemplate) {
    return <BackendTemplateFrame slug={slug} endpoint="invitation" />;
  }

  // PRE_EVENT or LIVE phase - show invitation
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary-500/5 blur-3xl" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-xl">
          {/* Invitation Card */}
          <div className="bg-white rounded-2xl shadow-elegant overflow-hidden">
            {/* Header accent */}
            <div className="h-2 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-400" />

            <div className="p-8 sm:p-12 text-center">
              {/* Pre-header */}
              <p className="text-sm tracking-[0.3em] text-primary-500 uppercase mb-4">
                You Are Cordially Invited
              </p>

              {/* Event Name */}
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-navy-900 mb-6">
                {event.name}
              </h1>

              {/* Date */}
              <div className="flex items-center justify-center text-surface-600 mb-2">
                <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-lg">
                  {formatDate(event.date, 'EEEE, MMMM d, yyyy')}
                </span>
              </div>

              {/* Time */}
              <p className="text-surface-500 mb-4">
                {formatDate(event.date, 'h:mm a')}
              </p>

              {/* Venue */}
              {event.venue && (
                <div className="flex items-center justify-center text-surface-600 mb-8">
                  <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{event.venue}</span>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <p className="text-surface-600 leading-relaxed mb-8 max-w-md mx-auto">
                  {event.description}
                </p>
              )}

              {/* Divider */}
              <div className="flex items-center justify-center my-8">
                <div className="h-px w-16 bg-surface-200" />
                <div className="w-2 h-2 rounded-full bg-primary-500 mx-3" />
                <div className="h-px w-16 bg-surface-200" />
              </div>

              {/* CTAs based on phase */}
              <div className="space-y-4">
                {/* RSVP Button */}
                {event.capabilities.canSubmitRsvp && urls.rsvp && (
                  <Link
                    href={`/e/${event.slug}/rsvp`}
                    className="btn-primary w-full sm:w-auto px-12 py-3 text-base"
                  >
                    {event.invitationOnly ? 'RSVP Now (Required)' : 'RSVP Now (Optional)'}
                  </Link>
                )}

                {/* Guestbook Button */}
                {event.capabilities.canAccessGuestbook && urls.guestbook && (
                  <Link
                    href={`/e/${event.slug}/guestbook${!event.invitationOnly ? '' : '?accessCode=REQUIRED'}`}
                    className="btn-secondary w-full sm:w-auto px-12 py-3 text-base"
                  >
                    Leave a Message
                  </Link>
                )}

                {/* Phase indicator */}
                {event.phase === 'LIVE' && (
                  <div className="inline-flex items-center mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                    Event is Live
                  </div>
                )}

                {event.phase === 'PRE_EVENT' && (
                  <p className="text-sm text-surface-500 mt-4">
                    We hope to see you there!
                  </p>
                )}
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