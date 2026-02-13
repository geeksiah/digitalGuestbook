'use client';

import { useState, useEffect } from 'react';
import { ownerDashboardApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDate, cn } from '@/lib/utils';

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Payout Management</h1>
          <p className="text-surface-600 mt-1">View and track your payout requests</p>
          <p className="text-xs text-surface-500 mt-1">Available balance includes ticket sales and net cash gifts only. Gift package sales and Paystack auto-settled split gifts are excluded from manual payout.</p>
        </div>
        <button
          onClick={() => setShowRequestForm(!showRequestForm)}
          className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium"
        >
          {showRequestForm ? 'Cancel' : '+ Request Payout'}
        </button>
      </div>

      {/* Request Payout Form */}
      {showRequestForm && (
        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Request Payout</h2>
          <form onSubmit={handleRequestPayout} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Event <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.eventId}
                  onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                  required
                >
                  <option value="">Select an event</option>
                  {events.map((event) => {
                    const eventTotal = eventTotals.find((e) => e.eventId === event.id);
                    return (
                      <option key={event.id} value={event.id}>
                        {event.name} {eventTotal && `(${eventTotal.availableBalance.toFixed(2)} ${eventTotal.currency || 'USD'} available)`}
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
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={maxAmount}
                  value={formData.requestedAmount}
                  onChange={(e) => setFormData({ ...formData, requestedAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Payout Destination
                </label>
                <div className="w-full px-3 py-2 border border-surface-200 rounded-lg bg-surface-50 text-sm text-surface-700">
                  {walletSummary
                    ? `${walletSummary.preferredMethod.toUpperCase()} (${walletSummary.currency})`
                    : 'Configured in Wallet settings'}
                </div>
                <p className="text-xs text-surface-500 mt-1">
                  Payout method and currency are locked to your verified wallet settings.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={requesting || !formData.eventId || !formData.requestedAmount}
                className="px-6 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requesting ? 'Submitting...' : 'Submit Request'}
              </button>
              <button
                type="button"
                onClick={() => setShowRequestForm(false)}
                className="px-6 py-2 border border-surface-300 text-surface-700 rounded-lg hover:bg-surface-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Overall Totals */}
      {overallTotals && (
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-lg p-6 text-white">
          <h2 className="text-lg font-semibold mb-4">Overall Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm opacity-80">Total Available</p>
              <p className="text-2xl font-bold mt-1">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(overallTotals.availableBalance)}
              </p>
            </div>
            <div>
              <p className="text-sm opacity-80">Total Fulfilled</p>
              <p className="text-2xl font-bold mt-1">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(overallTotals.fulfilledAmount)}
              </p>
            </div>
            <div>
              <p className="text-sm opacity-80">Pending/Processing</p>
              <p className="text-2xl font-bold mt-1">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(overallTotals.pendingAmount)}
              </p>
            </div>
            <div>
              <p className="text-sm opacity-80">Total Payouts</p>
              <p className="text-2xl font-bold mt-1">{overallTotals.totalPayoutCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Event Totals */}
      {eventTotals.length > 0 && (
        <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
          <h2 className="text-lg font-semibold text-navy-900 p-4 border-b border-surface-200">Event Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Event</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase">Total Net</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase">Fulfilled</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase">Pending</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase">Available</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase">Payouts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {eventTotals.map((event) => (
                  <tr key={event.eventId} className="hover:bg-surface-50">
                    <td className="py-3 px-4 font-medium text-navy-900">{event.eventName}</td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: event.currency || 'USD' }).format(event.totalNet)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: event.currency || 'USD' }).format(event.fulfilledAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-yellow-600">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: event.currency || 'USD' }).format(event.pendingAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-navy-900">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: event.currency || 'USD' }).format(event.availableBalance)}
                    </td>
                    <td className="py-3 px-4 text-right text-surface-600">{event.payoutCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 bg-surface-100 p-1 rounded-lg">
        {(['all', 'PENDING', 'PROCESSING', 'FULFILLED', 'DELAYED', 'REJECTED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all',
              filter === status
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-surface-600 hover:text-surface-900'
            )}
          >
            {status === 'all' ? 'All' : statusLabels[status]}
          </button>
        ))}
      </div>

      {/* Payouts Table */}
      <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
        {filteredPayouts.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-100 mb-4">
              <svg className="w-6 h-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-surface-600">No payouts found</p>
            <p className="text-sm text-surface-500 mt-1">
              {filter === 'all' 
                ? 'You haven\'t requested any payouts yet'
                : `No ${statusLabels[filter].toLowerCase()} payouts`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Requested
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredPayouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-surface-50 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium text-navy-900">{payout.event.name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-navy-900">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: payout.currency,
                        }).format(payout.requestedAmount)}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-surface-600 capitalize">
                        {payout.payoutMethod.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          'inline-flex px-2 py-1 text-xs font-medium rounded border',
                          statusColors[payout.status]
                        )}
                      >
                        {statusLabels[payout.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-surface-600">
                        {formatDate(payout.createdAt)}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-surface-600">
                        {payout.processedAt && (
                          <p>Processed: {formatDate(payout.processedAt)}</p>
                        )}
                        {payout.transactionRef && (
                          <p className="text-xs font-mono text-surface-500 mt-1">
                            Ref: {payout.transactionRef}
                          </p>
                        )}
                        {payout.notes && (
                          <p className="text-xs text-surface-500 mt-1">{payout.notes}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

