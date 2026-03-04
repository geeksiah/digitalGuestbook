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

  const castFreeVote = async () => {
    if (!selectedContest || !selectedOption) {
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
        optionId: selectedOption.id,
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

  const createPaidIntent = async () => {
    if (!config || !selectedContest || !selectedOption) {
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
        optionId: selectedOption.id,
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
    <div className="min-h-screen bg-surface-50 pb-16">
      <div className="mx-auto w-full max-w-[540px] px-4 py-6 space-y-4">
        <section className="card-premium p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-red-500 font-semibold">E-Voting</p>
              <h1 className="text-2xl font-bold text-brand-900 mt-1">{eventName}</h1>
            </div>
            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              Active Vote
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-100 p-1">
            <span className="rounded-lg bg-white text-center py-2 text-xs font-semibold text-brand-900">Vote</span>
            <Link href={`/e/${slug}/nominees${selectedContestId ? `?contestId=${encodeURIComponent(selectedContestId)}` : ''}`} className="rounded-lg text-center py-2 text-xs font-semibold text-surface-600 hover:text-brand-900">
              Nominees
            </Link>
            <Link href={`/e/${slug}/leaderboard${selectedContestId ? `?contestId=${encodeURIComponent(selectedContestId)}` : ''}`} className="rounded-lg text-center py-2 text-xs font-semibold text-surface-600 hover:text-brand-900">
              Results
            </Link>
          </div>

          <div className="mt-4 rounded-2xl border border-red-200 bg-[#fff6f5] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Current Selection</p>
            <p className="mt-1 text-base font-semibold text-brand-900">{selectedContest?.title || 'Select a contest'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-600">
              <span>{selectedContest?.options.length || 0} contestants</span>
              {config?.allowPaidVotes ? <span>{formatMoney(config.currency, config.voteUnitPrice)} / vote</span> : null}
              {config?.allowPublicNominations ? (
                <Link href={`/e/${slug}/nominate${selectedContestId ? `?contestId=${encodeURIComponent(selectedContestId)}` : ''}`} className="font-semibold text-red-700 hover:text-red-800">
                  Nominate
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {config && electionMode ? (
          <section className="card-premium p-4 space-y-3">
            <h2 className="text-base font-semibold text-brand-900">Election Verification</h2>
            <input
              className="input"
              placeholder="Phone number"
              value={otpPhone}
              onChange={(event) => setOtpPhone(event.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <input
                className="input"
                placeholder="OTP code"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-outline" onClick={requestOtp} disabled={submitting}>
                  Request
                </button>
                <button className="btn-primary" onClick={verifyOtp} disabled={submitting}>
                  Verify
                </button>
              </div>
            </div>
            <p className="text-xs text-surface-600">
              Status: {otpVerified ? 'Verified' : 'Not verified'}
            </p>
          </section>
        ) : null}

        <section className="card-premium p-4 space-y-3">
          <h2 className="text-base font-semibold text-brand-900">Select Contest & Nominee</h2>
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

          <div className="space-y-2">
            {(selectedContest?.options || []).map((option) => {
              const selected = selectedOptionId === option.id;
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => setSelectedOptionId(option.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
                    selected
                      ? 'border-red-300 bg-red-50 shadow-sm'
                      : 'border-surface-200 bg-white hover:border-surface-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-brand-900">{option.name}</p>
                    <span className="text-xs text-surface-500">{option.totalVotes.toLocaleString()} votes</span>
                  </div>
                  <p className="text-xs text-surface-600 mt-1">{option.description || 'Nominee'}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card-premium p-4 space-y-3">
          <h2 className="text-base font-semibold text-brand-900">Cast Vote</h2>
          {config?.allowFreeVotes ? (
            <button className="btn-outline w-full" onClick={castFreeVote} disabled={submitting}>
              Cast Free Vote
            </button>
          ) : null}

          {config?.allowPaidVotes ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={config.maxVotesPerPurchase}
                  value={voteCount}
                  onChange={(event) => setVoteCount(Math.max(1, Number(event.target.value || 1)))}
                />
                <p className="text-sm font-semibold text-brand-900">
                  {formatMoney(config.currency, voteAmount)}
                </p>
              </div>
              <select className="input" value={selectedGatewayId} onChange={(event) => setSelectedGatewayId(event.target.value)}>
                {paymentGateways.map((gateway) => (
                  <option key={gateway.id} value={gateway.id}>
                    {gateway.name} ({gateway.gateway.toUpperCase()} - {gateway.currency})
                  </option>
                ))}
              </select>
              <button className="btn-accent w-full" onClick={createPaidIntent} disabled={submitting}>
                Pay & Vote
              </button>
            </div>
          ) : null}
        </section>

        <section className="card-premium p-4 space-y-2">
          <h2 className="text-base font-semibold text-brand-900">Top Nominees</h2>
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
                    className="btn-accent !min-h-[36px] !py-1.5 !text-xs"
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
  );
}
