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
  status: 'PENDING' | 'PROCESSED' | 'REJECTED';
  requestedAt: string;
  processedAt: string | null;
  transactionRef: string | null;
  notes: string | null;
  event: {
    id: string;
    name: string;
    slug: string;
  };
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PROCESSED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
};

const statusLabels = {
  PENDING: 'Pending',
  PROCESSED: 'Processed',
  REJECTED: 'Rejected',
};

export default function OwnerPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'PROCESSED' | 'REJECTED'>('all');

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const response = await ownerDashboardApi.getPayouts();
      setPayouts(response.data.payouts || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayouts = filter === 'all' 
    ? payouts 
    : payouts.filter(p => p.status === filter);

  const stats = {
    total: payouts.length,
    pending: payouts.filter(p => p.status === 'PENDING').length,
    processed: payouts.filter(p => p.status === 'PROCESSED').length,
    rejected: payouts.filter(p => p.status === 'REJECTED').length,
    totalAmount: payouts
      .filter(p => p.status === 'PROCESSED')
      .reduce((sum, p) => sum + p.requestedAmount, 0),
    pendingAmount: payouts
      .filter(p => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.requestedAmount, 0),
  };

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
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Payout Management</h1>
        <p className="text-surface-600 mt-1">View and track your payout requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600">Total Payouts</p>
              <p className="text-2xl font-bold text-navy-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600">Pending</p>
              <p className="text-2xl font-bold text-navy-900 mt-1">{stats.pending}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600">Processed</p>
              <p className="text-2xl font-bold text-navy-900 mt-1">{stats.processed}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600">Total Processed</p>
              <p className="text-2xl font-bold text-navy-900 mt-1">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(stats.totalAmount)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 bg-surface-100 p-1 rounded-lg">
        {(['all', 'PENDING', 'PROCESSED', 'REJECTED'] as const).map((status) => (
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
                        {formatDate(payout.requestedAt)}
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

