'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { adminApi, eventsApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface EventRef {
  id: string;
  name: string;
  slug: string;
}

interface LegacySale {
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
  submittedAt: string;
  event: EventRef;
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  byStatus: {
    PAID: number;
    PENDING: number;
    FAILED: number;
    REFUNDED: number;
  };
}

interface SalesTransaction {
  id: string;
  eventId: string;
  type: string;
  grossAmount: number;
  platformFee: number;
  processingFee: number;
  netAmount: number;
  currency: string;
  paymentMethod: string | null;
  paymentRef: string | null;
  ticketTypeName: string | null;
  ticketQuantity: number | null;
  buyerName: string | null;
  buyerEmail: string | null;
  status: string;
  createdAt: string;
  event: EventRef;
}

interface SalesAnalytics {
  totals: {
    transactionCount: number;
    completedTransactionCount: number;
    ticketTransactionCount: number;
    giftTransactionCount: number;
    grossRevenue: number;
    ticketRevenue: number;
    giftRevenue: number;
    adminRevenue: number;
    ownerNet: number;
    processingFees: number;
    adminRevenueTransactionCount: number;
  };
  byType: Record<string, { count: number; gross: number; adminRevenue: number; ownerNet: number; processingFees: number }>;
  byStatus: Record<string, number>;
  byCurrency: Array<{
    currency: string;
    count: number;
    gross: number;
    adminRevenue: number;
    ownerNet: number;
    processingFees: number;
  }>;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
}

type SalesResponse = {
  sales: LegacySale[];
  stats: SalesStats;
  transactions: SalesTransaction[];
  analytics: SalesAnalytics;
  pagination: PaginationInfo;
  transactionPagination: PaginationInfo;
};

const money = (amount: number | null | undefined, currency?: string | null) => {
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return '-';
  const code = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
};

const aggregateMoney = (amount: number | null | undefined, currency?: string | null) => {
  if (currency) return money(amount, currency);
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(2)} (multi-currency)`;
};

const statusClass = (status: string) => {
  const key = status.toLowerCase();
  if (key === 'completed' || key === 'paid') return 'bg-emerald-100 text-emerald-800';
  if (key === 'pending') return 'bg-yellow-100 text-yellow-800';
  if (key === 'failed') return 'bg-rose-100 text-rose-800';
  if (key === 'refunded') return 'bg-surface-100 text-surface-700';
  return 'bg-surface-100 text-surface-600';
};

const typeLabel = (type: string) => {
  if (type === 'ticket_sale') return 'Ticket Sale';
  if (type === 'gift_cash') return 'Cash Gift';
  if (type === 'gift_package_sale') return 'Gift Package';
  return type.replace(/_/g, ' ');
};

export default function SalesPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRef[]>([]);
  const [legacySales, setLegacySales] = useState<LegacySale[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [transactionPagination, setTransactionPagination] = useState<PaginationInfo | null>(null);
  const [filters, setFilters] = useState({
    eventId: '',
    status: '',
    type: '',
    startDate: '',
    endDate: '',
    page: 1,
  });

  const analyticsDisplayCurrency =
    filters.eventId
      ? transactions[0]?.currency || legacySales[0]?.currency || analytics?.byCurrency?.[0]?.currency || 'USD'
      : (analytics?.byCurrency?.length === 1 ? analytics.byCurrency[0].currency : null);
  const legacyTotalsCurrency = legacySales[0]?.currency || analyticsDisplayCurrency;

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const response = await eventsApi.list();
        setEvents((response.data.events || []) as EventRef[]);
      } catch {
        toast.error('Failed to load events');
      }
    };
    loadEvents();
  }, []);

  useEffect(() => {
    const loadSales = async () => {
      setLoading(true);
      try {
        const params: Record<string, any> = {
          page: filters.page,
          limit: 50,
        };
        if (filters.eventId) params.eventId = filters.eventId;
        if (filters.status) params.status = filters.status;
        if (filters.type) params.type = filters.type;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;

        const response = await adminApi.getSales(params);
        const payload = response.data as SalesResponse;
        setLegacySales(payload.sales || []);
        setStats(payload.stats || null);
        setTransactions(payload.transactions || []);
        setAnalytics(payload.analytics || null);
        setTransactionPagination(payload.transactionPagination || null);
      } catch {
        toast.error('Failed to load sales analytics');
      } finally {
        setLoading(false);
      }
    };
    loadSales();
  }, [filters]);

  const exportTransactions = () => {
    if (!transactions.length) {
      toast.error('No transactions to export');
      return;
    }

    const headers = [
      'Date',
      'Event',
      'Type',
      'Buyer',
      'Buyer Email',
      'Gross Amount',
      'Admin Revenue',
      'Processing Fee',
      'Owner Net',
      'Currency',
      'Status',
      'Payment Method',
      'Payment Ref',
    ];

    const rows = transactions.map((tx) => ([
      formatDate(tx.createdAt, 'yyyy-MM-dd HH:mm'),
      tx.event?.name || '',
      typeLabel(tx.type),
      tx.buyerName || '',
      tx.buyerEmail || '',
      tx.grossAmount.toString(),
      tx.platformFee.toString(),
      tx.processingFee.toString(),
      tx.netAmount.toString(),
      tx.currency || '',
      tx.status || '',
      tx.paymentMethod || '',
      tx.paymentRef || '',
    ]));

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy-900">Sales Analytics</h1>
          <p className="text-sm text-surface-500 mt-1">
            Tickets, gift sales, and admin-earning transactions
          </p>
        </div>
        <button onClick={exportTransactions} className="btn-outline">
          Export Transactions CSV
        </button>
      </div>

      {analytics && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Tickets</p>
            <p className="text-2xl font-bold text-navy-900 mt-1">{analytics.totals.ticketTransactionCount}</p>
            <p className="text-xs text-surface-500 mt-1">{aggregateMoney(analytics.totals.ticketRevenue, analyticsDisplayCurrency)}</p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Gift Sales</p>
            <p className="text-2xl font-bold text-navy-900 mt-1">{analytics.totals.giftTransactionCount}</p>
            <p className="text-xs text-surface-500 mt-1">{aggregateMoney(analytics.totals.giftRevenue, analyticsDisplayCurrency)}</p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Gross Revenue</p>
            <p className="text-2xl font-bold text-brand-900 mt-1">{aggregateMoney(analytics.totals.grossRevenue, analyticsDisplayCurrency)}</p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Admin Revenue</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{aggregateMoney(analytics.totals.adminRevenue, analyticsDisplayCurrency)}</p>
            <p className="text-xs text-surface-500 mt-1">{analytics.totals.adminRevenueTransactionCount} earning txns</p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Owner Net</p>
            <p className="text-2xl font-bold text-navy-900 mt-1">{aggregateMoney(analytics.totals.ownerNet, analyticsDisplayCurrency)}</p>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Processing Fees</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{aggregateMoney(analytics.totals.processingFees, analyticsDisplayCurrency)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <div>
            <label className="label">Event</label>
            <select
              className="input"
              value={filters.eventId}
              onChange={(e) => setFilters((f) => ({ ...f, eventId: e.target.value, page: 1 }))}
            >
              <option value="">All Events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            >
              <option value="">All</option>
              <option value="PAID">Paid / Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}
            >
              <option value="">All Types</option>
              <option value="ticket_sale">Ticket Sale</option>
              <option value="gift_cash">Cash Gift</option>
              <option value="gift_package_sale">Gift Package Sale</option>
            </select>
          </div>
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              className="input"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value, page: 1 }))}
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              className="input"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value, page: 1 }))}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="btn-outline w-full"
              onClick={() =>
                setFilters({
                  eventId: '',
                  status: '',
                  type: '',
                  startDate: '',
                  endDate: '',
                  page: 1,
                })
              }
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200">
          <h2 className="text-base font-semibold text-navy-900">Transactions</h2>
          {transactionPagination ? (
            <p className="text-xs text-surface-500 mt-1">
              Showing {transactions.length} of {transactionPagination.total}
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900 mx-auto" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-surface-600">No transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-200">
              <thead className="bg-surface-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Buyer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Gross</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Admin Revenue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Owner Net</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Payment</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-surface-200">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-surface-800">
                      {formatDate(tx.createdAt, 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/events/${tx.event.id}`} className="text-sm font-medium text-brand-900 hover:text-brand-700">
                        {tx.event.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-surface-900">{typeLabel(tx.type)}</div>
                      {tx.ticketTypeName ? (
                        <div className="text-xs text-surface-500">
                          {tx.ticketTypeName}
                          {tx.ticketQuantity && tx.ticketQuantity > 1 ? ` x${tx.ticketQuantity}` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-navy-900">{tx.buyerName || '-'}</div>
                      <div className="text-xs text-surface-500">{tx.buyerEmail || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-navy-900">
                      {money(tx.grossAmount, tx.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-emerald-700">{money(tx.platformFee, tx.currency)}</div>
                      {tx.status === 'completed' && tx.platformFee > 0 ? (
                        <span className="inline-flex mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-700">
                          Earning
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-800">
                      {money(tx.netAmount, tx.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-1 text-xs font-medium rounded-full', statusClass(tx.status))}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-600">
                      <div>{tx.paymentMethod || '-'}</div>
                      <div className="text-xs font-mono text-surface-500">
                        {tx.paymentRef ? `${tx.paymentRef.slice(0, 10)}...` : '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200">
          <h2 className="text-base font-semibold text-navy-900">Ticket Sales (RSVP Records)</h2>
          <p className="text-xs text-surface-500 mt-1">
            Backward-compatible ticket sales data from RSVP payments.
          </p>
        </div>
        {legacySales.length === 0 ? (
          <div className="text-center py-10 text-surface-600">No ticket sales records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-200">
              <thead className="bg-surface-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Ticket</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-700 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-surface-200">
                {legacySales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3 text-sm text-surface-800">
                      {formatDate(sale.submittedAt, 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-800">{sale.event.name}</td>
                    <td className="px-4 py-3 text-sm text-surface-800">{sale.primaryName}</td>
                    <td className="px-4 py-3 text-sm text-surface-800">
                      {sale.ticketType || '-'}
                      {sale.ticketQuantity ? ` x${sale.ticketQuantity}` : ''}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-navy-900">
                      {money(sale.amountPaid || 0, sale.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-1 text-xs font-medium rounded-full', statusClass(sale.paymentStatus || ''))}>
                        {sale.paymentStatus || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {stats ? (
        <div className="text-xs text-surface-500">
          Legacy ticket totals: {stats.totalSales} sales, {money(stats.totalRevenue, legacyTotalsCurrency)} revenue.
        </div>
      ) : null}
    </div>
  );
}
