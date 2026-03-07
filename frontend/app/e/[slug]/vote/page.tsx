'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import ElectionOtpPanel from '@/components/voting/ElectionOtpPanel';
import PublicStateCard from '@/components/voting/PublicStateCard';
import { votingApi } from '@/lib/api';
import VotingPublicLayout from '@/components/voting/VotingPublicLayout';
import { resolvePublicAssetUrl } from '@/lib/utils';

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
  settingsJson?: Record<string, unknown> | null;
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
    manualIdVerified?: boolean;
    verifiedManualName?: string | null;
    verification?: {
      requiresPhoneOtp?: boolean;
      requiresManualId?: boolean;
      manualIdLabel?: string;
    };
  };
};

type VerificationSettings = {
  requiresPhoneOtp: boolean;
  requiresManualId: boolean;
  manualIdLabel: string;
};

const SESSION_STORAGE_KEY_PREFIX = 'vote_session_token:';
const VOTE_CHECKOUT_CONTEXT_KEY = 'eventpeepo_vote_checkout_context';
const VOTE_PAYMENT_STATUS_KEY_PREFIX = 'eventpeepo_vote_payment_status:';
const VOTE_PAYMENT_DONE_EVENT = 'EVENTPEEPO_VOTE_PAYMENT_DONE';

type VotePaymentMessage = {
  type: typeof VOTE_PAYMENT_DONE_EVENT;
  status: 'success' | 'cancelled';
  slug: string;
  contestId?: string;
  optionId?: string;
};

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
const clampVoteCount = (value: number, max: number) => Math.min(Math.max(1, value), Math.max(1, max));
const parseSettingsJson = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
};

const getVerificationSettings = (
  config: VotingConfig | null,
  sessionVerification?: VotingEventPayload['voterSession']['verification']
): VerificationSettings => {
  const settings = parseSettingsJson(config?.settingsJson);
  const verification =
    settings?.verification && typeof settings.verification === 'object' && !Array.isArray(settings.verification)
      ? (settings.verification as Record<string, unknown>)
      : {};
  return {
    requiresPhoneOtp: Boolean(sessionVerification?.requiresPhoneOtp ?? config?.requireOtpForElection),
    requiresManualId: Boolean(sessionVerification?.requiresManualId ?? verification.manualIdEnabled),
    manualIdLabel:
      String(sessionVerification?.manualIdLabel || verification.manualIdLabel || 'Voter ID').trim() || 'Voter ID',
  };
};

export default function VotePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.slug || '');
  const contestQuery = String(searchParams.get('contestId') || '');
  const optionQuery = String(searchParams.get('optionId') || '');
  const embedToken = String(searchParams.get('token') || searchParams.get('embedToken') || '');
  const storageKey = `${SESSION_STORAGE_KEY_PREFIX}${slug}`;
  const paymentStatusKey = `${VOTE_PAYMENT_STATUS_KEY_PREFIX}${slug}`;

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
  const [manualIdValue, setManualIdValue] = useState('');
  const [manualIdVerified, setManualIdVerified] = useState(false);
  const [manualIdName, setManualIdName] = useState<string | null>(null);
  const [sessionVerification, setSessionVerification] = useState<VotingEventPayload['voterSession']['verification']>();
  const [voteCount, setVoteCount] = useState(1);
  const [selectedGatewayId, setSelectedGatewayId] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const checkoutPopupRef = useRef<Window | null>(null);

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === selectedContestId) || null,
    [contests, selectedContestId]
  );

  const selectedOption = useMemo(
    () => selectedContest?.options.find((option) => option.id === selectedOptionId) || null,
    [selectedContest, selectedOptionId]
  );
  const nomineeProfileHref = selectedOption
    ? `/e/${slug}/nominee/${encodeURIComponent(selectedOption.id)}?contestId=${encodeURIComponent(selectedContestId)}`
    : `/e/${slug}/nominees`;

  const electionMode = (selectedContest?.mode || config?.mode || 'AWARDS') === 'ELECTION';
  const verification = useMemo(
    () => getVerificationSettings(config, sessionVerification),
    [config, sessionVerification]
  );
  const hasGateways = paymentGateways.length > 0;
  const canUsePaidVoting = Boolean(config?.allowPaidVotes && hasGateways);
  const nominationsAvailable = Boolean(
    config?.allowPublicNominations && contests.some((contest) => contest.allowPublicNominations)
  );
  const amountLabel = config ? formatMoney(config.currency, voteCount * config.voteUnitPrice) : '';
  const phoneVerificationPending = verification.requiresPhoneOtp && !otpVerified;
  const manualIdVerificationPending = verification.requiresManualId && !manualIdVerified;
  const requiresOtp = phoneVerificationPending || manualIdVerificationPending;
  const hasVoteTarget = Boolean(selectedContest && selectedOption);
  const canSubmitFreeVote = Boolean(config?.allowFreeVotes && hasVoteTarget && !requiresOtp);
  const canStartPaidVote = Boolean(config?.allowPaidVotes && hasVoteTarget && !requiresOtp);

  const fetchVoteData = async (showLoading = true) => {
    if (!slug) return;
    if (showLoading) setLoading(true);
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
            settingsJson: parseSettingsJson((payload.config as any).settingsJson),
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
      setManualIdVerified(Boolean(payload.voterSession?.manualIdVerified));
      setManualIdName(payload.voterSession?.verifiedManualName || null);
      setSessionVerification(payload.voterSession?.verification);
      if (payload.voterSession?.token) {
        setSessionToken(payload.voterSession.token);
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, payload.voterSession.token);
        }
      }
    } catch (error: any) {
      if (showLoading) {
        toast.error(error?.response?.data?.error || 'Failed to load voting page');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    void fetchVoteData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, embedToken, contestQuery, optionQuery]);

  useEffect(() => {
    if (!slug) return;

    const refreshVoteViews = async (status?: 'success' | 'cancelled') => {
      setCheckoutOpen(false);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await fetchVoteData(false);
        if (attempt < 3) await sleep(2000);
      }
      if (status === 'success') {
        toast.success('Payment completed');
      }
      if (status === 'cancelled') {
        toast('Payment cancelled');
      }
    };

    const handleMessage = (event: MessageEvent) => {
      const payload = event.data as VotePaymentMessage | undefined;
      if (!payload || payload.type !== VOTE_PAYMENT_DONE_EVENT || payload.slug !== slug) return;
      void refreshVoteViews(payload.status);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== paymentStatusKey || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue) as { status?: 'success' | 'cancelled' };
        if (payload?.status) {
          void refreshVoteViews(payload.status);
        }
      } catch {
        // Ignore malformed payloads
      }
    };

    const handleFocus = () => {
      if (document.visibilityState !== 'visible') return;
      void fetchVoteData(false);
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void fetchVoteData(false);
    }, 12000);

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [paymentStatusKey, slug]);

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
    checkoutPopupRef.current = popup;
    popup.focus();
    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        checkoutPopupRef.current = null;
        setCheckoutOpen(false);
        void (async () => {
          for (let attempt = 0; attempt < 5; attempt += 1) {
            await fetchVoteData(false);
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
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            VOTE_CHECKOUT_CONTEXT_KEY,
            JSON.stringify({
              slug,
              eventName,
              contestId: selectedContest.id,
              contestTitle: selectedContest.title,
              optionId: selectedOption.id,
              optionName: selectedOption.name,
              amountLabel,
            })
          );
        }
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

  const verifyManualId = async () => {
    if (!manualIdValue.trim()) {
      toast.error(`Enter your ${verification.manualIdLabel}`);
      return;
    }
    setSubmitting(true);
    try {
      const response = await votingApi.verifyManualVoterId({
        slug,
        voterId: manualIdValue.trim(),
        sessionToken: sessionToken || undefined,
        embedToken: embedToken || undefined,
      });
      const token = response.data?.voterSessionToken;
      if (token) {
        setSessionToken(token);
        if (typeof window !== 'undefined') localStorage.setItem(storageKey, token);
      }
      setManualIdVerified(Boolean(response.data?.verified));
      setManualIdName(response.data?.matchedName || null);
      toast.success(
        response.data?.matchedName
          ? `${verification.manualIdLabel} verified for ${response.data.matchedName}`
          : `${verification.manualIdLabel} verified`
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.error || `${verification.manualIdLabel} verification failed`);
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
    ? 'Submit Vote'
    : electionMode
    ? 'Submit Election Vote'
    : 'Submit Vote';

  const votePanel = (
    <section className="detail-card overflow-hidden !p-4 sm:!p-5">
      <div className="space-y-5">
        <div className="hidden space-y-2 md:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Ready to vote</p>
          <h2 className="text-3xl font-semibold leading-[1.08] tracking-tight text-brand-900">{selectedContest?.title}</h2>
          <p className="text-sm leading-6 text-surface-500">
            Voting for{' '}
            <Link href={nomineeProfileHref} className="font-semibold text-brand-900 underline-offset-4 hover:underline">
              {selectedOption?.name}
            </Link>
            {config?.allowPaidVotes ? ` - ${formatMoney(config.currency, config.voteUnitPrice)} per vote` : ''}
          </p>
          <p className="text-sm leading-6 text-surface-500">
            Category: <span className="font-semibold text-brand-900">{selectedContest?.title}</span>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[132px_minmax(0,1fr)] md:gap-5">
          <div className="mx-auto w-fit md:mx-0">
            {resolvePublicAssetUrl(selectedOption?.imageUrl || selectedOption?.imagePath) ? (
              <img
                src={resolvePublicAssetUrl(selectedOption?.imageUrl || selectedOption?.imagePath) || ''}
                alt={selectedOption?.name || 'Nominee'}
                className="h-24 w-24 rounded-[24px] border border-surface-200 object-cover md:h-32 md:w-32 md:rounded-[28px]"
              />
            ) : (
              <div className="h-24 w-24 rounded-[24px] border border-surface-200 bg-surface-100 md:h-32 md:w-32 md:rounded-[28px]" />
            )}
          </div>

          <div className="w-full space-y-4">
            <div className="space-y-2 md:hidden">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Ready to vote</p>
              <h2 className="text-2xl font-semibold leading-[1.1] tracking-tight text-brand-900">{selectedContest?.title}</h2>
              <p className="text-sm leading-6 text-surface-500">
                Voting for{' '}
                <Link href={nomineeProfileHref} className="font-semibold text-brand-900 underline-offset-4 hover:underline">
                  {selectedOption?.name}
                </Link>
                {config?.allowPaidVotes ? ` - ${formatMoney(config.currency, config.voteUnitPrice)} per vote` : ''}
              </p>
              <p className="text-sm leading-6 text-surface-500">
                Category: <span className="font-semibold text-brand-900">{selectedContest?.title}</span>
              </p>
            </div>

            <div className="rounded-3xl border border-surface-200 bg-surface-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">Selected nominee</p>
              <Link href={nomineeProfileHref} className="mt-2 block text-xl font-semibold tracking-tight text-brand-900 underline-offset-4 hover:underline">
                {selectedOption?.name}
              </Link>
              <p className="mt-1 text-sm leading-6 text-surface-500">{selectedOption?.totalVotes.toLocaleString()} total votes</p>
            </div>

            <div className="rounded-3xl border border-surface-200 bg-white p-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-surface-500">Number of votes</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-outline h-12 w-12 justify-center rounded-2xl px-0"
                    disabled={!config?.allowPaidVotes || voteCount <= 1}
                    onClick={() => setVoteCount((current) => clampVoteCount(current - 1, config?.maxVotesPerPurchase || 1))}
                  >
                    -
                  </button>
                  <input
                    className="input text-center"
                    type="number"
                    min={1}
                    max={config?.allowPaidVotes ? config.maxVotesPerPurchase : 1}
                    value={config?.allowPaidVotes ? voteCount : 1}
                    disabled={!config?.allowPaidVotes}
                    onChange={(event) => setVoteCount(clampVoteCount(Number(event.target.value || 1), config?.maxVotesPerPurchase || 1))}
                  />
                  <button
                    type="button"
                    className="btn-outline h-12 w-12 justify-center rounded-2xl px-0"
                    disabled={!config?.allowPaidVotes || voteCount >= (config?.maxVotesPerPurchase || 1)}
                    onClick={() => setVoteCount((current) => clampVoteCount(current + 1, config?.maxVotesPerPurchase || 1))}
                  >
                    +
                  </button>
                </div>
              </label>
              <div className="mt-4 space-y-2 rounded-2xl border border-surface-200 bg-surface-50 px-3 py-3 text-sm text-surface-600">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Your vote summary</p>
                <p>
                  Category: <span className="font-semibold text-brand-900">{selectedContest?.title}</span>
                </p>
                <p>
                  Nominee: <span className="font-semibold text-brand-900">{selectedOption?.name}</span>
                </p>
                <p>
                  Votes: <span className="font-semibold text-brand-900">{config?.allowPaidVotes ? voteCount : 1}</span>
                </p>
                <p>
                  Total: <span className="font-semibold text-brand-900">{config?.allowPaidVotes ? amountLabel : '1 vote'}</span>
                </p>
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
  );

  return (
    <VotingPublicLayout
      slug={slug}
      eventName={eventName}
      activeTab="nominees"
      contestId={selectedContestId}
      showNominateCta={nominationsAvailable}
      step={requiresOtp ? 'verify' : 'cast'}
      desktopAside={votePanel}
    >
        {(verification.requiresPhoneOtp || verification.requiresManualId) ? (
          <ElectionOtpPanel
            requiresPhoneOtp={verification.requiresPhoneOtp}
            requiresManualId={verification.requiresManualId}
            manualIdLabel={verification.manualIdLabel}
            otpPhone={otpPhone}
            otpCode={otpCode}
            otpVerified={otpVerified}
            manualIdValue={manualIdValue}
            manualIdVerified={manualIdVerified}
            manualIdName={manualIdName}
            submitting={submitting}
            onPhoneChange={(value) => {
              setOtpPhone(value);
              setOtpVerified(false);
            }}
            onCodeChange={setOtpCode}
            onManualIdChange={(value) => {
              setManualIdValue(value);
              setManualIdVerified(false);
              setManualIdName(null);
            }}
            onRequestOtp={() => {
              void requestOtp();
            }}
            onVerifyOtp={() => {
              void verifyOtp();
            }}
            onVerifyManualId={() => {
              void verifyManualId();
            }}
          />
        ) : null}

      {checkoutOpen && config ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-950/45 p-0 backdrop-blur-md sm:items-center sm:p-6">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-surface-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:rounded-[28px] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Checkout</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">Complete your vote</h3>
                <p className="mt-1 text-sm leading-6 text-surface-500">
                  Voting for{' '}
                  <Link href={nomineeProfileHref} className="font-semibold text-brand-900 underline-offset-4 hover:underline">
                    {selectedOption?.name}
                  </Link>{' '}
                  in {selectedContest?.title}.
                </p>
              </div>
              <button className="btn-ghost shrink-0 px-3" onClick={() => setCheckoutOpen(false)}>
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
                {submitting ? 'Opening checkout...' : 'Continue to Payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </VotingPublicLayout>
  );
}
