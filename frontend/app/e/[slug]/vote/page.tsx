'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { votingApi } from '@/lib/api';
import BackendTemplateFrame, { useBackendTemplate } from '@/components/BackendTemplateFrame';

type VotingConfig = {
  mode: 'AWARDS' | 'ELECTION';
  allowFreeVotes: boolean;
  allowPaidVotes: boolean;
  allowPublicNominations?: boolean;
  requireOtpForElection: boolean;
  voteUnitPrice: number;
  currency: string;
  maxVotesPerPurchase: number;
};

type VotingOption = {
  id: string;
  name: string;
  description: string | null;
  imagePath: string | null;
  totalVotes: number;
  freeVotes: number;
  paidVotes: number;
};

type VotingContest = {
  id: string;
  title: string;
  description: string | null;
  mode: 'AWARDS' | 'ELECTION';
  allowPublicNominations?: boolean;
  options: VotingOption[];
};

type PaymentGateway = {
  id: string;
  name: string;
  gateway: string;
  currency: string;
};

type VotingEventPayload = {
  event: {
    id: string;
    name: string;
    slug: string;
  };
  config: VotingConfig;
  contests: VotingContest[];
  paymentGateways: PaymentGateway[];
  voterSession: {
    token: string;
    otpVerified: boolean;
  };
};

const formatMoney = (currency: string, amount: number) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const SESSION_STORAGE_KEY_PREFIX = 'vote_session_token:';

export default function VotePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.slug || '');
  const contestQuery = String(searchParams.get('contestId') || '');
  const optionQuery = String(searchParams.get('optionId') || '');
  const { loading: templateLoading, available: hasTemplate } = useBackendTemplate(slug, 'voting-page');
  const embedToken = String(searchParams.get('token') || searchParams.get('embedToken') || '');
  const storageKey = `${SESSION_STORAGE_KEY_PREFIX}${slug}`;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eventName, setEventName] = useState('');
  const [config, setConfig] = useState<VotingConfig | null>(null);
  const [contests, setContests] = useState<VotingContest[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [selectedContestId, setSelectedContestId] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [voteCount, setVoteCount] = useState(1);
  const [selectedGatewayId, setSelectedGatewayId] = useState('');

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === selectedContestId) || null,
    [contests, selectedContestId]
  );

  const selectedOption = useMemo(
    () => selectedContest?.options.find((option) => option.id === selectedOptionId) || null,
    [selectedContest, selectedOptionId]
  );

  const electionMode = (selectedContest?.mode || config?.mode || 'AWARDS') === 'ELECTION';

  const voteAmount = useMemo(() => {
    if (!config) return 0;
    return Number((voteCount * config.voteUnitPrice).toFixed(2));
  }, [config, voteCount]);

  const topRankings = useMemo(() => {
    const contest = leaderboard.find((item: any) => item.contestId === selectedContestId) || leaderboard[0];
    return contest?.rankings?.slice(0, 3) || [];
  }, [leaderboard, selectedContestId]);

  const rankedOptions = useMemo(() => {
    const options = selectedContest?.options || [];
    const total = options.reduce((sum, option) => sum + Number(option.totalVotes || 0), 0);
    return [...options]
      .sort((a, b) => Number(b.totalVotes || 0) - Number(a.totalVotes || 0))
      .map((option, index) => ({
        ...option,
        rank: index + 1,
        share: total > 0 ? (Number(option.totalVotes || 0) / total) * 100 : 0,
      }));
  }, [selectedContest]);

  const fetchVoteData = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const persisted = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      const [publicResponse, leaderboardResponse] = await Promise.all([
        votingApi.getPublicVoting(slug, persisted || undefined, embedToken || undefined),
        votingApi.leaderboard(slug),
      ]);

      const payload = publicResponse.data as VotingEventPayload;
      setEventName(payload.event.name);
      setConfig(payload.config);
      setContests(payload.contests || []);
      setLeaderboard(leaderboardResponse.data?.contests || []);

      const gateways = (payload.paymentGateways || []) as PaymentGateway[];
      setPaymentGateways(gateways);
      if (gateways.length > 0) {
        setSelectedGatewayId((current) => current || gateways[0].id);
      }

      if (payload.contests.length > 0) {
        const queriedContest = contestQuery
          ? payload.contests.find((contest) => contest.id === contestQuery)
          : null;
        const rememberedContest = payload.contests.find((contest) => contest.id === selectedContestId);
        const contest = queriedContest || rememberedContest || payload.contests[0];
        setSelectedContestId(contest.id);

        const queriedOption = optionQuery
          ? contest.options?.find((option) => option.id === optionQuery)
          : null;
        const rememberedOption = contest.options?.find((option) => option.id === selectedOptionId);
        const nextOption = queriedOption || rememberedOption || contest.options?.[0];
        setSelectedOptionId(nextOption?.id || '');
      }

      setOtpVerified(Boolean(payload.voterSession?.otpVerified));
      if (payload.voterSession?.token) {
        setSessionToken(payload.voterSession.token);
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, payload.voterSession.token);
        }
      }
    } catch (error: any) {
      console.error('Failed to load voting data', error);
      toast.error(error?.response?.data?.error || 'Failed to load voting page');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!slug || templateLoading || hasTemplate) return;
    void fetchVoteData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, embedToken, contestQuery, optionQuery, templateLoading, hasTemplate]);

  useEffect(() => {
    if (!selectedContest) {
      setSelectedOptionId('');
      return;
    }
    if (!selectedContest.options.some((option) => option.id === selectedOptionId)) {
      setSelectedOptionId(selectedContest.options[0]?.id || '');
    }
  }, [selectedContest, selectedOptionId]);

  const castFreeVote = async (optionOverrideId?: string) => {
    if (!selectedContest) {
      toast.error('Select a contest and nominee');
      return;
    }
    const targetOption = optionOverrideId
      ? selectedContest.options.find((option) => option.id === optionOverrideId) || selectedOption
      : selectedOption;
    if (!targetOption) {
      toast.error('Select a contest and nominee');
      return;
    }
    if (electionMode && config?.requireOtpForElection && !otpVerified) {
      toast.error('OTP verification is required in election mode');
      return;
    }
    setSubmitting(true);
    try {
      const response = await votingApi.freeVote({
        slug,
        contestId: selectedContest.id,
        optionId: targetOption.id,
        sessionToken: sessionToken || undefined,
        embedToken: embedToken || undefined,
      });
      const token = response.data?.voterSessionToken;
      if (token) {
        setSessionToken(token);
        if (typeof window !== 'undefined') localStorage.setItem(storageKey, token);
      }
      toast.success('Vote submitted');
      await fetchVoteData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Free vote failed');
    } finally {
      setSubmitting(false);
    }
  };

  const createPaidIntent = async (optionOverrideId?: string) => {
    if (!config || !selectedContest) {
      toast.error('Select a contest and nominee');
      return;
    }
    const targetOption = optionOverrideId
      ? selectedContest.options.find((option) => option.id === optionOverrideId) || selectedOption
      : selectedOption;
    if (!targetOption) {
      toast.error('Select a contest and nominee');
      return;
    }
    if (!selectedGatewayId) {
      toast.error('Select a payment gateway');
      return;
    }
    if (electionMode && config.requireOtpForElection && !otpVerified) {
      toast.error('OTP verification is required in election mode');
      return;
    }
    setSubmitting(true);
    try {
      const response = await votingApi.createPaymentIntent({
        slug,
        contestId: selectedContest.id,
        optionId: targetOption.id,
        voteCount,
        paymentGatewayId: selectedGatewayId,
        sessionToken: sessionToken || undefined,
        embedToken: embedToken || undefined,
      });
      const token = response.data?.voterSessionToken;
      if (token) {
        setSessionToken(token);
        if (typeof window !== 'undefined') localStorage.setItem(storageKey, token);
      }
      const nextAction = response.data?.nextAction;
      if (nextAction?.type === 'REDIRECT' && nextAction?.url) {
        globalThis.window.location.href = String(nextAction.url);
        return;
      }
      toast.success('Payment intent created. Complete payment in your gateway.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to start paid vote');
    } finally {
      setSubmitting(false);
    }
  };

  const quickVoteForOption = async (optionId: string) => {
    setSelectedOptionId(optionId);
    if (config?.allowPaidVotes) {
      await createPaidIntent(optionId);
      return;
    }
    if (config?.allowFreeVotes) {
      await castFreeVote(optionId);
      return;
    }
    toast.error('Voting is currently unavailable');
  };

  const requestOtp = async () => {
    if (!otpPhone.trim()) {
      toast.error('Enter phone number for OTP');
      return;
    }
    setSubmitting(true);
    try {
      const response = await votingApi.requestOtp({
        slug,
        phone: otpPhone.trim(),
        sessionToken: sessionToken || undefined,
        embedToken: embedToken || undefined,
      });
      const token = response.data?.voterSessionToken;
      if (token) {
        setSessionToken(token);
        if (typeof window !== 'undefined') localStorage.setItem(storageKey, token);
      }
      toast.success('OTP sent');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpCode.trim()) {
      toast.error('Enter OTP code');
      return;
    }
    setSubmitting(true);
    try {
      const response = await votingApi.verifyOtp({
        slug,
        code: otpCode.trim(),
        sessionToken: sessionToken || undefined,
        embedToken: embedToken || undefined,
      });
      const token = response.data?.voterSessionToken;
      if (token) {
        setSessionToken(token);
        if (typeof window !== 'undefined') localStorage.setItem(storageKey, token);
      }
      setOtpVerified(true);
      toast.success('OTP verified');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'OTP verification failed');
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
    return <BackendTemplateFrame slug={slug} endpoint="voting-page" refreshIntervalMs={15000} revalidateOnFocus forceFresh />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-10">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 grid gap-5 xl:grid-cols-[430px_1fr]">
        <section className="phone-stage p-4 xl:sticky xl:top-20 xl:self-start">
          <div className="phone-notch mb-4" />
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-red-500 font-semibold">E-Voting</p>
              <h1 className="text-xl font-bold text-brand-900 mt-1 leading-tight">{eventName}</h1>
            </div>
            <span className="pill-accent">Active Vote</span>
          </div>

          <div className="mt-4 segmented w-full">
            <span className="segmented-item segmented-item-active text-center">Vote</span>
            <Link
              href={`/e/${slug}/nominees${selectedContestId ? `?contestId=${encodeURIComponent(selectedContestId)}` : ''}`}
              className="segmented-item text-center hover:text-brand-900"
            >
              Nominees
            </Link>
            <Link
              href={`/e/${slug}/leaderboard${selectedContestId ? `?contestId=${encodeURIComponent(selectedContestId)}` : ''}`}
              className="segmented-item text-center hover:text-brand-900"
            >
              Results
            </Link>
          </div>

          <div className="mt-4 rounded-3xl border border-red-200 bg-[#fff7f5] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600">Featured Category</p>
            <p className="mt-1 text-lg font-semibold text-brand-900">{selectedContest?.title || 'Select a contest'}</p>
            <p className="text-xs text-surface-600 mt-1">
              {(selectedContest?.options.length || 0).toLocaleString()} contestants
              {config?.allowPaidVotes ? ` • ${formatMoney(config.currency, config.voteUnitPrice)} per vote` : ''}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-surface-200 bg-white px-2 py-2">
                <p className="text-[11px] text-surface-500">Contestants</p>
                <p className="text-base font-semibold text-brand-900">{selectedContest?.options.length || 0}</p>
              </div>
              <div className="rounded-xl border border-surface-200 bg-white px-2 py-2">
                <p className="text-[11px] text-surface-500">Mode</p>
                <p className="text-base font-semibold text-brand-900">{selectedContest?.mode || config?.mode || 'AWARDS'}</p>
              </div>
              <div className="rounded-xl border border-surface-200 bg-white px-2 py-2">
                <p className="text-[11px] text-surface-500">OTP</p>
                <p className="text-base font-semibold text-brand-900">{electionMode ? (otpVerified ? 'Verified' : 'Needed') : 'No'}</p>
              </div>
            </div>
            {config?.allowPublicNominations ? (
              <div className="mt-3">
                <Link
                  href={`/e/${slug}/nominate${selectedContestId ? `?contestId=${encodeURIComponent(selectedContestId)}` : ''}`}
                  className="btn-accent w-full"
                >
                  Nominate A Person
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <div className="space-y-4">
          {config && electionMode ? (
            <section className="dashboard-canvas p-4 space-y-3">
              <h2 className="text-base font-semibold text-brand-900">Election Verification</h2>
              <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto,auto] gap-2">
                <input
                  className="input"
                  placeholder="Phone number"
                  value={otpPhone}
                  onChange={(event) => setOtpPhone(event.target.value)}
                />
                <input
                  className="input"
                  placeholder="OTP code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                />
                <button className="btn-outline" onClick={requestOtp} disabled={submitting}>
                  Request
                </button>
                <button className="btn-primary" onClick={verifyOtp} disabled={submitting}>
                  Verify
                </button>
              </div>
              <p className="text-xs text-surface-600">Status: {otpVerified ? 'Verified' : 'Not verified'}</p>
            </section>
          ) : null}

          <section className="dashboard-canvas p-4 space-y-3">
            <h2 className="text-base font-semibold text-brand-900">Contest & Vote Setup</h2>
            <div className="grid grid-cols-1 md:grid-cols-[1fr,130px,1fr,auto] gap-2">
              <select
                className="input"
                value={selectedContestId}
                onChange={(event) => {
                  const nextContestId = event.target.value;
                  setSelectedContestId(nextContestId);
                  const contest = contests.find((item) => item.id === nextContestId);
                  const firstOption = contest?.options?.[0];
                  setSelectedOptionId(firstOption?.id || '');
                }}
              >
                {contests.map((contest) => (
                  <option key={contest.id} value={contest.id}>
                    {contest.title} ({contest.mode})
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min={1}
                max={config?.maxVotesPerPurchase || 100}
                value={voteCount}
                onChange={(event) => setVoteCount(Math.max(1, Number(event.target.value || 1)))}
              />
              <select className="input" value={selectedGatewayId} onChange={(event) => setSelectedGatewayId(event.target.value)}>
                {paymentGateways.map((gateway) => (
                  <option key={gateway.id} value={gateway.id}>
                    {gateway.name} ({gateway.currency})
                  </option>
                ))}
              </select>
              <button className="btn-accent" onClick={() => { void createPaidIntent(); }} disabled={submitting || !config?.allowPaidVotes}>
                Pay & Vote
              </button>
            </div>
            {config?.allowFreeVotes ? (
              <button className="btn-outline w-full md:w-auto" onClick={() => { void castFreeVote(); }} disabled={submitting}>
                Cast Free Vote
              </button>
            ) : null}
          </section>

          <section className="dashboard-canvas p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-brand-900">Nominees</h2>
              <p className="text-sm font-semibold text-brand-900">
                {config ? formatMoney(config.currency, voteAmount) : ''}
              </p>
            </div>
            <div className="space-y-2">
              {rankedOptions.map((option) => {
                const initials = option.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                const selected = selectedOptionId === option.id;
                return (
                  <article
                    key={option.id}
                    className={`rounded-2xl border px-3 py-3 transition-all ${
                      selected ? 'border-red-300 bg-red-50/60' : 'border-surface-200 bg-white hover:border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center text-xs font-semibold text-brand-900">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-brand-900 truncate">{option.name}</p>
                          <p className="text-xs text-surface-500">#{option.rank}</p>
                        </div>
                        <p className="text-xs text-surface-600 truncate">{option.description || 'Nominee profile'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => quickVoteForOption(option.id)}
                        disabled={submitting}
                        className="btn-accent !min-h-[36px] !px-3 !py-1.5 !text-xs !rounded-full"
                      >
                        {config?.allowPaidVotes ? `Vote ${formatMoney(config.currency, config.voteUnitPrice)}` : 'Vote'}
                      </button>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                      <div className="h-1.5 rounded-full bg-[#ff3b30]" style={{ width: `${Math.min(100, Math.max(0, option.share))}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-surface-500">{option.totalVotes.toLocaleString()} votes</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="dashboard-canvas p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-brand-900">Top Nominees</h2>
              <Link
                href={`/e/${slug}/leaderboard${selectedContestId ? `?contestId=${encodeURIComponent(selectedContestId)}` : ''}`}
                className="text-xs font-semibold text-red-700 hover:text-red-800"
              >
                Full leaderboard
              </Link>
            </div>
            {topRankings.length ? (
              topRankings.map((entry: any) => (
                <article key={entry.optionId} className="rounded-xl border border-surface-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-surface-500">Rank #{entry.rank}</p>
                      <p className="font-semibold text-brand-900">{entry.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const contest = contests.find((item) => item.id === selectedContestId) || contests[0];
                        if (contest) {
                          setSelectedContestId(contest.id);
                          setSelectedOptionId(entry.optionId);
                        }
                      }}
                      className="btn-accent !min-h-[36px] !py-1.5 !text-xs !rounded-full"
                    >
                      Vote
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-surface-600">Leaderboard is still warming up.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
