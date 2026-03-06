'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import ElectionOtpPanel from '@/components/voting/ElectionOtpPanel';
import PublicVoteOptionCard from '@/components/voting/PublicVoteOptionCard';
import VoteSetupPanel from '@/components/voting/VoteSetupPanel';
import VoteSidebarCard from '@/components/voting/VoteSidebarCard';
import { votingApi } from '@/lib/api';
import VotingPublicLayout from '@/components/voting/VotingPublicLayout';

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

  const rankedOptions = useMemo(() => {
    const options = selectedContest?.options || [];
    return [...options]
      .sort((a, b) => Number(b.totalVotes || 0) - Number(a.totalVotes || 0))
      .map((option, index) => ({
        ...option,
        rank: index + 1,
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
      const publicResponse = await votingApi.getPublicVoting(slug, persisted || undefined, embedToken || undefined);

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

      const gateways = (Array.isArray(payload.paymentGateways) ? payload.paymentGateways : []) as PaymentGateway[];

      setEventName(String(payload?.event?.name || slug));
      setConfig(normalizedConfig);
      setContests(normalizedContests);
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

  const copyDirectVoteLink = async (optionId: string) => {
    if (!selectedContest) return;
    const url = `${window.location.origin}/e/${slug}/vote?contestId=${encodeURIComponent(selectedContest.id)}&optionId=${encodeURIComponent(optionId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Direct vote link copied');
    } catch {
      toast.error('Unable to copy vote link');
    }
  };

  return (
    <VotingPublicLayout
      slug={slug}
      eventName={eventName}
      activeTab="vote"
      contestId={selectedContestId}
      showNominateCta={Boolean(config?.allowPublicNominations)}
    >
      <div className="space-y-5">
        <section className="subtle-toolbar">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-900">
              {selectedContest?.title || 'Choose a category'}
            </p>
            <p className="mt-1 text-sm text-surface-500">
              {(selectedContest?.options.length || 0).toLocaleString()} nominees
              {config?.allowPaidVotes ? ` · ${formatMoney(config.currency, config.voteUnitPrice)} per vote` : ''}
            </p>
          </div>
          {config ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-100 px-3 py-1.5 text-xs font-semibold text-surface-600">
                {config.mode === 'ELECTION' ? 'Election' : 'Awards'}
              </span>
              {config.allowFreeVotes ? (
                <span className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-brand-900">Free votes</span>
              ) : null}
              {config.allowPaidVotes ? (
                <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-900">Paid votes</span>
              ) : null}
            </div>
          ) : null}
        </section>

        {hasContests ? (
          <div className="page-tabs overflow-x-auto scrollbar-hide">
            {contests.map((contest) => (
              <button
                key={contest.id}
                type="button"
                className={`page-tabs-item ${selectedContestId === contest.id ? 'page-tabs-item-active' : ''}`}
                onClick={() => {
                  setSelectedContestId(contest.id);
                  setSelectedOptionId(contest.options?.[0]?.id || '');
                }}
              >
                {contest.title}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <VoteSidebarCard
              categoryTitle={selectedContest?.title || 'Choose a category'}
              nomineeCountLabel={`${(selectedContest?.options.length || 0).toLocaleString()} nominees${
                config?.allowPaidVotes ? ` · ${formatMoney(config.currency, config.voteUnitPrice)} per vote` : ''
              }`}
              selectedNomineeName={selectedOption?.name || 'Pick a nominee below'}
              selectedNomineeVotesLabel={
                selectedOption
                  ? `${selectedOption.totalVotes.toLocaleString()} total votes`
                  : 'No nominee selected yet.'
              }
              canFreeVote={Boolean(config?.allowFreeVotes)}
              canPaidVote={Boolean(config?.allowPaidVotes)}
              canVote={!submitting && hasContests && (!config?.allowPaidVotes || canUsePaidVoting)}
              showNoGatewayMessage={Boolean(config?.allowPaidVotes && !hasGateways)}
              showNoContestMessage={!hasContests}
              directVoteNotice={optionQuery && selectedOption ? `You are ready to vote for ${selectedOption.name}.` : undefined}
              onFreeVote={() => {
                void castFreeVote();
              }}
              onPaidVote={() => {
                void createPaidIntent();
              }}
            />

            {config && electionMode ? (
              <ElectionOtpPanel
                otpPhone={otpPhone}
                otpCode={otpCode}
                otpVerified={otpVerified}
                submitting={submitting}
                onPhoneChange={setOtpPhone}
                onCodeChange={setOtpCode}
                onRequestOtp={() => {
                  void requestOtp();
                }}
                onVerifyOtp={() => {
                  void verifyOtp();
                }}
              />
            ) : null}

            {config?.allowPaidVotes ? (
              <VoteSetupPanel
                title="Buy extra votes"
                helperText="Choose quantity and payment method, then continue to checkout."
                selectedContestId={selectedContestId}
                voteCount={voteCount}
                selectedGatewayId={selectedGatewayId}
                hasContests={hasContests}
                canUsePaidVoting={canUsePaidVoting}
                maxVotesPerPurchase={config?.maxVotesPerPurchase || 100}
                contests={contests.map((contest) => ({ id: contest.id, title: contest.title, mode: contest.mode }))}
                paymentGateways={paymentGateways.map((gateway) => ({
                  id: gateway.id,
                  name: gateway.name,
                  currency: gateway.currency,
                }))}
                onContestChange={(nextContestId) => {
                  setSelectedContestId(nextContestId);
                  const contest = contests.find((item) => item.id === nextContestId);
                  const firstOption = contest?.options?.[0];
                  setSelectedOptionId(firstOption?.id || '');
                }}
                onVoteCountChange={(value) => setVoteCount(Math.max(1, value))}
                onGatewayChange={setSelectedGatewayId}
                onSubmit={() => {
                  void createPaidIntent();
                }}
                submitDisabled={submitting || !canUsePaidVoting || !hasContests}
                paidVotingEnabled={Boolean(config?.allowPaidVotes)}
              />
            ) : null}
          </div>

          <section className="detail-card space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Nominees</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">Choose who to support</h2>
                <p className="mt-1 text-sm text-surface-500">Tap a nominee to vote immediately or open the full profile first.</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs font-medium text-surface-500">Current vote amount</p>
                <p className="mt-1 text-lg font-semibold text-brand-900">{config ? formatMoney(config.currency, voteAmount) : ''}</p>
              </div>
            </div>

            <input
              className="input"
              placeholder="Search nominee by name or description"
              value={nomineeSearch}
              onChange={(event) => setNomineeSearch(event.target.value)}
            />

            {filteredRankedOptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-10 text-center text-sm text-surface-500">
                No nominees match your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredRankedOptions.map((option) => {
                  const selected = selectedOptionId === option.id;
                  return (
                    <PublicVoteOptionCard
                      key={option.id}
                      imageSrc={resolveNomineeImage(option)}
                      name={option.name}
                      description={option.description || 'Vote now to support this nominee.'}
                      votesLabel={`${option.totalVotes.toLocaleString()} votes`}
                      selected={selected}
                      voteButtonLabel={
                        config?.allowPaidVotes ? `Vote ${formatMoney(config.currency, config.voteUnitPrice)}` : 'Vote'
                      }
                      profileHref={`/e/${slug}/nominee/${encodeURIComponent(option.id)}?contestId=${encodeURIComponent(selectedContest?.id || '')}`}
                      onVote={() => {
                        setSelectedOptionId(option.id);
                        void quickVoteForOption(option.id);
                      }}
                      onCopyVoteLink={() => {
                        void copyDirectVoteLink(option.id);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </VotingPublicLayout>
  );
}

