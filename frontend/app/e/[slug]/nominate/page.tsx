'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import PublicStateCard from '@/components/voting/PublicStateCard';
import { votingApi } from '@/lib/api';
import VotingPublicLayout from '@/components/voting/VotingPublicLayout';

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
  categories?: Array<{
    id: string;
    label: string;
    description?: string | null;
  }>;
};

type NominationFormPayload = {
  event: {
    id: string;
    slug: string;
    name: string;
  };
  enabled: boolean;
  supportsPhotoUpload?: boolean;
  contests: NominationContest[];
};

type PublicVotingFallbackPayload = {
  config?: {
    allowPublicNominations?: boolean;
  };
  contests: Array<{
    id: string;
    title?: string;
    name?: string;
    mode?: 'AWARDS' | 'ELECTION';
    allowPublicNominations?: boolean;
    categories?: Array<{
      id?: string;
      label?: string;
      description?: string | null;
      isActive?: boolean;
    }>;
  }>;
};

type NomineesFallbackPayload = {
  categories: Array<{
    contestId?: string;
    id?: string;
    title?: string;
    name?: string;
    mode?: 'AWARDS' | 'ELECTION';
  }>;
};

const SESSION_STORAGE_KEY_PREFIX = 'vote_session_token:';

export default function NominatePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.slug || '');
  const contestQuery = String(searchParams.get('contestId') || '');
  const embedToken = String(searchParams.get('token') || searchParams.get('embedToken') || '');
  const storageKey = `${SESSION_STORAGE_KEY_PREFIX}${slug}`;

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
  const [categoryId, setCategoryId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [nomineeImagePath, setNomineeImagePath] = useState('');
  const [nomineeImagePreview, setNomineeImagePreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === contestId) || null,
    [contestId, contests]
  );

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const response = await votingApi.getNominationForm(slug);
      const payload = ((response.data as any)?.data || response.data || {}) as Partial<NominationFormPayload>;
      let normalizedContests: NominationContest[] = (Array.isArray(payload.contests) ? payload.contests : [])
        .map((contest: any) => ({
          id: String(contest?.id || ''),
          title: String(contest?.title || contest?.name || 'Untitled category'),
          mode: (contest?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
          nominationFormFields: Array.isArray(contest?.nominationFormFields) ? contest.nominationFormFields : [],
          categories: Array.isArray(contest?.categories) ? contest.categories : [],
        }))
        .filter((contest) => contest.id);

      if (Boolean(payload.enabled) && normalizedContests.length === 0) {
        const fallbackResponse = await votingApi.getPublicVoting(slug);
        const fallbackPayload = ((fallbackResponse.data as any)?.data || fallbackResponse.data || {}) as Partial<PublicVotingFallbackPayload>;
        normalizedContests = (Array.isArray(fallbackPayload.contests) ? fallbackPayload.contests : [])
          .map((contest: any) => ({
            id: String(contest?.id || ''),
            title: String(contest?.title || contest?.name || 'Untitled category'),
            mode: (contest?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
            nominationFormFields: [],
            categories: [],
          }))
          .filter((contest) => contest.id);
      }

      if (Boolean(payload.enabled) && normalizedContests.length === 0) {
        const nomineesResponse = await votingApi.nominees(slug);
        const nomineesPayload = ((nomineesResponse.data as any)?.data || nomineesResponse.data || {}) as Partial<NomineesFallbackPayload>;
        normalizedContests = (Array.isArray(nomineesPayload.categories) ? nomineesPayload.categories : [])
          .map((contest: any) => ({
            id: String(contest?.contestId || contest?.id || ''),
            title: String(contest?.title || contest?.name || 'Untitled category'),
            mode: (contest?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
            nominationFormFields: [],
            categories: [],
          }))
          .filter((contest) => contest.id);
      }

      setEnabled(Boolean(payload.enabled));
      setEventName(String(payload.event?.name || slug));
      setContests(normalizedContests);
      const firstContest = normalizedContests[0]?.id || '';
      const requested = contestQuery && normalizedContests.some((contest) => contest.id === contestQuery) ? contestQuery : '';
      setContestId((current) => current || requested || firstContest);
      const persisted = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (persisted) {
        setSessionToken(persisted);
      }
    } catch (error: any) {
      try {
        const fallbackResponse = await votingApi.getPublicVoting(slug);
        const fallbackPayload = ((fallbackResponse.data as any)?.data || fallbackResponse.data || {}) as Partial<PublicVotingFallbackPayload>;
        const fallbackContests: NominationContest[] = (Array.isArray(fallbackPayload.contests) ? fallbackPayload.contests : [])
          .filter((contest: any) => contest?.allowPublicNominations)
          .map((contest: any) => ({
            id: String(contest?.id || ''),
            title: String(contest?.title || contest?.name || 'Untitled category'),
            mode: (contest?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
            nominationFormFields: [],
            categories: (Array.isArray(contest?.categories) ? contest.categories : [])
              .filter((entry: any) => entry?.isActive !== false)
              .map((entry: any) => ({
                id: String(entry?.id || ''),
                label: String(entry?.label || ''),
                description: entry?.description ? String(entry.description) : null,
              }))
              .filter((entry: any) => entry.id && entry.label),
          }))
          .filter((contest) => contest.id);

        setEnabled(Boolean(fallbackPayload?.config?.allowPublicNominations));
        setEventName(String((fallbackResponse.data as any)?.event?.name || (fallbackPayload as any)?.event?.name || slug));
        setContests(fallbackContests);
        const firstContest = fallbackContests[0]?.id || '';
        const requested = contestQuery && fallbackContests.some((contest) => contest.id === contestQuery) ? contestQuery : '';
        setContestId((current) => current || requested || firstContest);
      } catch {
        toast.error(error?.response?.data?.error || 'Failed to load nomination form');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    void load();
  }, [slug]);

  useEffect(() => {
    if (!selectedContest) return;
    const firstCategory = selectedContest.categories?.[0]?.id || '';
    setCategoryId((current) => {
      if (!selectedContest.categories?.length) return '';
      const stillValid = selectedContest.categories.some((category) => category.id === current);
      return stillValid ? current : firstCategory;
    });
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
    if (selectedContest?.categories?.length && !categoryId) {
      toast.error('Select an award category');
      return;
    }

    const missingRequiredField = (selectedContest?.nominationFormFields || []).find((field) => {
      if (!field.required) return false;
      return !String(customFields[field.id] || '').trim();
    });
    if (missingRequiredField) {
      toast.error(`Please complete "${missingRequiredField.label}"`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await votingApi.submitNomination(slug, {
        contestId,
        categoryId: categoryId || undefined,
        nomineeName: nomineeName.trim(),
        nomineeDescription: nomineeDescription.trim() || undefined,
        nomineeImagePath: nomineeImagePath || undefined,
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
      const resetFields: Record<string, string> = {};
      (selectedContest?.nominationFormFields || []).forEach((field) => {
        resetFields[field.id] = '';
      });
      setCustomFields(resetFields);
      setCategoryId(selectedContest?.categories?.[0]?.id || '');
      setNomineeImagePath('');
      setNomineeImagePreview('');
      toast.success('Nomination submitted for review');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to submit nomination');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadNomineePhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const response = await votingApi.uploadNominationPhoto(slug, file);
      setNomineeImagePath(String(response.data?.imagePath || ''));
      setNomineeImagePreview(String(response.data?.imageUrl || ''));
      toast.success('Photo uploaded');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Unable to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <PublicStateCard
        title="Public Nominations Closed"
        description="Nominations are currently disabled for this event."
        actionHref={`/e/${slug}/vote`}
        actionLabel="Back To Voting"
      />
    );
  }

  if (enabled && contests.length === 0) {
    return (
      <PublicStateCard
        title="Nominations Are Not Ready Yet"
        description="Nominations are open, but categories are not available right now. Please try again shortly."
        actionHref={`/e/${slug}/vote`}
        actionLabel="Back To Voting"
      />
    );
  }

  return (
    <VotingPublicLayout slug={slug} eventName={eventName} activeTab="nominate" contestId={contestId} showNominateCta={false}>
      <div className="space-y-5">
        <section className="subtle-toolbar">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Nomination form</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">Nominate someone</h2>
            <p className="mt-1 text-sm text-surface-500">Submit a nominee for review. Approved nominees appear automatically once the event team approves them.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-900 ring-1 ring-surface-200">
            Review before publishing
          </span>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_340px]">
          <section className="detail-card space-y-5">
            <div className="grid gap-3 rounded-[24px] border border-surface-200 bg-surface-50/80 p-4 md:grid-cols-2">
              <label className="space-y-1 block">
                <span className="text-xs text-surface-600">Voting Category</span>
                <select className="input" value={contestId} onChange={(event) => setContestId(event.target.value)}>
                  <option value="" disabled>
                    Select category
                  </option>
                  {contests.map((contest) => (
                    <option key={contest.id} value={contest.id}>
                      {contest.title} ({contest.mode === 'AWARDS' ? 'Awards' : 'Election'})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 block">
                <span className="text-xs text-surface-600">Nominee Name *</span>
                <input className="input" value={nomineeName} onChange={(event) => setNomineeName(event.target.value)} />
              </label>
            </div>

            {selectedContest?.categories?.length ? (
              <label className="space-y-1 block">
                <span className="text-xs text-surface-600">Award Category *</span>
                <select className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="" disabled>
                    Select award category
                  </option>
                  {selectedContest.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="space-y-1 block">
              <span className="text-xs text-surface-600">Nominee Description</span>
              <textarea className="input min-h-[120px]" value={nomineeDescription} onChange={(event) => setNomineeDescription(event.target.value)} />
            </label>

            <div className="rounded-[24px] border border-dashed border-surface-300 bg-surface-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">Nominee photo</p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-surface-200 bg-white">
                {nomineeImagePreview ? (
                  <img src={nomineeImagePreview} alt="Nominee preview" className="h-48 w-full object-cover" />
                ) : (
                  <div className="flex h-36 items-center justify-center px-4 text-center text-sm text-surface-500">
                    Add a clear photo to help voters identify the nominee easily.
                  </div>
                )}
              </div>
              <input
                className="input mt-3 !p-2"
                type="file"
                accept="image/*"
                disabled={uploadingPhoto}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void uploadNomineePhoto(file);
                }}
              />
              {uploadingPhoto ? <p className="mt-2 text-xs text-surface-500">Uploading photo...</p> : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
              <div className="space-y-3 rounded-[24px] border border-surface-200 bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-brand-900">Additional details</p>
                  <p className="mt-1 text-sm text-surface-500">Complete any extra fields required by the event team.</p>
                </div>
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

            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="btn-primary flex-1" onClick={submitNomination} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Nomination'}
              </button>
              <Link href={`/e/${slug}/vote${contestId ? `?contestId=${encodeURIComponent(contestId)}` : ''}`} className="btn-outline flex-1 text-center">
                Go To Voting
              </Link>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="detail-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">What happens next</p>
              <div className="mt-3 space-y-3 text-sm text-surface-500">
                <p>1. The event team reviews your submission.</p>
                <p>2. Approved nominees appear on the public nominee list.</p>
                <p>3. Supporters can then vote directly from the public voting page.</p>
              </div>
            </section>
            <section className="detail-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Helpful note</p>
              <p className="mt-3 text-sm leading-6 text-surface-500">
                Keep descriptions short and specific. Clear nominee details make public voting faster and easier.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </VotingPublicLayout>
  );
}
