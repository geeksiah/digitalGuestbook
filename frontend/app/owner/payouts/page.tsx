'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ownerDashboardApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { formatCount, formatDate, formatAggregateCurrency, formatCurrencyAmount, humanizeEnum, getErrorMessage } from '@/lib/utils';
import {
  DetailRow,
  EmptyState,
  PageHeader,
  PageSkeleton,
  Panel,
  SegmentedControl,
  StatRow,
  StatusBadge,
  SubmitButton,
  Td,
  Th,
  Toolbar,
} from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Overlay';

interface Payout {
  id: string;
  eventId: string;
  requestedAmount: number;
  currency: string;
  payoutMethod: string;
  status: 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'DELAYED' | 'REJECTED';
  createdAt: string;
  processedAt: string | null;
  transactionRef: string | null;
  notes: string | null;
  event: {
    id: string;
    name: string;
    slug: string;
  };
}

interface EventTotal {
  eventId: string;
  eventName: string;
  eventSlug: string;
  totalNet: number;
  fulfilledAmount: number;
  pendingAmount: number;
  availableBalance: number;
  payoutCount: number;
  currency?: string;
}

interface WalletSummary {
  preferredMethod: string;
  currency: string;
  walletMode?: 'MANUAL_FALLBACK' | 'MANUAL_EXPLICIT' | 'AUTOMATED';
  manualSettlement?: {
    transactionCount: number;
    amountReceived: number;
    amountOwed: number;
    amountSettled: number;
    outstandingBalance: number;
  } | null;
}

interface OverallTotals {
  totalNet: number;
  fulfilledAmount: number;
  pendingAmount: number;
  availableBalance: number;
  totalPayoutCount: number;
}


/** Smallest amount worth requesting. Below this a transfer is not viable. */
const MIN_PAYOUT_AMOUNT = 1;

const statusLabels = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  FULFILLED: 'Paid',
  DELAYED: 'Delayed',
  REJECTED: 'Rejected',
};

export default function OwnerPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [eventTotals, setEventTotals] = useState<EventTotal[]>([]);
  const [overallTotals, setOverallTotals] = useState<OverallTotals | null>(null);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'DELAYED' | 'REJECTED'>('all');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [formData, setFormData] = useState({
    eventId: '',
    requestedAmount: '',
    notes: '',
  });

  useEffect(() => {
    fetchPayouts();
    fetchEvents();
    fetchWalletSummary();
  }, []);

  const fetchWalletSummary = async () => {
    try {
      const response = await ownerDashboardApi.getWallet();
      const wallet = response.data?.wallet;
      if (!wallet) return;
      setWalletSummary({
        preferredMethod: wallet.preferredMethod || 'bank',
        currency: wallet.currency || 'USD',
        walletMode: response.data?.walletMode || 'MANUAL_FALLBACK',
        manualSettlement: response.data?.manualSettlement || null,
      });
    } catch (error) {
      console.error('Failed to load wallet summary:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await ownerDashboardApi.getEvents();
      setEvents(response.data.events || []);
    } catch (error: any) {
      console.error('Failed to load events:', error);
    }
  };

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const response = await ownerDashboardApi.getPayouts();
      setPayouts(response.data.payouts || []);
      setEventTotals(response.data.eventTotals || []);
      setOverallTotals(response.data.overallTotals || null);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load payouts'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard here too: the field caps typed input, but a paste or an autofill
    // can still land above the balance.
    const amount = parseFloat(formData.requestedAmount);
    if (!Number.isFinite(amount) || amount < MIN_PAYOUT_AMOUNT) {
      setFormError(`Enter at least ${formatCurrencyAmount(MIN_PAYOUT_AMOUNT, selectedCurrency)}.`);
      return;
    }
    if (amount > maxAmount) {
      setFormError(`That is more than the ${formatCurrencyAmount(maxAmount, selectedCurrency)} available.`);
      return;
    }

    try {
      setRequesting(true);
      setFormError(null);
      await ownerDashboardApi.requestPayout({
        eventId: formData.eventId,
        requestedAmount: amount,
        notes: formData.notes || undefined,
      });
      toast.success('Payout requested');
      setShowRequestForm(false);
      setFormData({
        eventId: '',
        requestedAmount: '',
        notes: '',
      });
      fetchPayouts();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to request payout'));
    } finally {
      setRequesting(false);
    }
  };

  const filteredPayouts = filter === 'all' 
    ? payouts 
    : payouts.filter(p => p.status === filter);

  const selectedEventTotal = eventTotals.find(e => e.eventId === formData.eventId);
  const maxAmount = selectedEventTotal?.availableBalance || 0;
  const selectedCurrency = selectedEventTotal?.currency || walletSummary?.currency || 'USD';
  // Nothing to request when the balance cannot cover the minimum.
  const canRequestPayout = eventTotals.some((entry) => entry.availableBalance >= MIN_PAYOUT_AMOUNT);
  const payableEvents = events.filter((event) =>
    eventTotals.some((entry) => entry.eventId === event.id && entry.availableBalance >= MIN_PAYOUT_AMOUNT)
  );

  const requestedAmountValue = parseFloat(formData.requestedAmount);
  const amountExceedsBalance = Number.isFinite(requestedAmountValue) && requestedAmountValue > maxAmount;
  const amountIsValid =
    Number.isFinite(requestedAmountValue)
    && requestedAmountValue >= MIN_PAYOUT_AMOUNT
    && requestedAmountValue <= maxAmount;

  const payoutCurrencies = useMemo(
    () =>
      Array.from(
        new Set(
          eventTotals
            .map((entry) => String(entry.currency || walletSummary?.currency || '').toUpperCase())
            .filter(Boolean)
        )
      ),
    [eventTotals, walletSummary?.currency]
  );

  if (loading) {
    return <PageSkeleton stats={4} rows={4} />;
  }

  return (
    <div className="page">
      <PageHeader
        title="Payouts"
        actions={
          <button
            onClick={() => setShowRequestForm(true)}
            className="btn-primary"
            disabled={!canRequestPayout}
            title={
              canRequestPayout
                ? undefined
                : `No event has ${formatCurrencyAmount(MIN_PAYOUT_AMOUNT, selectedCurrency)} available yet`
            }
          >
            Request payout
          </button>
        }
        mobileActions={
          <button
            onClick={() => setShowRequestForm(true)}
            className="btn-primary btn-sm"
            disabled={!canRequestPayout}
          >
            Request
          </button>
        }
      />

      {overallTotals ? (
        <StatRow
          items={[
            {
              label: 'Available',
              value: formatAggregateCurrency(overallTotals.availableBalance, payoutCurrencies),
              tone: 'positive',
            },
            { label: 'Pending', value: formatAggregateCurrency(overallTotals.pendingAmount, payoutCurrencies) },
            { label: 'Paid out', value: formatAggregateCurrency(overallTotals.fulfilledAmount, payoutCurrencies) },
            { label: 'Requests', value: formatCount(overallTotals.totalPayoutCount) },
          ]}
        />
      ) : null}

      {!canRequestPayout && eventTotals.length > 0 ? (
        <div className="banner-info" role="status">
          No balance to pay out yet. An event needs at least{' '}
          {formatCurrencyAmount(MIN_PAYOUT_AMOUNT, selectedCurrency)} available before you can request a payout.
        </div>
      ) : null}

      {eventTotals.length > 0 ? (
        <Panel title="By event" flush>
          <div className="divide-y divide-surface-200 md:hidden">
            {eventTotals.map((evt) => (
              <div key={evt.eventId} className="px-4 py-3">
                <p className="truncate text-[15px] font-semibold text-brand-900">{evt.eventName}</p>
                <dl className="mt-1 grid grid-cols-2 gap-x-4">
                  <DetailRow label="Available">
                    {formatCurrencyAmount(evt.availableBalance, evt.currency || 'USD')}
                  </DetailRow>
                  <DetailRow label="Pending">
                    {formatCurrencyAmount(evt.pendingAmount, evt.currency || 'USD')}
                  </DetailRow>
                  <DetailRow label="Paid out">
                    {formatCurrencyAmount(evt.fulfilledAmount, evt.currency || 'USD')}
                  </DetailRow>
                  <DetailRow label="Net">{formatCurrencyAmount(evt.totalNet, evt.currency || 'USD')}</DetailRow>
                </dl>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="data-table" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <Th>Event</Th>
                  <Th align="right">Net</Th>
                  <Th align="right">Paid out</Th>
                  <Th align="right">Pending</Th>
                  <Th align="right">Available</Th>
                </tr>
              </thead>
              <tbody>
                {eventTotals.map((evt) => (
                  <tr key={evt.eventId} className="table-row">
                    <Td className="font-medium text-brand-900">{evt.eventName}</Td>
                    <Td align="right" className="num">
                      {formatCurrencyAmount(evt.totalNet, evt.currency || 'USD')}
                    </Td>
                    <Td align="right" className="num text-emerald-700">
                      {formatCurrencyAmount(evt.fulfilledAmount, evt.currency || 'USD')}
                    </Td>
                    <Td align="right" className="num">
                      {formatCurrencyAmount(evt.pendingAmount, evt.currency || 'USD')}
                    </Td>
                    <Td align="right" className="num font-semibold text-brand-900">
                      {formatCurrencyAmount(evt.availableBalance, evt.currency || 'USD')}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Toolbar>
        <SegmentedControl
          label="Payout status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all' as const, label: 'All' },
            { value: 'PENDING' as const, label: 'Pending' },
            { value: 'PROCESSING' as const, label: 'Processing' },
            { value: 'FULFILLED' as const, label: 'Paid' },
            { value: 'DELAYED' as const, label: 'Delayed' },
            { value: 'REJECTED' as const, label: 'Rejected' },
          ]}
        />
      </Toolbar>

      {filteredPayouts.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No payouts yet' : `No ${statusLabels[filter].toLowerCase()} payouts`}
          action={
            filter === 'all' ? (
              <button className="btn-primary btn-sm" onClick={() => setShowRequestForm(true)}>
                Request payout
              </button>
            ) : (
              <button className="btn-outline btn-sm" onClick={() => setFilter('all')}>
                Show all
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white md:hidden">
            {filteredPayouts.map((payout) => (
              <div key={payout.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-brand-900">{payout.event.name}</p>
                    <p className="mt-0.5 meta">
                      {formatDate(payout.createdAt, 'MMM d, yyyy')} &middot; {humanizeEnum(payout.payoutMethod)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-[15px] font-semibold text-brand-900">
                      {formatCurrencyAmount(payout.requestedAmount, payout.currency)}
                    </p>
                    <StatusBadge tone={payoutTone(payout.status)} className="mt-1">
                      {statusLabels[payout.status]}
                    </StatusBadge>
                  </div>
                </div>
                {payout.transactionRef || payout.notes ? (
                  <div className="mt-1 meta">
                    {payout.transactionRef ? (
                      <p className="truncate font-mono">Ref {payout.transactionRef}</p>
                    ) : null}
                    {payout.notes ? <p>{payout.notes}</p> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="data-table" style={{ minWidth: 800 }}>
                <thead>
                  <tr>
                    <Th>Event</Th>
                    <Th align="right">Amount</Th>
                    <Th>Method</Th>
                    <Th>Status</Th>
                    <Th>Requested</Th>
                    <Th>Details</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayouts.map((payout) => (
                    <tr key={payout.id} className="table-row">
                      <Td className="font-medium text-brand-900">{payout.event.name}</Td>
                      <Td align="right" className="num font-semibold text-brand-900">
                        {formatCurrencyAmount(payout.requestedAmount, payout.currency)}
                      </Td>
                      <Td>{humanizeEnum(payout.payoutMethod)}</Td>
                      <Td>
                        <StatusBadge tone={payoutTone(payout.status)} dot>
                          {statusLabels[payout.status]}
                        </StatusBadge>
                      </Td>
                      <Td>{formatDate(payout.createdAt, 'MMM d, yyyy')}</Td>
                      <Td>
                        {payout.transactionRef ? (
                          <p className="font-mono text-[12px]">{payout.transactionRef}</p>
                        ) : null}
                        {payout.notes ? <p className="meta">{payout.notes}</p> : null}
                        {!payout.transactionRef && !payout.notes ? <span className="text-surface-500">&mdash;</span> : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        open={showRequestForm}
        onClose={() => setShowRequestForm(false)}
        title="Request a payout"
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setShowRequestForm(false)} className="btn-outline" disabled={requesting}>
              Cancel
            </button>
            <SubmitButton
              loading={requesting}
              disabled={!formData.eventId || !amountIsValid}
              onClick={() => handleRequestPayout({ preventDefault: () => {} } as React.FormEvent)}
            >
              Submit request
            </SubmitButton>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? (
            <div className="banner-error" role="alert">
              {formError}
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="payout-event">
              Event
            </label>
            <select
              id="payout-event"
              data-autofocus
              value={formData.eventId}
              onChange={(e) => {
                // Switching events changes the ceiling, so drop a now-invalid amount.
                const nextId = e.target.value;
                const nextMax = eventTotals.find((entry) => entry.eventId === nextId)?.availableBalance || 0;
                const current = parseFloat(formData.requestedAmount);
                setFormError(null);
                setFormData({
                  ...formData,
                  eventId: nextId,
                  requestedAmount:
                    Number.isFinite(current) && current > nextMax ? '' : formData.requestedAmount,
                });
              }}
              className="input"
              required
            >
              <option value="">Select an event</option>
              {payableEvents.map((event) => {
                const eventTotal = eventTotals.find((entry) => entry.eventId === event.id);
                return (
                  <option key={event.id} value={event.id}>
                    {event.name}
                    {eventTotal
                      ? ` — ${formatCurrencyAmount(eventTotal.availableBalance, eventTotal.currency || 'USD')} available`
                      : ''}
                  </option>
                );
              })}
            </select>
            <p className="field-hint">
              Only events with at least {formatCurrencyAmount(MIN_PAYOUT_AMOUNT, selectedCurrency)} available are listed.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="payout-amount">
              Amount
            </label>
            <div className="flex items-center gap-2">
              <input
                id="payout-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={MIN_PAYOUT_AMOUNT}
                max={maxAmount}
                value={formData.requestedAmount}
                onChange={(e) => {
                  // Cap at the available balance as the value is typed.
                  const raw = e.target.value;
                  setFormError(null);
                  if (raw === '') {
                    setFormData({ ...formData, requestedAmount: '' });
                    return;
                  }
                  const parsed = parseFloat(raw);
                  if (!Number.isFinite(parsed)) return;
                  const capped = Math.min(parsed, maxAmount);
                  setFormData({
                    ...formData,
                    requestedAmount: capped === parsed ? raw : String(capped),
                  });
                }}
                className={amountExceedsBalance ? 'input input-error' : 'input'}
                placeholder="0.00"
                disabled={!formData.eventId}
                aria-describedby="payout-amount-hint"
                required
              />
              <button
                type="button"
                className="btn-outline btn-sm shrink-0"
                disabled={!formData.eventId || maxAmount < MIN_PAYOUT_AMOUNT}
                onClick={() => {
                  setFormError(null);
                  setFormData({ ...formData, requestedAmount: String(maxAmount) });
                }}
              >
                Max
              </button>
            </div>
            <p
              id="payout-amount-hint"
              className={amountExceedsBalance ? 'field-error' : 'field-hint num'}
              role={amountExceedsBalance ? 'alert' : undefined}
            >
              {!formData.eventId
                ? 'Choose an event first.'
                : amountExceedsBalance
                ? `Only ${formatCurrencyAmount(maxAmount, selectedCurrency)} is available.`
                : `Up to ${formatCurrencyAmount(maxAmount, selectedCurrency)} available.`}
            </p>
          </div>

          <div>
            <p className="label">Paid to</p>
            <div className="surface-muted px-3 py-2.5 text-sm text-surface-800">
              {walletSummary
                ? `${humanizeEnum(walletSummary.preferredMethod)} · ${walletSummary.currency}`
                : 'Set this up in your account'}
            </div>
            {walletSummary?.walletMode && walletSummary.walletMode !== 'AUTOMATED' ? (
              <p className="field-hint text-amber-800">This account settles manually.</p>
            ) : (
              <p className="field-hint">
                Change this in <Link href="/owner/account" className="font-medium underline">your account</Link>.
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="payout-notes">
              Notes <span className="font-normal text-surface-600">(optional)</span>
            </label>
            <input
              id="payout-notes"
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Payout states mapped onto the shared status tones. */
function payoutTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'FULFILLED':
      return 'success';
    case 'PROCESSING':
      return 'info';
    case 'PENDING':
    case 'DELAYED':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
}
