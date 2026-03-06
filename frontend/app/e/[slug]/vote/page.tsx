'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import ElectionOtpPanel from '@/components/voting/ElectionOtpPanel';
import PublicStateCard from '@/components/voting/PublicStateCard';
import { votingApi } from '@/lib/api';
import VotingPublicLayout from '@/components/voting/VotingPublicLayout';

type VotingConfig = {
  mode: 'AWARDS' | 'ELECTION';
  isEnabled?: boolean;
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
  isActive?: boolean;
  allowPublicNominations?: boolean;
  options: VotingOption[];
};

type PaymentGateway = {
  id: string;
  name: string;
  gateway: string;
  currency: string;
  isActive?: boolean;
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

const SESSION_STORAGE_KEY_PREFIX = 'vote_session_token:';

const formatMoney = (currency: string, amount: number) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const normalizePaymentGateways = (payload: any): PaymentGateway[] => {
  const directList = Array.isArray(payload?.paymentGateways) ? payload.paymentGateways : [];
  const alternateList = Array.isArray(payload?.gateways) ? payload.gateways : [];
  const nestedList = Array.isArray(payload?.eventGateways) ? payload.eventGateways : [];
  const singular = payload?.gateway ? [payload.gateway] : [];

  const merged = [
    ...directList,
    ...alternateList,
    ...singular,
    ...nestedList.map((entry: any) => entry?.paymentGateway || entry),
  ].filter(Boolean);

  return merged
    .map((gateway: any) => ({
      id: String(gateway?.id || gateway?.paymentGatewayId || ''),
      name: String(gateway?.name || gateway?.paymentGateway?.name || 'Payment method'),
      gateway: String(gateway?.gateway || gateway?.paymentGateway?.gateway || ''),
      currency: String(gateway?.currency || gateway?.paymentGateway?.currency || 'USD'),
      isActive: gateway?.isActive !== false,
    }))
    .filter((gateway: PaymentGateway) => Boolean(gateway.id) && gateway.isActive !== false);
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

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
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === selectedContestId) || null,
    [contests, selectedContestId]
  );

  const selectedOption = useMemo(
    () => selectedContest?.options.find((option) => option.id === selectedOptionId) || null,
    [selectedContest, selectedOptionId]
  );

  const electionMode = (selectedContest?.mode || config?.mode || 'AWARDS') === 'ELECTION';
  const hasGateways = paymentGateways.length > 0;
  const canUsePaidVoting = Boolean(config?.allowPaidVotes && hasGateways);
  const nominationsAvailable = Boolean(
    config?.allowPublicNominations && contests.some((contest) => contest.allowPublicNominations)
  );
  const amountLabel = config ? formatMoney(config.currency, voteCount * config.voteUnitPrice) : '';
  const requiresOtp = Boolean(electionMode && config?.requireOtpForElection && !otpVerified);
  const hasVoteTarget = Boolean(selectedContest && selectedOption);
  const canSubmitFreeVote = Boolean(config?.allowFreeVotes && hasVoteTarget && !requiresOtp);
  const canStartPaidVote = Boolean(config?.allowPaidVotes && hasVoteTarget && !requiresOtp);

  const fetchVoteData = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const persisted = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      const publicResponse = await votingApi.getPublicVoting(slug, persisted || undefined, embedToken || undefined);
      const payload = ((publicResponse.data as any)?.data || publicResponse.data || {}) as Partial<VotingEventPayload>;
      const rawContests = Array.isArray(payload.contests) ? payload.contests : [];

      const normalizedContests: VotingContest[] = rawContests
        .map((contest: any) => ({
          id: String(contest?.id || ''),
          title: String(contest?.title || contest?.name || 'Untitled contest'),
          description: contest?.description ? String(contest.description) : null,
          mode: (contest?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
          isActive: contest?.isActive !== false,
          allowPublicNominations: Boolean(contest?.allowPublicNominations),
          options: (Array.isArray(contest?.options) ? contest.options : [])
            .map((option: any) => ({
              id: String(option?.id || option?.optionId || ''),
              name: String(option?.name || 'Unnamed nominee'),
              description: option?.description ? String(option.description) : null,
              imagePath: option?.imagePath ? String(option.imagePath) : null,
              imageUrl: option?.imageUrl ? String(option.imageUrl) : null,
              totalVotes: Number(option?.totalVotes || 0),
              freeVotes: Number(option?.freeVotes || 0),
              paidVotes: Number(option?.paidVotes || 0),
            }))
            .filter((option: VotingOption) => Boolean(option.id)),
        }))
        .filter((contest) => contest.id);

      const normalizedConfig: VotingConfig | null = payload.config
        ? {
            mode: payload.config.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS',
            isEnabled: payload.config.isEnabled !== false,
            allowFreeVotes: Boolean(payload.config.allowFreeVotes),
            allowPaidVotes: Boolean(payload.config.allowPaidVotes),
            allowPublicNominations: Boolean(payload.config.allowPublicNominations),
            requireOtpForElection: Boolean(payload.config.requireOtpForElection),
            voteUnitPrice: Number(payload.config.voteUnitPrice || 0),
            currency: String(payload.config.currency || 'USD'),
            maxVotesPerPurchase: Math.max(1, Number(payload.config.maxVotesPerPurchase || 1)),
          }
        : null;

      const gateways = normalizePaymentGateways(payload);

      setEventName(String(payload?.event?.name || slug));
      setConfig(normalizedConfig);
      setContests(normalizedContests);
      setPaymentGateways(gateways);
      setSelectedGatewayId((current) => current || gateways[0]?.id || '');

      if (normalizedContests.length > 0) {
        const queriedContest = contestQuery
          ? normalizedContests.find((contest) => contest.id === contestQuery)
          : null;
        const queriedContestByOption = optionQuery
          ? normalizedContests.find((contest) => contest.options.some((option) => option.id === optionQuery))
          : null;
        const contest = queriedContest || queriedContestByOption || normalizedContests[0];
        setSelectedContestId(contest.id);
        const nextOption = optionQuery
          ? contest.options.find((option) => option.id === optionQuery) || contest.options[0]
          : contest.options[0];
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

  const castFreeVote = async () => {
    if (!selectedContest || !selectedOption) {
      toast.error('Choose a nominee first');
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
      toast.error(error?.response?.data?.error || 'Vote failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openCheckoutWindow = (url: string) => {
    const popup = window.open(url, 'eventpeepo-vote-checkout', 'popup=yes,width=540,height=760');
    if (!popup) {
      toast.error('Allow pop-ups to continue with payment');
      return false;
    }
    popup.focus();
    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        setCheckoutOpen(false);
        void (async () => {
          for (let attempt = 0; attempt < 5; attempt += 1) {
            await fetchVoteData();
            if (attempt < 4) await sleep(2500);
          }
        })();
      }
    }, 1000);
    return true;
  };

  const startPaidVote = async () => {
    if (!config || !selectedContest || !selectedOption) {
      toast.error('Choose a nominee first');
      return;
    }
    if (!selectedGatewayId) {
      toast.error('Choose a payment method');
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
        if (openCheckoutWindow(String(nextAction.url))) {
          toast.success('Checkout opened in a new window');
        }
        return;
      }
      toast.success('Payment started. Complete checkout to finish your vote.');
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50">
        <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-brand-900" />
      </div>
    );
  }

  if (!hasVoteTarget) {
    return (
      <PublicStateCard
        title="Choose a nominee first"
        description="Voting now starts from the nominees page. Pick a nominee there, then continue here to confirm your vote."
        actionHref={`/e/${slug}/nominees`}
        actionLabel="Back to nominees"
      />
    );
  }

  const primaryActionLabel = canUsePaidVoting
    ? 'Continue To Checkout'
    : electionMode
    ? 'Submit Election Vote'
    : 'Submit Vote';

  return (
    <VotingPublicLayout
      slug={slug}
      eventName={eventName}
      activeTab="nominees"
      contestId={selectedContestId}
      showNominateCta={nominationsAvailable}
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="detail-card overflow-hidden">
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Ready to vote</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-900">{selectedContest?.title}</h2>
              <p className="mt-2 text-sm text-surface-500">
                Voting for <span className="font-semibold text-brand-900">{selectedOption?.name}</span>
                {config?.allowPaidVotes ? ` - ${formatMoney(config.currency, config.voteUnitPrice)} per vote` : ''}
              </p>
              <p className="mt-2 text-sm text-surface-500">
                Category: <span className="font-semibold text-brand-900">{selectedContest?.title}</span>
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-[132px_minmax(0,1fr)]">
              {selectedOption?.imageUrl || selectedOption?.imagePath ? (
                <img
                  src={selectedOption.imageUrl || selectedOption.imagePath || ''}
                  alt={selectedOption.name}
                  className="h-32 w-32 rounded-[28px] border border-surface-200 object-cover"
                />
              ) : (
                <div className="h-32 w-32 rounded-[28px] border border-surface-200 bg-surface-100" />
              )}

              <div className="space-y-4">
                <div className="rounded-3xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">Selected nominee</p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-brand-900">{selectedOption?.name}</p>
                  <p className="mt-1 text-sm text-surface-500">{selectedOption?.totalVotes.toLocaleString()} total votes</p>
                </div>

                <div className="rounded-3xl border border-surface-200 bg-white p-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-surface-500">Number of votes</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={config?.allowPaidVotes ? config.maxVotesPerPurchase : 1}
                      value={config?.allowPaidVotes ? voteCount : 1}
                      disabled={!config?.allowPaidVotes}
                      onChange={(event) => setVoteCount(Math.max(1, Number(event.target.value || 1)))}
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-50 px-3 py-3 text-sm text-surface-500">
                    <span>Category: {selectedContest?.title}</span>
                    <span className="font-semibold text-brand-900">{config?.allowPaidVotes ? amountLabel : '1 vote'}</span>
                  </div>
                </div>

                {config?.allowPaidVotes && !canUsePaidVoting ? (
                  <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Paid voting is enabled but no payment gateway is available for this event.
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <button
                    className="btn-primary w-full"
                    disabled={
                      submitting ||
                      requiresOtp ||
                      (canUsePaidVoting ? !canStartPaidVote : !canSubmitFreeVote)
                    }
                    onClick={() => {
                      if (canUsePaidVoting) {
                        setCheckoutOpen(true);
                        return;
                      }
                      void castFreeVote();
                    }}
                  >
                    {submitting ? 'Please wait...' : primaryActionLabel}
                  </button>

                  {config?.allowFreeVotes && config?.allowPaidVotes ? (
                    <button
                      className="btn-outline w-full"
                      disabled={submitting || !canSubmitFreeVote}
                      onClick={() => {
                        void castFreeVote();
                      }}
                    >
                      Use Free Vote Instead
                    </button>
                  ) : null}

                  <Link href={`/e/${slug}/nominees?contestId=${encodeURIComponent(selectedContestId)}`} className="btn-ghost w-full text-center">
                    Back to nominees
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

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

        {checkoutOpen && config ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-950/45 p-3 sm:items-center sm:p-6">
            <div className="w-full max-w-lg rounded-[28px] border border-surface-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Checkout</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">Complete your vote</h3>
                  <p className="mt-1 text-sm text-surface-500">
                    Voting for {selectedOption?.name} in {selectedContest?.title}.
                  </p>
                </div>
                <button className="btn-ghost px-3" onClick={() => setCheckoutOpen(false)}>
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-surface-500">Payment method</span>
                  <select className="input" value={selectedGatewayId} onChange={(event) => setSelectedGatewayId(event.target.value)}>
                    {paymentGateways.map((gateway) => (
                      <option key={gateway.id} value={gateway.id}>
                        {gateway.name} ({gateway.currency})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-2 rounded-3xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">Nominee</p>
                    <p className="mt-1 font-semibold text-brand-900">{selectedOption?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">Category</p>
                    <p className="mt-1 font-semibold text-brand-900">{selectedContest?.title}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">Votes</p>
                    <p className="mt-1 font-semibold text-brand-900">{voteCount}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">Total</p>
                    <p className="mt-1 font-semibold text-brand-900">{amountLabel}</p>
                  </div>
                </div>

                <button className="btn-primary w-full" disabled={submitting || !selectedGatewayId || !canStartPaidVote} onClick={() => { void startPaidVote(); }}>
                  {submitting ? 'Opening checkout...' : 'Open Payment Window'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </VotingPublicLayout>
  );
}
