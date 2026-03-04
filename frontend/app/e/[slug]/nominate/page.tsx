'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { votingApi } from '@/lib/api';
import BackendTemplateFrame, { useBackendTemplate } from '@/components/BackendTemplateFrame';

type NominationField = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'select';
  required?: boolean;
  placeholder?: string | null;
  options?: string[];
};

type NominationContest = {
  id: string;
  title: string;
  mode: 'AWARDS' | 'ELECTION';
  nominationFormFields: NominationField[];
};

type NominationFormPayload = {
  event: {
    id: string;
    slug: string;
    name: string;
  };
  enabled: boolean;
  contests: NominationContest[];
};

const SESSION_STORAGE_KEY_PREFIX = 'vote_session_token:';

export default function NominatePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.slug || '');
  const contestQuery = String(searchParams.get('contestId') || '');
  const embedToken = String(searchParams.get('token') || searchParams.get('embedToken') || '');
  const storageKey = `${SESSION_STORAGE_KEY_PREFIX}${slug}`;
  const { loading: templateLoading, available: hasTemplate } = useBackendTemplate(slug, 'nomination-page');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [eventName, setEventName] = useState('');
  const [contests, setContests] = useState<NominationContest[]>([]);
  const [contestId, setContestId] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeDescription, setNomineeDescription] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [submitterPhone, setSubmitterPhone] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [sessionToken, setSessionToken] = useState('');

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === contestId) || null,
    [contestId, contests]
  );

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const response = await votingApi.getNominationForm(slug);
      const payload = response.data as NominationFormPayload;
      setEnabled(Boolean(payload.enabled));
      setEventName(payload.event?.name || '');
      setContests(payload.contests || []);
      const firstContest = payload.contests?.[0]?.id || '';
      const requested = contestQuery && payload.contests.some((contest) => contest.id === contestQuery) ? contestQuery : '';
      setContestId((current) => current || requested || firstContest);
      const persisted = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (persisted) {
        setSessionToken(persisted);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to load nomination form');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!slug || templateLoading || hasTemplate) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, templateLoading, hasTemplate]);

  useEffect(() => {
    if (!selectedContest) return;
    setCustomFields((current) => {
      const next: Record<string, string> = {};
      selectedContest.nominationFormFields.forEach((field) => {
        next[field.id] = current[field.id] || '';
      });
      return next;
    });
  }, [selectedContest]);

  const submitNomination = async () => {
    if (!contestId) {
      toast.error('Select a category');
      return;
    }
    if (!nomineeName.trim() || !submitterName.trim()) {
      toast.error('Nominee and your name are required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await votingApi.submitNomination(slug, {
        contestId,
        nomineeName: nomineeName.trim(),
        nomineeDescription: nomineeDescription.trim() || undefined,
        submitterName: submitterName.trim(),
        submitterEmail: submitterEmail.trim() || undefined,
        submitterPhone: submitterPhone.trim() || undefined,
        customFields,
        sessionToken: sessionToken || undefined,
        embedToken: embedToken || undefined,
      });
      const token = response.data?.voterSessionToken;
      if (token) {
        setSessionToken(token);
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, token);
        }
      }
      setNomineeName('');
      setNomineeDescription('');
      setSubmitterName('');
      setSubmitterEmail('');
      setSubmitterPhone('');
      setCustomFields({});
      toast.success('Nomination submitted for review');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to submit nomination');
    } finally {
      setSubmitting(false);
    }
  };

  if (templateLoading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  if (hasTemplate) {
    return <BackendTemplateFrame slug={slug} endpoint="nomination-page" refreshIntervalMs={15000} revalidateOnFocus forceFresh />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="min-h-screen bg-surface-50 p-6">
        <div className="mx-auto max-w-xl card-premium p-6 space-y-3">
          <h1 className="text-xl font-semibold text-brand-900">Public Nominations Closed</h1>
          <p className="text-sm text-surface-600">Nominations are currently disabled for this event.</p>
          <Link className="btn-outline inline-flex" href={`/e/${slug}/vote`}>
            Back To Voting
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 py-6 px-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="phone-stage p-5">
          <div className="phone-notch mb-4" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-red-500 font-semibold">Nomination Flow</p>
          <h1 className="text-2xl font-bold mt-2 text-brand-900">{eventName}</h1>
          <p className="text-sm text-surface-600 mt-1">
            Submit nominees by category. Approved nominees automatically appear on the public nominees page.
          </p>
          <div className="mt-4 segmented w-full max-w-md">
            <span className="segmented-item segmented-item-active text-center">Nominate</span>
            <Link
              href={`/e/${slug}/nominees${contestId ? `?contestId=${encodeURIComponent(contestId)}` : ''}`}
              className="segmented-item text-center hover:text-brand-900"
            >
              Nominees
            </Link>
            <Link
              href={`/e/${slug}/leaderboard${contestId ? `?contestId=${encodeURIComponent(contestId)}` : ''}`}
              className="segmented-item text-center hover:text-brand-900"
            >
              Results
            </Link>
          </div>
        </section>

        <section className="dashboard-canvas p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-xs text-surface-600">Category</span>
              <select className="input" value={contestId} onChange={(event) => setContestId(event.target.value)}>
                {contests.map((contest) => (
                  <option key={contest.id} value={contest.id}>
                    {contest.title} ({contest.mode})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 block">
              <span className="text-xs text-surface-600">Nominee Name *</span>
              <input className="input" value={nomineeName} onChange={(event) => setNomineeName(event.target.value)} />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-xs text-surface-600">Nominee Description</span>
            <textarea className="input min-h-[110px]" value={nomineeDescription} onChange={(event) => setNomineeDescription(event.target.value)} />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1 block">
              <span className="text-xs text-surface-600">Your Name *</span>
              <input className="input" value={submitterName} onChange={(event) => setSubmitterName(event.target.value)} />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs text-surface-600">Your Email</span>
              <input className="input" type="email" value={submitterEmail} onChange={(event) => setSubmitterEmail(event.target.value)} />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs text-surface-600">Your Phone</span>
              <input className="input" value={submitterPhone} onChange={(event) => setSubmitterPhone(event.target.value)} />
            </label>
          </div>

          {selectedContest?.nominationFormFields?.length ? (
            <div className="space-y-2 pt-3 border-t border-surface-100">
              <p className="text-sm font-semibold text-brand-900">Custom Fields</p>
              {selectedContest.nominationFormFields.map((field) => (
                <label key={field.id} className="space-y-1 block">
                  <span className="text-xs text-surface-600">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="input min-h-[90px]"
                      value={customFields[field.id] || ''}
                      placeholder={field.placeholder || ''}
                      onChange={(event) => setCustomFields((current) => ({ ...current, [field.id]: event.target.value }))}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className="input"
                      value={customFields[field.id] || ''}
                      onChange={(event) => setCustomFields((current) => ({ ...current, [field.id]: event.target.value }))}
                    >
                      <option value="">Select...</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                      value={customFields[field.id] || ''}
                      placeholder={field.placeholder || ''}
                      onChange={(event) => setCustomFields((current) => ({ ...current, [field.id]: event.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button className="btn-accent flex-1" onClick={submitNomination} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Nomination'}
            </button>
            <Link
              href={`/e/${slug}/vote${contestId ? `?contestId=${encodeURIComponent(contestId)}` : ''}`}
              className="btn-outline flex-1 text-center"
            >
              Go To Voting
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
