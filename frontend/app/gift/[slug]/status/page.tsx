'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { giftingApi } from '@/lib/api';
import { cn, formatCurrencyAmount, getErrorMessage } from '@/lib/utils';

type GiftStatus = 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'UNKNOWN';

type StatusOrder = {
  id: string;
  guestName: string;
  currency: string;
  totalAmount: number;
  cashGiftAmount: number | null;
  packageAmount: number;
  items: Array<{ type: string; name: string; quantity: number; lineTotal: number }>;
};

type StatusResponse = {
  status: GiftStatus;
  reference?: string;
  order: StatusOrder | null;
  event: { name: string; slug: string };
  eventUrl: string;
  giftUrl: string;
};

/**
 * A gateway redirect regularly beats its own webhook, so a PENDING answer is
 * usually "not yet" rather than "no". Poll a handful of times before settling.
 */
const PENDING_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

export default function GiftStatusPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  // Paystack sends both; either one identifies the transaction.
  const reference = searchParams.get('reference') || searchParams.get('trxref') || '';

  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const attemptsRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const response = await giftingApi.getPublicOrderStatus(slug, reference || undefined);
      const payload = response.data as StatusResponse;
      setData(payload);
      setError(null);

      if (payload.status === 'PENDING' && attemptsRef.current < PENDING_RETRIES) {
        attemptsRef.current += 1;
        setTimeout(load, RETRY_DELAY_MS);
        return;
      }
    } catch (err) {
      setError(getErrorMessage(err, 'We could not check this gift'));
    } finally {
      setLoading(false);
    }
  }, [slug, reference]);

  useEffect(() => {
    load();
  }, [load]);

  const status: GiftStatus = data?.status || 'PENDING';
  const stillChecking =
    loading || (status === 'PENDING' && attemptsRef.current < PENDING_RETRIES);

  const giftAgainHref = data?.giftUrl || `/gift/${slug}`;
  const backToEventHref = data?.eventUrl || '/';

  return (
    <div className="grid min-h-screen place-items-center bg-surface-100 px-4 py-8">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
        <div className="lg:grid lg:grid-cols-[1fr_360px]">
          {/* Outcome */}
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center lg:px-10 lg:py-14">
            <StatusMark status={stillChecking ? 'PENDING' : status} />

            <h1 className="mt-6 text-xl font-bold tracking-tight text-brand-950">
              {stillChecking
                ? 'Confirming your payment'
                : status === 'SUCCEEDED'
                ? 'Your gift is on its way!'
                : status === 'FAILED'
                ? 'That payment did not go through'
                : 'We could not find that gift'}
            </h1>

            <p className="mt-2 max-w-[38ch] text-sm leading-6 text-surface-600">
              {stillChecking
                ? 'This takes a moment while your bank confirms the payment. You can stay on this page.'
                : status === 'SUCCEEDED'
                ? `${data?.event?.name || 'The host'} has been notified. Thank you for celebrating with them.`
                : status === 'FAILED'
                ? 'No money has left your account. You can try again with the same or a different payment method.'
                : error ||
                  'If you were charged, the confirmation may still be arriving. Check back in a moment.'}
            </p>

            {!stillChecking && data?.reference ? (
              <p className="mt-4 font-mono text-[11px] text-surface-500">Ref {data.reference}</p>
            ) : null}

            {!stillChecking ? (
              <div className="mt-7 w-full max-w-xs space-y-2">
                <a href={giftAgainHref} className="btn-primary w-full justify-center">
                  {status === 'SUCCEEDED' ? 'Gift again' : 'Try again'}
                </a>
                <a href={backToEventHref} className="btn-outline w-full justify-center">
                  Back to event
                </a>
              </div>
            ) : null}
          </div>

          {/* Receipt. Only meaningful once an order exists. */}
          {data?.order ? (
            <aside className="border-t border-surface-200 bg-surface-50 px-6 py-8 lg:border-l lg:border-t-0 lg:px-7">
              <h2 className="text-[15px] font-semibold text-brand-900">Gift summary</h2>

              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="meta">Event</dt>
                  <dd className="mt-0.5 text-sm font-medium text-brand-900">
                    {data.event.name}
                  </dd>
                </div>
                <div>
                  <dt className="meta">From</dt>
                  <dd className="mt-0.5 text-sm font-medium text-brand-900">
                    {data.order.guestName}
                  </dd>
                </div>
              </dl>

              {data.order.items.length ? (
                <ul className="mt-5 divide-y divide-surface-200 border-y border-surface-200">
                  {data.order.items.map((item, index) => (
                    <li
                      key={`${item.name}-${index}`}
                      className="flex items-baseline justify-between gap-3 py-2.5"
                    >
                      <span className="min-w-0 text-[13px] text-surface-700">
                        {item.name}
                        {item.type === 'PACKAGE' && item.quantity > 1 ? (
                          <span className="text-surface-500"> x{item.quantity}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[13px] font-medium tabular-nums text-brand-900">
                        {formatCurrencyAmount(item.lineTotal, data.order!.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-5 text-right">
                <p className="meta">Total sent</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-brand-900">
                  {formatCurrencyAmount(data.order.totalAmount, data.order.currency)}
                </p>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusMark({ status }: { status: GiftStatus }) {
  const tone =
    status === 'SUCCEEDED'
      ? 'bg-brand-50 text-brand-600'
      : status === 'FAILED'
      ? 'bg-red-50 text-red-600'
      : 'bg-surface-100 text-surface-500';

  return (
    <div className={cn('grid h-20 w-20 place-items-center rounded-full', tone)}>
      <div
        className={cn(
          'grid h-14 w-14 place-items-center rounded-full',
          status === 'SUCCEEDED'
            ? 'bg-brand-600 text-white'
            : status === 'FAILED'
            ? 'bg-red-600 text-white'
            : 'bg-white text-surface-500'
        )}
      >
        {status === 'SUCCEEDED' ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        ) : status === 'FAILED' ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="animate-spin"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-6.2-8.6" />
          </svg>
        )}
      </div>
      <span className="sr-only">
        {status === 'SUCCEEDED' ? 'Payment successful' : status === 'FAILED' ? 'Payment failed' : 'Checking payment'}
      </span>
    </div>
  );
}
