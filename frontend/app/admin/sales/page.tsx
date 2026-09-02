'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { adminApi, eventsApi } from '@/lib/api';
import { formatCount, formatDate, getStatusTone, humanizeEnum } from '@/lib/utils';
import { Menu, MenuItem } from '@/components/ui/Overlay';
import {
  DetailRow,
  EmptyState,
  ListSkeleton,
  PageHeader,
  Pagination,
  Panel,
  StatRow,
  StatRowSkeleton,
  StatusBadge,
  Td,
  Th,
} from '@/components/ui/Primitives';

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

  const activeFilterCount = [filters.eventId, filters.status, filters.type, filters.startDate, filters.endDate].filter(
    Boolean
  ).length;

  const transactionPageCount = transactionPagination
    ? Math.max(1, Math.ceil(transactionPagination.total / (transactionPagination.limit || 50)))
    : 1;

  return (
    <div className="page">
      <PageHeader
        title="Sales"
        actions={
          <button onClick={exportTransactions} className="btn-outline" disabled={transactions.length === 0}>
            Export CSV
          </button>
        }
        mobileActions={
          <Menu label="Sales actions" sheetTitle="Sales">
            <MenuItem disabled={transactions.length === 0} onClick={exportTransactions}>
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
              { label: 'Gross', value: aggregateMoney(analytics.totals.grossRevenue, analyticsDisplayCurrency) },
              {
                label: 'Platform revenue',
                value: aggregateMoney(analytics.totals.adminRevenue, analyticsDisplayCurrency),
                tone: 'positive',
                hint: `${formatCount(analytics.totals.adminRevenueTransactionCount)} earning transactions`,
              },
              { label: 'Owner net', value: aggregateMoney(analytics.totals.ownerNet, analyticsDisplayCurrency) },
              { label: 'Processing fees', value: aggregateMoney(analytics.totals.processingFees, analyticsDisplayCurrency) },
            ]}
          />
          <p className="meta num">
            {formatCount(analytics.totals.ticketTransactionCount)} ticket transactions ·{' '}
            {formatCount(analytics.totals.giftTransactionCount)} gift transactions
          </p>
        </>
      ) : null}

      <details className="panel" open={activeFilterCount > 0}>
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span className="panel-title">Filters</span>
          {activeFilterCount > 0 ? (
            <StatusBadge tone="brand">{activeFilterCount} active</StatusBadge>
          ) : (
            <span className="meta">All transactions</span>
          )}
        </summary>
        <div className="border-t border-surface-200 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="label" htmlFor="filter-event">
                Event
              </label>
              <select
                id="filter-event"
                className="input"
                value={filters.eventId}
                onChange={(e) => setFilters((f) => ({ ...f, eventId: e.target.value, page: 1 }))}
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
              <label className="label" htmlFor="filter-status">
                Status
              </label>
              <select
                id="filter-status"
                className="input"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
              >
                <option value="">Any status</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="REFUNDED">Refunded</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="filter-type">
                Type
              </label>
              <select
                id="filter-type"
                className="input"
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}
              >
                <option value="">All types</option>
                <option value="ticket_sale">Ticket sale</option>
                <option value="gift_cash">Cash gift</option>
                <option value="gift_package_sale">Gift package</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="filter-start">
                From
              </label>
              <input
                id="filter-start"
                type="date"
                className="input"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value, page: 1 }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="filter-end">
                To
              </label>
              <input
                id="filter-end"
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
                disabled={activeFilterCount === 0}
                onClick={() =>
                  setFilters({ eventId: '', status: '', type: '', startDate: '', endDate: '', page: 1 })
                }
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>
      </details>

      <Panel
        title="Transactions"
        action={
          transactionPagination ? (
            <span className="meta num">{formatCount(transactionPagination.total)} total</span>
          ) : null
        }
        flush
      >
        {loading ? (
          <ListSkeleton rows={6} className="rounded-none border-0" />
        ) : transactions.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="No transactions"
              hint={activeFilterCount > 0 ? 'Try widening the filters.' : undefined}
            />
          </div>
        ) : (
          <>
            <div className="divide-y divide-surface-200 lg:hidden">
              {transactions.map((tx) => (
                <div key={tx.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/events/${tx.event.id}`}
                        className="block truncate text-[15px] font-semibold text-brand-900"
                      >
                        {tx.event.name}
                      </Link>
                      <p className="mt-0.5 meta truncate">
                        {typeLabel(tx.type)} &middot; {tx.buyerName || 'Unknown buyer'}
                      </p>
                      <p className="mt-0.5 meta">{formatDate(tx.createdAt, 'MMM d, yyyy p')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="num text-[15px] font-semibold text-brand-900">{money(tx.grossAmount, tx.currency)}</p>
                      <StatusBadge tone={getStatusTone(tx.status)} className="mt-1">
                        {humanizeEnum(tx.status)}
                      </StatusBadge>
                    </div>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4">
                    <DetailRow label="Platform">{money(tx.platformFee, tx.currency)}</DetailRow>
                    <DetailRow label="Owner net">{money(tx.netAmount, tx.currency)}</DetailRow>
                  </dl>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="data-table" style={{ minWidth: 1000 }}>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Event</Th>
                    <Th>Type</Th>
                    <Th>Buyer</Th>
                    <Th align="right">Gross</Th>
                    <Th align="right">Platform</Th>
                    <Th align="right">Owner net</Th>
                    <Th>Status</Th>
                    <Th>Payment</Th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="table-row">
                      <Td className="whitespace-nowrap">{formatDate(tx.createdAt, 'MMM d, yyyy p')}</Td>
                      <Td>
                        <Link href={`/admin/events/${tx.event.id}`} className="font-medium text-brand-900 hover:underline">
                          {tx.event.name}
                        </Link>
                      </Td>
                      <Td>
                        <p>{typeLabel(tx.type)}</p>
                        {tx.ticketTypeName ? (
                          <p className="meta">
                            {tx.ticketTypeName}
                            {tx.ticketQuantity && tx.ticketQuantity > 1 ? ` ×${tx.ticketQuantity}` : ''}
                          </p>
                        ) : null}
                      </Td>
                      <Td>
                        <p className="truncate">{tx.buyerName || <span className="text-surface-500">&mdash;</span>}</p>
                        {tx.buyerEmail ? <p className="meta truncate">{tx.buyerEmail}</p> : null}
                      </Td>
                      <Td align="right" className="num font-medium text-brand-900">
                        {money(tx.grossAmount, tx.currency)}
                      </Td>
                      <Td align="right" className="num font-semibold text-emerald-700">
                        {money(tx.platformFee, tx.currency)}
                      </Td>
                      <Td align="right" className="num">
                        {money(tx.netAmount, tx.currency)}
                      </Td>
                      <Td>
                        <StatusBadge tone={getStatusTone(tx.status)}>{humanizeEnum(tx.status)}</StatusBadge>
                      </Td>
                      <Td>
                        <p>{tx.paymentMethod ? humanizeEnum(tx.paymentMethod) : '—'}</p>
                        {tx.paymentRef ? (
                          <p className="meta truncate font-mono" title={tx.paymentRef}>
                            {tx.paymentRef}
                          </p>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {transactionPagination && transactionPageCount > 1 ? (
        <Pagination
          page={filters.page}
          pageCount={transactionPageCount}
          total={transactionPagination.total}
          pageSize={transactionPagination.limit || 50}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
        />
      ) : null}

      <Panel
        title="RSVP ticket payments"
        action={
          stats ? (
            <span className="meta num">
              {formatCount(stats.totalSales)} · {money(stats.totalRevenue, legacyTotalsCurrency)}
            </span>
          ) : null
        }
        flush
      >
        {legacySales.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState title="No RSVP ticket payments" />
          </div>
        ) : (
          <>
            <div className="divide-y divide-surface-200 md:hidden">
              {legacySales.map((sale) => (
                <div key={sale.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-brand-900">{sale.primaryName}</p>
                      <p className="mt-0.5 meta truncate">
                        {sale.event.name} &middot; {formatDate(sale.submittedAt, 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="num text-[15px] font-semibold text-brand-900">
                        {money(sale.amountPaid || 0, sale.currency)}
                      </p>
                      <StatusBadge tone={getStatusTone(sale.paymentStatus || '')} className="mt-1">
                        {humanizeEnum(sale.paymentStatus || '') || 'Unknown'}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="data-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Event</Th>
                    <Th>Customer</Th>
                    <Th>Ticket</Th>
                    <Th align="right">Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {legacySales.map((sale) => (
                    <tr key={sale.id} className="table-row">
                      <Td className="whitespace-nowrap">{formatDate(sale.submittedAt, 'MMM d, yyyy p')}</Td>
                      <Td>{sale.event.name}</Td>
                      <Td className="font-medium text-brand-900">{sale.primaryName}</Td>
                      <Td>
                        {sale.ticketType || '—'}
                        {sale.ticketQuantity ? ` ×${sale.ticketQuantity}` : ''}
                      </Td>
                      <Td align="right" className="num font-medium text-brand-900">
                        {money(sale.amountPaid || 0, sale.currency)}
                      </Td>
                      <Td>
                        <StatusBadge tone={getStatusTone(sale.paymentStatus || '')}>
                          {humanizeEnum(sale.paymentStatus || '') || 'Unknown'}
                        </StatusBadge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
