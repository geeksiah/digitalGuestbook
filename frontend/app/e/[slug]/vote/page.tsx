'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { votingApi } from '@/lib/api';

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
  imageUrl?: string | null;
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

type LeaderboardContest = {
  contestId: string;
  rankings?: Array<{
    optionId: string;
    name: string;
    description?: string | null;
    imagePath?: string | null;
    imageUrl?: string | null;
    rank?: number;
    totalVotes?: number;
    freeVotes?: number;
    paidVotes?: number;
    voteSharePercent?: number;
  }>;
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
  const [nomineeSearch, setNomineeSearch] = useState('');

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
    const contest = (leaderboard as LeaderboardContest[]).find((item) => item.contestId === selectedContestId) || (leaderboard as LeaderboardContest[])[0];
    return (contest?.rankings || []).slice(0, 3);
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

  const filteredRankedOptions = useMemo(() => {
    const query = nomineeSearch.trim().toLowerCase();
    if (!query) return rankedOptions;
    return rankedOptions.filter((option) => {
      const name = String(option.name || '').toLowerCase();
      const description = String(option.description || '').toLowerCase();
      return name.includes(query) || description.includes(query);
    });
  }, [rankedOptions, nomineeSearch]);

  const hasContests = contests.length > 0;
  const hasGateways = paymentGateways.length > 0;
  const canUsePaidVoting = Boolean(config?.allowPaidVotes && hasGateways);

  const resolveNomineeImage = (option: VotingOption) => option.imageUrl || option.imagePath || '';

  const fetchVoteData = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const persisted = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      const [publicResponse, leaderboardResponse] = await Promise.all([
        votingApi.getPublicVoting(slug, persisted || undefined, embedToken || undefined),
        votingApi.leaderboard(slug),
      ]);

      const payload = ((publicResponse.data as any)?.data || publicResponse.data || {}) as Partial<VotingEventPayload>;
      const rawContests = Array.isArray(payload.contests) ? payload.contests : [];
      const normalizedContests: VotingContest[] = rawContests.map((contest: any) => ({
        id: String(contest?.id || ''),
        title: String(contest?.title || contest?.name || 'Untitled contest'),
        description: contest?.description ? String(contest.description) : null,
        mode: (contest?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
        allowPublicNominations: Boolean(contest?.allowPublicNominations),
        options: (Array.isArray(contest?.options) ? contest.options : []).map((option: any) => ({
          id: String(option?.id || option?.optionId || ''),
          name: String(option?.name || 'Unnamed nominee'),
          description: option?.description ? String(option.description) : null,
          imagePath: option?.imagePath ? String(option.imagePath) : null,
          imageUrl: option?.imageUrl ? String(option.imageUrl) : null,
          totalVotes: Number(option?.totalVotes || 0),
          freeVotes: Number(option?.freeVotes || 0),
          paidVotes: Number(option?.paidVotes || 0),
        })).filter((option: VotingOption) => Boolean(option.id)),
      })).filter((contest) => contest.id);

      const normalizedConfig: VotingConfig | null = payload.config
        ? {
            mode: payload.config.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS',
            allowFreeVotes: Boolean(payload.config.allowFreeVotes),
            allowPaidVotes: Boolean(payload.config.allowPaidVotes),
            allowPublicNominations: Boolean(payload.config.allowPublicNominations),
            requireOtpForElection: Boolean(payload.config.requireOtpForElection),
            voteUnitPrice: Number(payload.config.voteUnitPrice || 0),
            currency: String(payload.config.currency || 'USD'),
            maxVotesPerPurchase: Math.max(1, Number(payload.config.maxVotesPerPurchase || 1)),
          }
        : null;

      const leaderboardPayload = ((leaderboardResponse.data as any)?.data || leaderboardResponse.data || {}) as any;
      const normalizedLeaderboard = Array.isArray(leaderboardPayload?.contests) ? leaderboardPayload.contests : [];
      const gateways = (Array.isArray(payload.paymentGateways) ? payload.paymentGateways : []) as PaymentGateway[];

      setEventName(String(payload?.event?.name || slug));
      setConfig(normalizedConfig);
      setContests(normalizedContests);
      setLeaderboard(normalizedLeaderboard);
      setPaymentGateways(gateways);
      if (gateways.length > 0) {
        setSelectedGatewayId((current) => current || gateways[0].id);
      } else {
        setSelectedGatewayId('');
      }

      if (normalizedContests.length > 0) {
        const queriedContest = contestQuery
          ? normalizedContests.find((contest) => contest.id === contestQuery)
          : null;
        const queriedContestByOption = optionQuery
          ? normalizedContests.find((contest) => contest.options?.some((option) => option.id === optionQuery))
          : null;
        const rememberedContest = normalizedContests.find((contest) => contest.id === selectedContestId);
        const contest = queriedContest || queriedContestByOption || rememberedContest || normalizedContests[0];
        setSelectedContestId(contest.id);

        const queriedOption = optionQuery
          ? contest.options?.find((option) => option.id === optionQuery)
          : null;
        const rememberedOption = contest.options?.find((option) => option.id === selectedOptionId);
        const nextOption = queriedOption || rememberedOption || contest.options?.[0];
        setSelectedOptionId(nextOption?.id || '');
      } else {
        setSelectedContestId('');
        setSelectedOptionId('');
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
    if (!slug) return;
    void fetchVoteData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, embedToken, contestQuery, optionQuery]);

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
      toast.error('Choose a payment method to continue');
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
      toast.success('Payment started. Complete checkout to finish your vote.');
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
              <p className="text-[11px] uppercase tracking-[0.18em] text-red-500 font-semibold">Live Voting</p>
              <h1 className="text-xl font-bold text-brand-900 mt-1 leading-tight">{eventName}</h1>
            </div>
            <span className="pill-accent">Open</span>
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600">Selected Category</p>
            <p className="mt-1 text-lg font-semibold text-brand-900">{selectedContest?.title || 'Choose a category below'}</p>
            <p className="text-xs text-surface-600 mt-1">
              {(selectedContest?.options.length || 0).toLocaleString()} nominees
              {config?.allowPaidVotes ? ' - ' + formatMoney(config.currency, config.voteUnitPrice) + ' per vote' : ''}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-surface-200 bg-white px-2 py-2">
                <p className="text-[11px] text-surface-500">Nominees</p>
                <p className="text-base font-semibold text-brand-900">{selectedContest?.options.length || 0}</p>
              </div>
              <div className="rounded-xl border border-surface-200 bg-white px-2 py-2">
                <p className="text-[11px] text-surface-500">Mode</p>
                <p className="text-base font-semibold text-brand-900">{selectedContest?.mode || config?.mode || 'AWARDS'}</p>
              </div>
              <div className="rounded-xl border border-surface-200 bg-white px-2 py-2">
                <p className="text-[11px] text-surface-500">Verification</p>
                <p className="text-base font-semibold text-brand-900">{electionMode ? (otpVerified ? 'Complete' : 'Required') : 'Not required'}</p>
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
              <h2 className="text-base font-semibold text-brand-900">Secure Election Check</h2>
              <p className="text-xs text-surface-600">Verify your phone once to cast your vote in election mode.</p>
              <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto,auto] gap-2">
                <input
                  className="input"
                  placeholder="Phone number"
                  value={otpPhone}
                  onChange={(event) => setOtpPhone(event.target.value)}
                />
                <input
                  className="input"
                  placeholder="Verification code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                />
                <button className="btn-outline" onClick={requestOtp} disabled={submitting}>
                  Send code
                </button>
                <button className="btn-primary" onClick={verifyOtp} disabled={submitting}>
                  Verify
                </button>
              </div>
              <p className="text-xs text-surface-600">{otpVerified ? 'Verification complete.' : 'Verification is required before voting.'}</p>
            </section>
          ) : null}

          <section className="dashboard-canvas p-4 space-y-3">
            <h2 className="text-base font-semibold text-brand-900">Vote Setup</h2>
            <p className="text-xs text-surface-600">Choose a category, set vote quantity, then vote for your preferred nominee.</p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr,130px,1fr,auto] gap-2">
              <select
                className="input"
                value={selectedContestId}
                disabled={!hasContests}
                onChange={(event) => {
                  const nextContestId = event.target.value;
                  setSelectedContestId(nextContestId);
                  const contest = contests.find((item) => item.id === nextContestId);
                  const firstOption = contest?.options?.[0];
                  setSelectedOptionId(firstOption?.id || '');
                }}
              >
                {!hasContests ? (
                  <option value="">No categories available</option>
                ) : null}
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
                disabled={!hasContests}
                onChange={(event) => setVoteCount(Math.max(1, Number(event.target.value || 1)))}
              />
              <select
                className="input"
                value={selectedGatewayId}
                disabled={!canUsePaidVoting}
                onChange={(event) => setSelectedGatewayId(event.target.value)}
              >
                {!canUsePaidVoting ? (
                  <option value="">
                    {config?.allowPaidVotes ? 'No payment gateway available' : 'Paid voting is disabled'}
                  </option>
                ) : null}
                {paymentGateways.map((gateway) => (
                  <option key={gateway.id} value={gateway.id}>
                    {gateway.name} ({gateway.currency})
                  </option>
                ))}
              </select>
              <button className="btn-accent" onClick={() => { void createPaidIntent(); }} disabled={submitting || !canUsePaidVoting || !hasContests}>
                Pay & Vote
              </button>
            </div>
            {!hasContests ? (
              <p className="text-xs text-surface-600">This event has no published nominees yet. Check back soon.</p>
            ) : null}
            {config?.allowPaidVotes && !hasGateways ? (
              <p className="text-xs text-surface-600">Paid voting is enabled but no payment gateway is currently available for this event.</p>
            ) : null}
            {config?.allowFreeVotes ? (
              <button className="btn-outline w-full md:w-auto" onClick={() => { void castFreeVote(); }} disabled={submitting || !hasContests}>
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
            <input
              className="input"
              placeholder="Search nominee by name or description"
              value={nomineeSearch}
              onChange={(event) => setNomineeSearch(event.target.value)}
            />
            <div className="space-y-2">
              {filteredRankedOptions.length === 0 ? (
                <div className="rounded-xl border border-surface-200 bg-white p-3 text-sm text-surface-600">
                  No nominees match your search.
                </div>
              ) : null}
              {filteredRankedOptions.map((option) => {
                const selected = selectedOptionId === option.id;
                return (
                  <article
                    key={option.id}
                    className={`rounded-2xl border px-3 py-3 transition-all ${
                      selected ? 'border-red-300 bg-red-50/60' : 'border-surface-200 bg-white hover:border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {resolveNomineeImage(option) ? (
                        <img
                          src={resolveNomineeImage(option)}
                          alt={option.name}
                          className="h-10 w-10 rounded-full border border-surface-200 object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-surface-100 border border-surface-200" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-brand-900 truncate">{option.name}</p>
                          <p className="text-xs text-surface-500">#{option.rank}</p>
                        </div>
                        <p className="text-xs text-surface-600 truncate">{option.description || 'Tap vote to support this nominee.'}</p>
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
              <h2 className="text-base font-semibold text-brand-900">Current Leaders</h2>
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
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.imageUrl || entry.imagePath ? (
                        <img
                          src={entry.imageUrl || entry.imagePath}
                          alt={entry.name}
                          className="h-9 w-9 rounded-full border border-surface-200 object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full border border-surface-200 bg-surface-100" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-surface-500">Rank #{entry.rank}</p>
                        <p className="font-semibold text-brand-900 truncate">{entry.name}</p>
                        <p className="text-xs text-surface-600 truncate">{entry.description || 'Top performing nominee'}</p>
                      </div>
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
              <p className="text-sm text-surface-600">Results will appear here once voting starts.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

