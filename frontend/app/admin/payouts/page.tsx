'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface PayoutRequest {
  id: string;
  eventId: string;
  requestedAmount: number;
  currency: string;
  payoutMethod: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  processedAt: string | null;
  processedBy: string | null;
  transactionRef: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  event: {
    id: string;
    name: string;
    slug: string;
    ownerName: string | null;
    ownerEmail: string | null;
  };
}

interface PayoutSummary {
  pendingCount: number;
  pendingAmount: number;
  processedToday: number;
}

const Icons = {
  wallet: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  check: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  x: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  clock: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  refresh: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
};

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPayouts();
  }, [statusFilter]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getPayouts(statusFilter || undefined);
      setPayouts(response.data.payouts);
      setSummary(response.data.summary);
    } catch (error) {
      toast.error('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!selectedPayout) return;
    
    setProcessing(true);
    try {
      await adminApi.processPayout(selectedPayout.id, transactionRef);
      toast.success('Payout processed successfully');
      setShowProcessModal(false);
      setSelectedPayout(null);
      setTransactionRef('');
      fetchPayouts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to process payout');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayout || !rejectionReason.trim()) return;
    
    setProcessing(true);
    try {
      await adminApi.rejectPayout(selectedPayout.id, rejectionReason);
      toast.success('Payout rejected');
      setShowRejectModal(false);
      setSelectedPayout(null);
      setRejectionReason('');
      fetchPayouts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject payout');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-700',
      processing: 'bg-blue-50 text-blue-700',
      completed: 'bg-green-50 text-green-700',
      rejected: 'bg-red-50 text-red-700',
    };
    return styles[status] || 'bg-gray-50 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Payout Management</h1>
          <p className="text-surface-500">Review and process payout requests from event owners</p>
        </div>
        <button
          onClick={fetchPayouts}
          className="btn-outline flex items-center gap-2"
        >
          {Icons.refresh}
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                {Icons.clock}
              </div>
              <div>
                <p className="text-sm text-surface-500">Pending Requests</p>
                <p className="text-2xl font-semibold text-navy-900">{summary.pendingCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                {Icons.wallet}
              </div>
              <div>
                <p className="text-sm text-surface-500">Pending Amount</p>
                <p className="text-2xl font-semibold text-navy-900">${summary.pendingAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                {Icons.check}
              </div>
              <div>
                <p className="text-sm text-surface-500">Processed Today</p>
                <p className="text-2xl font-semibold text-navy-900">{summary.processedToday}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <div className="flex gap-2">
          {['all', 'pending', 'processing', 'completed', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status === 'all' ? '' : status)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                (status === 'all' && !statusFilter) || statusFilter === status
                  ? 'bg-navy-900 text-white'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900"></div>
          </div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-100 flex items-center justify-center text-surface-400">
              {Icons.wallet}
            </div>
            <p className="text-surface-500">No payout requests found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Event</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {payouts.map(payout => (
                <tr key={payout.id} className="hover:bg-surface-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy-900">{payout.event.name}</p>
                    <p className="text-sm text-surface-500">{payout.event.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-surface-700">{payout.event.ownerName || 'N/A'}</p>
                    <p className="text-sm text-surface-500">{payout.event.ownerEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy-900">${payout.requestedAmount.toFixed(2)}</p>
                    <p className="text-sm text-surface-500">{payout.currency}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize">{payout.payoutMethod}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusBadge(payout.status))}>
                      {payout.status}
                    </span>
                    {payout.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1">{payout.rejectionReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-600">
                    {formatDate(payout.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {payout.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedPayout(payout); setShowProcessModal(true); }}
                          className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors flex items-center gap-1"
                        >
                          {Icons.check} Process
                        </button>
                        <button
                          onClick={() => { setSelectedPayout(payout); setShowRejectModal(true); }}
                          className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-1"
                        >
                          {Icons.x} Reject
                        </button>
                      </div>
                    )}
                    {payout.transactionRef && (
                      <p className="text-xs text-surface-500">Ref: {payout.transactionRef}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Process Modal */}
      {showProcessModal && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowProcessModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-navy-900 mb-4">Process Payout</h3>
            <p className="text-surface-600 mb-4">
              You are about to process a payout of <strong>${selectedPayout.requestedAmount.toFixed(2)} {selectedPayout.currency}</strong> to <strong>{selectedPayout.event.ownerName}</strong> for event <strong>{selectedPayout.event.name}</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-surface-700 mb-1">Transaction Reference (optional)</label>
              <input
                type="text"
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
                placeholder="e.g., WIRE-12345"
                className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowProcessModal(false)}
                className="flex-1 px-4 py-2 border border-surface-200 rounded-lg text-surface-700 hover:bg-surface-50"
              >
                Cancel
              </button>
              <button
                onClick={handleProcess}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Confirm Process'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-navy-900 mb-4">Reject Payout</h3>
            <p className="text-surface-600 mb-4">
              You are about to reject a payout request from <strong>{selectedPayout.event.ownerName}</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-surface-700 mb-1">Rejection Reason *</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explain why this payout is being rejected..."
                rows={3}
                className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 border border-surface-200 rounded-lg text-surface-700 hover:bg-surface-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

