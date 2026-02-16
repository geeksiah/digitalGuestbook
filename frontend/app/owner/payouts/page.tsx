'use client';

import { useState, useEffect } from 'react';
import { ownerDashboardApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDate, cn } from '@/lib/utils';
import { DashboardPageHeader, DashboardSection } from '@/components/dashboard/ui';

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
}

interface OverallTotals {
  totalNet: number;
  fulfilledAmount: number;
  pendingAmount: number;
  availableBalance: number;
  totalPayoutCount: number;
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PROCESSING: 'bg-blue-100 text-blue-800 border-blue-200',
  FULFILLED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  DELAYED: 'bg-orange-100 text-orange-800 border-orange-200',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
};

const statusLabels = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  FULFILLED: 'Fulfilled',
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
      toast.error(error.response?.data?.error || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRequesting(true);
      await ownerDashboardApi.requestPayout({
        eventId: formData.eventId,
        requestedAmount: parseFloat(formData.requestedAmount),
        notes: formData.notes || undefined,
      });
      toast.success('Payout request submitted successfully');
      setShowRequestForm(false);
      setFormData({
        eventId: '',
        requestedAmount: '',
        notes: '',
      });
      fetchPayouts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  const filteredPayouts = filter === 'all' 
    ? payouts 
    : payouts.filter(p => p.status === filter);

  const selectedEventTotal = eventTotals.find(e => e.eventId === formData.eventId);
  const maxAmount = selectedEventTotal?.availableBalance || 0;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardPageHeader
        title="Payouts"
        subtitle="View and track your payout requests"
        action={(
          <button
            onClick={() => setShowRequestForm(!showRequestForm)}
            className="btn-primary text-sm"
          >
            {showRequestForm ? 'Cancel' : '+ Request Payout'}
          </button>
        )}
      />

      {/* Request Payout Form */}
      {showRequestForm && (
        <DashboardSection title="Request Payout">
          <form onSubmit={handleRequestPayout} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Event *</label>
                <select
                  value={formData.eventId}
                  onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select an event</option>
                  {events.map((event) => {
                    const eventTotal = eventTotals.find((e) => e.eventId === event.id);
                    return (
                      <option key={event.id} value={event.id}>
                        {event.name} {eventTotal && `(${eventTotal.availableBalance.toFixed(2)} ${eventTotal.currency || 'USD'})`}
                      </option>
                    );
                  })}
                </select>
                {selectedEventTotal && (
                  <p className="text-xs text-surface-500 mt-1">
                    Available: {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedEventTotal.currency || 'USD' }).format(selectedEventTotal.availableBalance)}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={maxAmount}
                  value={formData.requestedAmount}
                  onChange={(e) => setFormData({ ...formData, requestedAmount: e.target.value })}
                  className="input"
                  placeholder="0.00"
                  required
                />
                {selectedEventTotal && (
                  <p className="text-xs text-surface-500 mt-1">
                    Max: {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedEventTotal.currency || walletSummary?.currency || 'USD' }).format(maxAmount)}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Payout Destination</label>
                <div className="input bg-surface-50 text-surface-600">
                  {walletSummary
                    ? `${walletSummary.preferredMethod.toUpperCase()} (${walletSummary.currency})`
                    : 'Configured in Wallet settings'}
                </div>
                <p className="text-xs text-surface-500 mt-1">Locked to your wallet settings.</p>
              </div>

              <div>
                <label className="label">Notes (Optional)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRequestForm(false)}
                className="btn-outline w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={requesting || !formData.eventId || !formData.requestedAmount}
                className="btn-primary w-full sm:w-auto"
              >
                {requesting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </DashboardSection>
      )}

      {/* Overall Totals */}
      {overallTotals && (
        <div className="bg-gradient-to-br from-brand-900 to-brand-800 rounded-xl p-4 sm:p-5 text-white">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-white/60 mb-3">Overall Summary</p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-[10px] sm:text-xs text-white/70">Available</p>
              <p className="text-lg sm:text-xl font-bold mt-0.5 break-all">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(overallTotals.availableBalance)}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-white/70">Fulfilled</p>
              <p className="text-lg sm:text-xl font-bold mt-0.5 break-all">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(overallTotals.fulfilledAmount)}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-white/70">Pending</p>
              <p className="text-lg sm:text-xl font-bold mt-0.5 break-all">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(overallTotals.pendingAmount)}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-white/70">Total Payouts</p>
              <p className="text-lg sm:text-xl font-bold mt-0.5">{overallTotals.totalPayoutCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Event Totals - mobile cards + desktop table */}
      {eventTotals.length > 0 && (
        <DashboardSection title="Event Breakdown" contentClassName="p-0">
          {/* Mobile card view */}
          <div className="divide-y divide-surface-100 md:hidden">
            {eventTotals.map((evt) => (
              <div key={evt.eventId} className="px-4 py-3.5 space-y-2">
                <p className="text-sm font-semibold text-brand-900">{evt.eventName}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-surface-500">Net</p>
                    <p className="font-semibold text-brand-900">{new Intl.NumberFormat('en-US', { style: 'currency', currency: evt.currency || 'USD' }).format(evt.totalNet)}</p>
                  </div>
                  <div>
                    <p className="text-surface-500">Available</p>
                    <p className="font-semibold text-brand-900">{new Intl.NumberFormat('en-US', { style: 'currency', currency: evt.currency || 'USD' }).format(evt.availableBalance)}</p>
                  </div>
                  <div>
                    <p className="text-surface-500">Fulfilled</p>
                    <p className="font-semibold text-emerald-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: evt.currency || 'USD' }).format(evt.fulfilledAmount)}</p>
                  </div>
                  <div>
                    <p className="text-surface-500">Pending</p>
                    <p className="font-semibold text-yellow-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: evt.currency || 'USD' }).format(evt.pendingAmount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table view */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Event</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase">Net</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase">Fulfilled</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase">Pending</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {eventTotals.map((evt) => (
                  <tr key={evt.eventId}>
                    <td className="py-3 px-4 font-medium text-brand-900 text-sm">{evt.eventName}</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: evt.currency || 'USD' }).format(evt.totalNet)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-emerald-600">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: evt.currency || 'USD' }).format(evt.fulfilledAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-yellow-600">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: evt.currency || 'USD' }).format(evt.pendingAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-brand-900">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: evt.currency || 'USD' }).format(evt.availableBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-1 bg-surface-100 p-1 rounded-xl">
        {(['all', 'PENDING', 'PROCESSING', 'FULFILLED', 'DELAYED', 'REJECTED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors',
              filter === status
                ? 'bg-white text-brand-900 shadow-sm'
                : 'text-surface-600 hover:text-brand-900'
            )}
          >
            {status === 'all' ? 'All' : statusLabels[status]}
          </button>
        ))}
      </div>

      {/* Payouts List */}
      <DashboardSection contentClassName="p-0">
        {filteredPayouts.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-surface-100 mb-3">
              <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-surface-600">No payouts found</p>
            <p className="text-xs text-surface-400 mt-1">
              {filter === 'all'
                ? 'Request your first payout to get started'
                : `No ${statusLabels[filter].toLowerCase()} payouts`}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="divide-y divide-surface-100 md:hidden">
              {filteredPayouts.map((payout) => (
                <div key={payout.id} className="px-4 py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-900 truncate">{payout.event.name}</p>
                      <p className="text-xs text-surface-500">{formatDate(payout.createdAt)}</p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border leading-none flex-shrink-0',
                        statusColors[payout.status]
                      )}
                    >
                      {statusLabels[payout.status]}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-base font-bold text-brand-900">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: payout.currency }).format(payout.requestedAmount)}
                    </p>
                    <span className="text-xs text-surface-500 capitalize">{payout.payoutMethod.replace('_', ' ')}</span>
                  </div>
                  {(payout.transactionRef || payout.notes) && (
                    <div className="text-xs text-surface-500">
                      {payout.transactionRef && <p className="font-mono truncate">Ref: {payout.transactionRef}</p>}
                      {payout.notes && <p className="mt-0.5">{payout.notes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop table view */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Event</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Method</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filteredPayouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-surface-50 transition-colors">
                      <td className="py-3 px-4 text-sm font-medium text-brand-900">{payout.event.name}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-brand-900">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: payout.currency }).format(payout.requestedAmount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-surface-600 capitalize">{payout.payoutMethod.replace('_', ' ')}</td>
                      <td className="py-3 px-4">
                        <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded border', statusColors[payout.status])}>
                          {statusLabels[payout.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-surface-600">{formatDate(payout.createdAt)}</td>
                      <td className="py-3 px-4 text-sm text-surface-500">
                        {payout.transactionRef && <p className="text-xs font-mono">Ref: {payout.transactionRef}</p>}
                        {payout.notes && <p className="text-xs mt-0.5">{payout.notes}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DashboardSection>
    </div>
  );
}

