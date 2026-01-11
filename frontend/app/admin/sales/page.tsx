'use client';

import { useState, useEffect } from 'react';
import { adminApi, eventsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDate, cn } from '@/lib/utils';
import Link from 'next/link';

interface Sale {
  id: string;
  primaryName: string;
  secondaryName: string | null;
  email: string | null;
  phone: string | null;
  ticketType: string | null;
  ticketQuantity: number | null;
  amountPaid: number | null;
  currency: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentRef: string | null;
  paymentDate: string | null;
  submittedAt: string;
  event: {
    id: string;
    name: string;
    slug: string;
  };
  invitation: {
    accessCode: string;
  } | null;
}

interface Stats {
  totalSales: number;
  totalRevenue: number;
  byStatus: {
    PAID: number;
    PENDING: number;
    FAILED: number;
    REFUNDED: number;
  };
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    eventId: '',
    status: '',
    startDate: '',
    endDate: '',
    page: 1,
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchSales();
  }, [filters]);

  const fetchEvents = async () => {
    try {
      const response = await eventsApi.list();
      setEvents(response.data.events || []);
    } catch (error) {
      toast.error('Failed to load events');
    }
  };

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: filters.page,
        limit: 50,
      };
      if (filters.eventId) params.eventId = filters.eventId;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await adminApi.getSales(params);
      setSales(response.data.sales || []);
      setStats(response.data.stats || null);
    } catch (error) {
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (!amount) return '-';
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'NGN' ? '₦' : currency === 'GHS' ? '₵' : currency || '$';
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-100 text-emerald-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-rose-100 text-rose-800';
      case 'REFUNDED':
        return 'bg-surface-100 text-surface-800';
      default:
        return 'bg-surface-100 text-surface-600';
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Event', 'Customer', 'Email', 'Phone', 'Ticket Type', 'Quantity', 'Amount', 'Currency', 'Status', 'Payment Method', 'Payment Ref'];
    const rows = sales.map(sale => [
      formatDate(sale.submittedAt, 'yyyy-MM-dd HH:mm'),
      sale.event.name,
      sale.primaryName + (sale.secondaryName ? ` & ${sale.secondaryName}` : ''),
      sale.email || '',
      sale.phone || '',
      sale.ticketType || '',
      sale.ticketQuantity?.toString() || '',
      sale.amountPaid?.toString() || '',
      sale.currency || '',
      sale.paymentStatus || '',
      sale.paymentMethod || '',
      sale.paymentRef || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy-900">Ticket Sales</h1>
          <p className="text-sm text-surface-500 mt-1">Manage and track all ticket sales</p>
        </div>
        <button onClick={exportToCSV} className="btn-outline">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Total Sales</p>
            <p className="text-2xl font-bold text-navy-900">{stats.totalSales}</p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">
              {stats.totalRevenue > 0 ? formatCurrency(stats.totalRevenue, 'USD') : '-'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Paid</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.byStatus.PAID}</p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.byStatus.PENDING}</p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <p className="text-sm text-surface-500 mb-1">Failed</p>
            <p className="text-2xl font-bold text-rose-600">{stats.byStatus.FAILED}</p>
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
            <label className="label">Payment Status</label>
            <select
              className="input"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            >
              <option value="">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
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

      {/* Sales Table */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900 mx-auto" />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-surface-600">No sales found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-200">
                <thead className="bg-surface-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Event</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Ticket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Payment Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-surface-200">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-surface-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900">
                        {formatDate(sale.submittedAt, 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/admin/events/${sale.event.id}`} className="text-sm font-medium text-navy-600 hover:text-navy-900">
                          {sale.event.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-navy-900">{sale.primaryName}</div>
                        {sale.email && (
                          <div className="text-sm text-surface-500">{sale.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-surface-900">{sale.ticketType || '-'}</div>
                        {sale.ticketQuantity && (
                          <div className="text-xs text-surface-500">Qty: {sale.ticketQuantity}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-navy-900">
                          {formatCurrency(sale.amountPaid, sale.currency)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn('inline-flex px-2 py-1 text-xs font-medium rounded-full', getStatusColor(sale.paymentStatus))}>
                          {sale.paymentStatus || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                        {sale.paymentMethod || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {sale.paymentRef && (
                          <span className="text-surface-500 font-mono text-xs">{sale.paymentRef.slice(0, 8)}...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

