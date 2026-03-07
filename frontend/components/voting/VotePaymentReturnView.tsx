'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const VOTE_CHECKOUT_CONTEXT_KEY = 'eventpeepo_vote_checkout_context';
const VOTE_PAYMENT_STATUS_KEY_PREFIX = 'eventpeepo_vote_payment_status:';
const VOTE_PAYMENT_DONE_EVENT = 'EVENTPEEPO_VOTE_PAYMENT_DONE';

type VoteCheckoutContext = {
  slug?: string;
  eventName?: string;
  contestId?: string;
  contestTitle?: string;
  optionId?: string;
  optionName?: string;
  amountLabel?: string;
};

const normalizeStatus = (value: string | null) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'cancelled' || raw === 'canceled' || raw === 'cancel') return 'cancelled' as const;
  return 'success' as const;
};

export default function VotePaymentReturnView({ slugFromParams }: { slugFromParams?: string }) {
  const searchParams = useSearchParams();
  const [context, setContext] = useState<VoteCheckoutContext | null>(null);
  const [hasOpener, setHasOpener] = useState(false);
  const status = normalizeStatus(searchParams.get('status'));
  const slug = slugFromParams || searchParams.get('slug') || context?.slug || '';
  const contestId = searchParams.get('contestId') || context?.contestId || '';
  const optionId = searchParams.get('optionId') || context?.optionId || '';
  const contestTitle = searchParams.get('contestTitle') || context?.contestTitle || '';
  const optionName = searchParams.get('optionName') || context?.optionName || '';
  const eventName = searchParams.get('eventName') || context?.eventName || slug || 'EventPeepo';

  const resultsHref = useMemo(() => {
    if (!slug) return '/';
    return `/e/${slug}/leaderboard${contestId ? `?contestId=${encodeURIComponent(contestId)}` : ''}`;
  }, [contestId, slug]);

  const voteAgainHref = useMemo(() => {
    if (!slug) return '/';
    const params = new URLSearchParams();
    if (contestId) params.set('contestId', contestId);
    if (optionId) params.set('optionId', optionId);
    const query = params.toString();
    return `/e/${slug}/vote${query ? `?${query}` : ''}`;
  }, [contestId, optionId, slug]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(VOTE_CHECKOUT_CONTEXT_KEY);
      if (raw) {
        setContext(JSON.parse(raw) as VoteCheckoutContext);
      }
      setHasOpener(Boolean(window.opener && !window.opener.closed));
    } catch {
      // Ignore malformed local storage
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    const payload = {
      type: VOTE_PAYMENT_DONE_EVENT,
      status,
      slug,
      contestId: contestId || undefined,
      optionId: optionId || undefined,
    };

    try {
      window.localStorage.setItem(
        `${VOTE_PAYMENT_STATUS_KEY_PREFIX}${slug}`,
        JSON.stringify({ ...payload, at: Date.now() })
      );
    } catch {
      // Ignore localStorage failures
    }

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(payload, window.location.origin);
      } catch {
        // Ignore cross-window messaging issues
      }

      const timeout = window.setTimeout(() => {
        window.close();
      }, 1400);

      return () => window.clearTimeout(timeout);
    }
  }, [contestId, optionId, slug, status]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(27,212,188,0.08),transparent_28%),linear-gradient(180deg,#f9fbfa_0%,#f4f7f6_100%)] px-4 py-8">
      <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
        <section className="detail-card w-full text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">
            {status === 'success' ? 'Payment complete' : 'Payment cancelled'}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand-900">
            {status === 'success' ? 'Your vote is confirmed' : 'Payment was not completed'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-surface-500">
            {status === 'success'
              ? 'The voting page is updating your results now.'
              : 'You can return to the vote page and try again when you are ready.'}
          </p>

          {(optionName || contestTitle) ? (
            <div className="mt-5 rounded-3xl border border-surface-200 bg-surface-50 px-4 py-4 text-left">
              {optionName ? (
                <p className="text-sm text-surface-500">
                  Nominee: <span className="font-semibold text-brand-900">{optionName}</span>
                </p>
              ) : null}
              {contestTitle ? (
                <p className="mt-2 text-sm text-surface-500">
                  Category: <span className="font-semibold text-brand-900">{contestTitle}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={resultsHref} className="btn-outline justify-center">
              View Results
            </Link>
            <Link href={voteAgainHref} className="btn-primary justify-center">
              Vote Again
            </Link>
          </div>

          {hasOpener ? (
            <p className="mt-4 text-xs text-surface-500">
              This window will close automatically. If it stays open, you can close it manually.
            </p>
          ) : (
            <p className="mt-4 text-xs text-surface-500">
              Return to {eventName} whenever you are ready.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
