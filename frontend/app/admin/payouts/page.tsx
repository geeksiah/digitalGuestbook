'use client';

import { useState, useEffect } from 'react';
import { adminApi, eventsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDate, cn } from '@/lib/utils';
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
      toast.error(error.response?.data?.error || 'Failed to process payout');
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
      toast.error(error.response?.data?.error || 'Failed to reject payout');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'NGN' ? '₦' : currency || '$';
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'FULFILLED':
        return 'bg-emerald-100 text-emerald-800';
      case 'DELAYED':
        return 'bg-orange-100 text-orange-800';
      case 'REJECTED':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-surface-100 text-surface-600';
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy-900">Payout Management</h1>
          <p className="text-sm text-surface-500 mt-1">Manage and process payout requests</p>
        </div>
        <button onClick={exportToCSV} className="btn-outline">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{analytics.totalPending}</p>
            <p className="text-sm text-surface-500 mt-1">
              {formatCurrency(analytics.totalPendingAmount, 'USD')}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Processing</p>
            <p className="text-2xl font-bold text-blue-600">{analytics.totalProcessing || 0}</p>
            <p className="text-sm text-surface-500 mt-1">
              {formatCurrency(analytics.totalProcessingAmount || 0, 'USD')}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Fulfilled</p>
            <p className="text-2xl font-bold text-emerald-600">{analytics.totalFulfilled || 0}</p>
            <p className="text-sm text-surface-500 mt-1">
              {formatCurrency(analytics.totalFulfilledAmount || 0, 'USD')}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Delayed</p>
            <p className="text-2xl font-bold text-orange-600">{analytics.totalDelayed || 0}</p>
            <p className="text-sm text-surface-500 mt-1">
              {formatCurrency(analytics.totalDelayedAmount || 0, 'USD')}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Rejected</p>
            <p className="text-2xl font-bold text-rose-600">{analytics.totalRejected}</p>
            <p className="text-sm text-surface-500 mt-1">
              {formatCurrency(analytics.totalRejectedAmount, 'USD')}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Total</p>
            <p className="text-2xl font-bold text-navy-900">
              {(analytics.byStatus.PENDING || 0) + (analytics.byStatus.PROCESSING || 0) + (analytics.byStatus.FULFILLED || 0) + (analytics.byStatus.DELAYED || 0) + (analytics.byStatus.REJECTED || 0)}
            </p>
            <p className="text-sm text-surface-500 mt-1">
              {formatCurrency(
                analytics.totalPendingAmount + (analytics.totalProcessingAmount || 0) + (analytics.totalFulfilledAmount || 0) + (analytics.totalDelayedAmount || 0) + analytics.totalRejectedAmount,
                'USD'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Event</label>
            <select
              className="input"
              value={filters.eventId}
              onChange={(e) => setFilters({ ...filters, eventId: e.target.value, page: 1 })}
            >
              <option value="">All Events</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="FULFILLED">Fulfilled</option>
              <option value="DELAYED">Delayed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              className="input"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              className="input"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
            />
          </div>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900 mx-auto" />
          </div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-surface-600">No payout requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-200">
              <thead className="bg-surface-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Event</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Transaction Ref</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-surface-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-surface-200">
                {payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-surface-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900">
                      {formatDate(payout.createdAt, 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/admin/events/${payout.event.id}`} className="text-sm font-medium text-navy-600 hover:text-navy-900">
                        {payout.event.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-navy-900">{payout.event.ownerName || 'N/A'}</div>
                      {payout.event.ownerEmail && (
                        <div className="text-sm text-surface-500">{payout.event.ownerEmail}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-navy-900">
                        {formatCurrency(payout.requestedAmount, payout.currency)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn('inline-flex px-2 py-1 text-xs font-medium rounded-full', getStatusColor(payout.status))}>
                        {getStatusLabel(payout.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                      {payout.transactionRef ? (
                        <span className="font-mono text-xs">{payout.transactionRef}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {(payout.status === 'PENDING' || payout.status === 'PROCESSING' || payout.status === 'DELAYED') && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedPayout(payout);
                              setProcessForm({
                                status: payout.status === 'PENDING' ? 'PROCESSING' : payout.status as 'PROCESSING' | 'FULFILLED' | 'DELAYED',
                                transactionRef: payout.transactionRef || '',
                                notes: payout.notes || '',
                              });
                              setShowProcessModal(true);
                            }}
                            className="text-emerald-600 hover:text-emerald-900 mr-4"
                          >
                            Process
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPayout(payout);
                              setShowRejectModal(true);
                            }}
                            className="text-rose-600 hover:text-rose-900"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {payout.status !== 'PENDING' && (
                        <span className="text-surface-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Process Modal */}
      {showProcessModal && selectedPayout && (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-navy-900 mb-4">Process Payout</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-surface-600 mb-2">
                  Event: <span className="font-medium text-navy-900">{selectedPayout.event.name}</span>
                </p>
                <p className="text-sm text-surface-600 mb-2">
                  Amount: <span className="font-medium text-navy-900">
                    {formatCurrency(selectedPayout.requestedAmount, selectedPayout.currency)}
                  </span>
                </p>
              </div>
              <div>
                <label className="label">Status <span className="text-red-500">*</span></label>
                <select
                  className="input"
                  value={processForm.status}
                  onChange={(e) => setProcessForm({ ...processForm, status: e.target.value as 'PROCESSING' | 'FULFILLED' | 'DELAYED' })}
                  required
                >
                  <option value="PROCESSING">Processing</option>
                  <option value="FULFILLED">Fulfilled</option>
                  <option value="DELAYED">Delayed</option>
                </select>
                <p className="text-xs text-surface-500 mt-1">
                  {processForm.status === 'PROCESSING' && 'Mark as currently being processed'}
                  {processForm.status === 'FULFILLED' && 'Mark as completed and fulfilled'}
                  {processForm.status === 'DELAYED' && 'Mark as delayed with a reason in notes'}
                </p>
              </div>
              <div>
                <label className="label">Transaction Reference</label>
                <input
                  type="text"
                  className="input"
                  value={processForm.transactionRef}
                  onChange={(e) => setProcessForm({ ...processForm, transactionRef: e.target.value })}
                  placeholder="Bank transfer reference, etc."
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={processForm.notes}
                  onChange={(e) => setProcessForm({ ...processForm, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowProcessModal(false);
                  setSelectedPayout(null);
                  setProcessForm({ status: 'PROCESSING', transactionRef: '', notes: '' });
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleProcess}
                disabled={processing}
                className="btn-primary flex-1"
              >
                {processing ? 'Processing...' : 'Process Payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPayout && (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-navy-900 mb-4">Reject Payout</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-surface-600 mb-2">
                  Event: <span className="font-medium text-navy-900">{selectedPayout.event.name}</span>
                </p>
                <p className="text-sm text-surface-600 mb-2">
                  Amount: <span className="font-medium text-navy-900">
                    {formatCurrency(selectedPayout.requestedAmount, selectedPayout.currency)}
                  </span>
                </p>
              </div>
              <div>
                <label className="label">Reason for Rejection *</label>
                <textarea
                  required
                  className="input"
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this payout request..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedPayout(null);
                  setRejectReason('');
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="btn-rose flex-1"
              >
                {processing ? 'Rejecting...' : 'Reject Payout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
