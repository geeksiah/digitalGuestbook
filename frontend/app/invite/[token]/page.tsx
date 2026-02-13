'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { publicApi, rsvpApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

type InvitePayload = {
  invite: {
    token: string;
    status: string;
    inviteeName: string | null;
    inviteePhone: string;
    inviteeEmail: string | null;
    expiresAt: string | null;
  };
  event: {
    slug: string;
    name: string;
    title: string;
    description: string | null;
    date: string;
    endDate: string | null;
    timezone: string;
    venue: string | null;
    coverImageUrl: string | null;
    coverImageAlt: string | null;
  };
};

export default function InviteTokenPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payload, setPayload] = useState<InvitePayload | null>(null);
  const [selected, setSelected] = useState<'YES' | 'NO' | null>(null);
  const [responded, setResponded] = useState(false);
  const [partySize, setPartySize] = useState(1);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');

  const canSubmitDetails = useMemo(() => selected === 'YES' && responded, [selected, responded]);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await publicApi.getRsvpInvite(token);
        setPayload(response.data);
        if (response.data?.invite?.inviteeEmail) {
          setEmail(response.data.invite.inviteeEmail);
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Invalid invite link');
      } finally {
        setLoading(false);
      }
    };
    if (token) run();
  }, [token]);

  const handleRespond = async (response: 'YES' | 'NO') => {
    if (!payload) return;
    setSubmitting(true);
    try {
      await rsvpApi.inviteRespond(payload.invite.token, { response });
      setSelected(response);
      setResponded(true);
      toast.success(response === 'YES' ? 'You are marked as attending' : 'Your decline has been recorded');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!payload) return;
    setSubmitting(true);
    try {
      await rsvpApi.inviteDetails(payload.invite.token, {
        partySize,
        note: note.trim() || undefined,
        email: email.trim() || undefined,
      });
      toast.success('Details saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save details');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-900" />
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center px-4">
        <div className="bg-white max-w-md w-full rounded-2xl border border-surface-200 p-8 text-center">
          <h1 className="text-xl font-semibold text-brand-900">Invite Link Unavailable</h1>
          <p className="text-surface-600 mt-2">This link is invalid or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-100 py-8 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden shadow-sm">
          <div className="h-44 bg-surface-200">
            {payload.event.coverImageUrl ? (
              <img
                src={payload.event.coverImageUrl}
                alt={payload.event.coverImageAlt || payload.event.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-brand-900 to-brand-700" />
            )}
          </div>
          <div className="p-5">
            <p className="text-xs uppercase tracking-wider text-surface-500 font-semibold">Event Invite</p>
            <h1 className="text-xl font-bold text-brand-900 mt-1">{payload.event.title}</h1>
            {payload.event.description && (
              <p className="text-sm text-surface-600 mt-2">{payload.event.description}</p>
            )}
            <div className="mt-4 space-y-1 text-sm text-surface-700">
              <p>{formatDate(payload.event.date, 'PPP p')}</p>
              {payload.event.venue && <p>{payload.event.venue}</p>}
            </div>
          </div>
        </div>

        {!responded && (
          <div className="bg-white rounded-2xl border border-surface-200 p-4">
            <p className="text-sm font-medium text-surface-700 mb-3">Will you attend?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="btn-primary justify-center"
                disabled={submitting}
                onClick={() => handleRespond('YES')}
              >
                Yes
              </button>
              <button
                className="btn-outline justify-center"
                disabled={submitting}
                onClick={() => handleRespond('NO')}
              >
                No
              </button>
            </div>
          </div>
        )}

        {responded && selected === 'NO' && (
          <div className="bg-white rounded-2xl border border-surface-200 p-5 text-center">
            <h2 className="text-lg font-semibold text-brand-900">Response Recorded</h2>
            <p className="text-sm text-surface-600 mt-2">Thank you for letting us know.</p>
          </div>
        )}

        {canSubmitDetails && (
          <div className="bg-white rounded-2xl border border-surface-200 p-4 space-y-3">
            <p className="text-sm font-medium text-surface-700">Optional details</p>
            <div>
              <label className="label">Party size</label>
              <input
                type="number"
                min={1}
                max={20}
                className="input"
                value={partySize}
                onChange={(e) => setPartySize(Math.max(1, Number(e.target.value || 1)))}
              />
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea
                className="input min-h-[88px]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <button className="btn-primary w-full justify-center" disabled={submitting} onClick={handleSaveDetails}>
              Save Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

