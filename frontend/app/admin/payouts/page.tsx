'use client';

import { useState, useEffect } from 'react';
import { adminApi, eventsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { formatCount, formatDate, formatAggregateCurrency, formatCurrencyAmount, getErrorMessage } from '@/lib/utils';
import {
  EmptyState,
  ListSkeleton,
  PageHeader,
  StatRow,
  StatRowSkeleton,
  StatusBadge,
  SubmitButton,
  Td,
  Th,
} from '@/components/ui/Primitives';
import { Menu, MenuItem, Modal } from '@/components/ui/Overlay';
import Link from 'next/link';

interface Payout {
  id: string;
  eventId: string;
  requestedAmount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'DELAYED' | 'REJECTED';
  createdAt: string;
  processedAt: string | null;
  processedBy: string | null;
  transactionRef: string | null;
  notes: string | null;
  payoutMethod: string;
  event: {
    id: string;
    name: string;
    slug: string;
    ownerName: string | null;
    ownerEmail: string | null;
  };
}

interface Analytics {
  totalPending: number;
  totalPendingAmount: number;
  totalProcessing: number;
  totalProcessingAmount: number;
  totalFulfilled: number;
  totalFulfilledAmount: number;
  totalDelayed: number;
  totalDelayedAmount: number;
  totalRejected: number;
  totalRejectedAmount: number;
  byStatus: {
    PENDING: number;
    PROCESSING: number;
    FULFILLED: number;
    DELAYED: number;
    REJECTED: number;
  };
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    eventId: '',
    startDate: '',
    endDate: '',
    page: 1,
  });
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processForm, setProcessForm] = useState({
    status: 'PROCESSING' as 'PROCESSING' | 'FULFILLED' | 'DELAYED',
    transactionRef: '',
    notes: '',
  });
  const [rejectReason, setRejectReason] = useState('');
  const payoutCurrencies = Array.from(
    new Set(payouts.map((payout) => String(payout.currency || '').toUpperCase()).filter(Boolean))
  );

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchPayouts();
  }, [filters]);

  const fetchEvents = async () => {
    try {
      const response = await eventsApi.list();
      setEvents(response.data.events || []);
    } catch (error) {
      toast.error('Failed to load events');
    }
  };

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: filters.page,
        limit: 50,
      };
      if (filters.status) params.status = filters.status;
      if (filters.eventId) params.eventId = filters.eventId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await adminApi.getPayouts(params);
      setPayouts(response.data.payouts || []);
      setAnalytics(response.data.analytics || null);
    } catch (error) {
      toast.error('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!selectedPayout) return;

    try {
      setProcessing(true);
      await adminApi.processPayout(selectedPayout.id, {
        status: processForm.status,
        transactionRef: processForm.transactionRef || undefined,
        notes: processForm.notes || undefined,
      });
      toast.success(`Payout ${processForm.status === 'FULFILLED' ? 'fulfilled' : processForm.status.toLowerCase()} successfully`);
      setShowProcessModal(false);
      setSelectedPayout(null);
      setProcessForm({ status: 'PROCESSING', transactionRef: '', notes: '' });
      fetchPayouts();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to process payout'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayout || !rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setProcessing(true);
      await adminApi.rejectPayout(selectedPayout.id, rejectReason);
      toast.success('Payout rejected');
      setShowRejectModal(false);
      setSelectedPayout(null);
      setRejectReason('');
      fetchPayouts();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to reject payout'));
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => formatCurrencyAmount(amount, currency);

  /** Payout states mapped onto the shared status tones. */
  const payoutTone = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    switch (status) {
      case 'FULFILLED': return 'success';
      case 'PROCESSING': return 'info';
      case 'PENDING': return 'warning';
      case 'DELAYED': return 'warning';
      case 'REJECTED': return 'danger';
      default: return 'neutral';
    }
  };

  const isActionable = (status: string) => status === 'PENDING' || status === 'PROCESSING' || status === 'DELAYED';

  const openProcess = (payout: Payout) => {
    setSelectedPayout(payout);
    setProcessForm({
      status: payout.status === 'PENDING' ? 'PROCESSING' : (payout.status as 'PROCESSING' | 'FULFILLED' | 'DELAYED'),
      transactionRef: payout.transactionRef || '',
      notes: payout.notes || '',
    });
    setShowProcessModal(true);
  };

  const openReject = (payout: Payout) => {
    setSelectedPayout(payout);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'PROCESSING':
        return 'Processing';
      case 'FULFILLED':
        return 'Fulfilled';
      case 'DELAYED':
        return 'Delayed';
      case 'REJECTED':
        return 'Rejected';
      default:
        return status;
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Event', 'Owner', 'Amount', 'Currency', 'Status', 'Transaction Ref', 'Processed At', 'Notes'];
    const rows = payouts.map(payout => [
      formatDate(payout.createdAt, 'yyyy-MM-dd HH:mm'),
      payout.event.name,
      payout.event.ownerName || payout.event.ownerEmail || '',
      payout.requestedAmount.toString(),
      payout.currency,
      payout.status,
      payout.transactionRef || '',
      payout.processedAt ? formatDate(payout.processedAt, 'yyyy-MM-dd HH:mm') : '',
      payout.notes || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payouts-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = [filters.eventId, filters.status, filters.startDate, filters.endDate].filter(Boolean).length;

  const closeProcess = () => {
    setShowProcessModal(false);
    setSelectedPayout(null);
    setProcessForm({ status: 'PROCESSING', transactionRef: '', notes: '' });
  };

  const closeReject = () => {
    setShowRejectModal(false);
    setSelectedPayout(null);
    setRejectReason('');
  };

  return (
    <div className="page">
      <PageHeader
        title="Payouts"
        actions={
          <button onClick={exportToCSV} className="btn-outline" disabled={payouts.length === 0}>
            Export CSV
          </button>
        }
        mobileActions={
          <Menu label="Payout actions" sheetTitle="Payouts">
            <MenuItem disabled={payouts.length === 0} onClick={exportToCSV}>
              Export CSV
            </MenuItem>
          </Menu>
        }
      />

      {loading && !analytics ? (
        <StatRowSkeleton />
      ) : analytics ? (
        <>
          <StatRow
            items={[
              {
                label: 'Pending',
                value: formatCount(analytics.totalPending),
                hint: formatAggregateCurrency(analytics.totalPendingAmount, payoutCurrencies),
              },
              {
                label: 'Processing',
                value: formatCount(analytics.totalProcessing || 0),
                hint: formatAggregateCurrency(analytics.totalProcessingAmount || 0, payoutCurrencies),
              },
              {
                label: 'Fulfilled',
                value: formatCount(analytics.totalFulfilled || 0),
                tone: 'positive',
                hint: formatAggregateCurrency(analytics.totalFulfilledAmount || 0, payoutCurrencies),
              },
              {
                label: 'Needs attention',
                value: formatCount((analytics.totalDelayed || 0) + analytics.totalRejected),
                hint: formatAggregateCurrency(
                  (analytics.totalDelayedAmount || 0) + analytics.totalRejectedAmount,
                  payoutCurrencies
                ),
              },
            ]}
          />
          <p className="meta num">
            {formatCount(analytics.totalDelayed || 0)} delayed · {formatCount(analytics.totalRejected)} rejected
          </p>
        </>
      ) : null}

      <details className="panel" open={activeFilterCount > 0}>
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span className="panel-title">Filters</span>
          {activeFilterCount > 0 ? (
            <StatusBadge tone="brand">{activeFilterCount} active</StatusBadge>
          ) : (
            <span className="meta">All payouts</span>
          )}
        </summary>
        <div className="border-t border-surface-200 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="payout-event">
                Event
              </label>
              <select
                id="payout-event"
                className="input"
                value={filters.eventId}
                onChange={(e) => setFilters({ ...filters, eventId: e.target.value, page: 1 })}
              >
                <option value="">All events</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="payout-status">
                Status
              </label>
              <select
                id="payout-status"
                className="input"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              >
                <option value="">Any status</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="DELAYED">Delayed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="payout-start">
                From
              </label>
              <input
                id="payout-start"
                type="date"
                className="input"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
              />
            </div>
            <div>
              <label className="label" htmlFor="payout-end">
                To
              </label>
              <input
                id="payout-end"
                type="date"
                className="input"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
              />
            </div>
          </div>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              className="btn-outline btn-sm mt-4"
              onClick={() => setFilters({ status: '', eventId: '', startDate: '', endDate: '', page: 1 })}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </details>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : payouts.length === 0 ? (
        <EmptyState
          title="No payout requests"
          hint={activeFilterCount > 0 ? 'Try widening the filters.' : undefined}
        />
      ) : (
        <>
          <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white lg:hidden">
            {payouts.map((payout) => (
              <div key={payout.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/events/${payout.event.id}`}
                      className="block truncate text-[15px] font-semibold text-brand-900"
                    >
                      {payout.event.name}
                    </Link>
                    <p className="mt-0.5 meta truncate">
                      {payout.event.ownerName || payout.event.ownerEmail || 'Unknown owner'}
                    </p>
                    <p className="mt-0.5 meta">{formatDate(payout.createdAt, 'MMM d, yyyy')}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-[15px] font-semibold text-brand-900">
                      {formatCurrency(payout.requestedAmount, payout.currency)}
                    </p>
                    <StatusBadge tone={payoutTone(payout.status)} className="mt-1">
                      {getStatusLabel(payout.status)}
                    </StatusBadge>
                  </div>
                </div>
                {isActionable(payout.status) ? (
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn-outline btn-sm flex-1" onClick={() => openReject(payout)}>
                      Reject
                    </button>
                    <button type="button" className="btn-primary btn-sm flex-1" onClick={() => openProcess(payout)}>
                      Process
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="data-table" style={{ minWidth: 940 }}>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Event</Th>
                    <Th>Owner</Th>
                    <Th align="right">Amount</Th>
                    <Th>Status</Th>
                    <Th>Reference</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="table-row">
                      <Td className="whitespace-nowrap">{formatDate(payout.createdAt, 'MMM d, yyyy p')}</Td>
                      <Td>
                        <Link
                          href={`/admin/events/${payout.event.id}`}
                          className="font-medium text-brand-900 hover:underline"
                        >
                          {payout.event.name}
                        </Link>
                      </Td>
                      <Td>
                        <p className="truncate">{payout.event.ownerName || '—'}</p>
                        {payout.event.ownerEmail ? <p className="meta truncate">{payout.event.ownerEmail}</p> : null}
                      </Td>
                      <Td align="right" className="num font-medium text-brand-900">
                        {formatCurrency(payout.requestedAmount, payout.currency)}
                      </Td>
                      <Td>
                        <StatusBadge tone={payoutTone(payout.status)} dot>
                          {getStatusLabel(payout.status)}
                        </StatusBadge>
                      </Td>
                      <Td>
                        {payout.transactionRef ? (
                          <span className="font-mono text-[12px]">{payout.transactionRef}</span>
                        ) : (
                          <span className="text-surface-500">—</span>
                        )}
                      </Td>
                      <Td align="right">
                        {isActionable(payout.status) ? (
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" className="btn-outline btn-sm" onClick={() => openReject(payout)}>
                              Reject
                            </button>
                            <button type="button" className="btn-primary btn-sm" onClick={() => openProcess(payout)}>
                              Process
                            </button>
                          </div>
                        ) : (
                          <span className="text-surface-500">—</span>
                        )}
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
        open={showProcessModal && Boolean(selectedPayout)}
        onClose={closeProcess}
        title="Process payout"
        description={
          selectedPayout
            ? `${selectedPayout.event.name} · ${formatCurrency(selectedPayout.requestedAmount, selectedPayout.currency)}`
            : undefined
        }
        size="md"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={closeProcess} disabled={processing}>
              Cancel
            </button>
            <SubmitButton loading={processing} onClick={handleProcess}>
              Save
            </SubmitButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="process-status">
              Status
            </label>
            <select
              id="process-status"
              data-autofocus
              className="input"
              value={processForm.status}
              onChange={(e) =>
                setProcessForm({ ...processForm, status: e.target.value as 'PROCESSING' | 'FULFILLED' | 'DELAYED' })
              }
            >
              <option value="PROCESSING">Processing</option>
              <option value="FULFILLED">Fulfilled</option>
              <option value="DELAYED">Delayed</option>
            </select>
            <p className="field-hint">
              {processForm.status === 'PROCESSING' && 'Payment is under way.'}
              {processForm.status === 'FULFILLED' && 'Money has reached the owner.'}
              {processForm.status === 'DELAYED' && 'Held up — explain why in the notes.'}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="process-ref">
              Transaction reference <span className="font-normal text-surface-600">(optional)</span>
            </label>
            <input
              id="process-ref"
              type="text"
              className="input"
              value={processForm.transactionRef}
              onChange={(e) => setProcessForm({ ...processForm, transactionRef: e.target.value })}
              placeholder="Bank or mobile money reference"
            />
          </div>

          <div>
            <label className="label" htmlFor="process-notes">
              Notes <span className="font-normal text-surface-600">(optional)</span>
            </label>
            <textarea
              id="process-notes"
              className="input"
              rows={3}
              value={processForm.notes}
              onChange={(e) => setProcessForm({ ...processForm, notes: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showRejectModal && Boolean(selectedPayout)}
        onClose={closeReject}
        title="Reject payout"
        description={
          selectedPayout
            ? `${selectedPayout.event.name} · ${formatCurrency(selectedPayout.requestedAmount, selectedPayout.currency)}`
            : undefined
        }
        size="sm"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={closeReject} disabled={processing}>
              Cancel
            </button>
            <SubmitButton
              loading={processing}
              className="btn-danger"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              Reject payout
            </SubmitButton>
          </>
        }
      >
        <label className="label" htmlFor="reject-reason">
          Reason
        </label>
        <textarea
          id="reject-reason"
          data-autofocus
          className="input"
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="The owner sees this."
        />
      </Modal>
    </div>
  );
}
