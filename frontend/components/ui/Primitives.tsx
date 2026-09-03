'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useAppBarSlot } from './app-bar-context';
import { Spinner } from './Overlay';

/* ==========================================================================
   Shared dashboard primitives.
   One implementation per pattern: page header, stats, panels, tabs, filters,
   tables, lists, pagination, empty/loading states, status.
   ========================================================================== */

/* ============================================================= page header */

function BackChevron() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * The single page identity block. Title, at most a line of live metadata, and
 * the page's actions. Deliberately has no eyebrow and no description slot.
 *
 * On mobile it does not render in the page body: it moves into the top app
 * bar, so a screen never shows its own name twice.
 */
export function PageHeader({
  title,
  meta,
  actions,
  mobileActions,
  backHref,
  backLabel,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Override for the app bar when the desktop actions are too wide. */
  mobileActions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  const slot = useAppBarSlot();
  const barActions = mobileActions !== undefined ? mobileActions : actions;

  const appBar = (
    <>
      {backHref ? (
        <Link href={backHref} className="icon-btn shrink-0" aria-label={backLabel || 'Back'}>
          <BackChevron />
        </Link>
      ) : null}
      <h1 className={cn('min-w-0 flex-1 truncate text-[15px] font-semibold text-brand-900', backHref ? 'px-0' : 'px-2')}>
        {title}
      </h1>
      {barActions ? <div className="flex shrink-0 items-center gap-1">{barActions}</div> : null}
    </>
  );

  return (
    <>
      {slot ? createPortal(appBar, slot) : null}
      <header className={cn('hidden flex-wrap items-center justify-between gap-x-4 gap-y-3 lg:flex', className)}>
        <div className="min-w-0">
          {backHref ? (
            <Link
              href={backHref}
              className="-ml-1 mb-0.5 inline-flex items-center gap-0.5 rounded text-[13px] font-medium text-surface-600 transition-colors hover:text-brand-900"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel || 'Back'}
            </Link>
          ) : null}
          <h1 className="page-title">{title}</h1>
          {meta ? <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 meta">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {meta ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 meta lg:hidden">{meta}</div>
      ) : null}
    </>
  );
}

/** Row of controls above a data set: count/filters on the left, actions right. */
export function Toolbar({
  children,
  className,
  end,
}: {
  children?: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {end ? (
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:flex-wrap [&>*]:flex-1 sm:[&>*]:flex-none">
          {end}
        </div>
      ) : null}
    </div>
  );
}

/* =================================================================== stats */

export type StatItem = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: 'default' | 'positive' | 'attention';
};

/**
 * Key numbers as one divided surface instead of four floating tiles. Two
 * columns on phones, four from lg up.
 */
export function StatRow({ items, className }: { items: StatItem[]; className?: string }) {
  const cols =
    items.length === 1
      ? 'grid-cols-1'
      : items.length === 2
      ? 'grid-cols-2'
      : items.length === 3
      ? 'grid-cols-2 sm:grid-cols-3'
      : 'grid-cols-2 lg:grid-cols-4';
  return (
    <div
      className={cn(
        'grid divide-x divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white',
        cols,
        items.length === 3 ? 'sm:divide-y-0' : items.length > 3 ? 'lg:divide-y-0' : 'divide-y-0',
        className
      )}
    >
      {items.map((item) => {
        const body = (
          <>
            <p className="truncate text-[13px] font-medium text-surface-600">{item.label}</p>
            <p
              className={cn(
                'num mt-1 text-[26px] font-semibold leading-none tracking-tight',
                item.tone === 'positive' ? 'text-emerald-700' : 'text-brand-900'
              )}
            >
              {item.value}
            </p>
            {item.hint ? <p className="mt-1.5 truncate text-[12px] text-surface-600">{item.hint}</p> : null}
          </>
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="min-w-0 px-4 py-3.5 transition-colors hover:bg-surface-50"
          >
            {body}
          </Link>
        ) : (
          <div key={item.label} className="min-w-0 px-4 py-3.5">
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Single compact metric, for use inside panels. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium text-surface-600">{label}</p>
      <p className="num mt-0.5 text-xl font-semibold leading-tight tracking-tight text-brand-900">{value}</p>
      {hint ? <p className="mt-1 truncate text-[12px] text-surface-600">{hint}</p> : null}
    </div>
  );
}

/* ================================================================== panels */

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Remove body padding, e.g. when the body is a table or a divided list. */
  flush?: boolean;
}) {
  return (
    <section className={cn('panel', className)}>
      {title || action ? (
        <div className="panel-header">
          {typeof title === 'string' ? <h2 className="panel-title">{title}</h2> : title}
          {action ? (
            <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{action}</div>
          ) : null}
        </div>
      ) : null}
      <div className={cn(flush ? undefined : 'panel-body', bodyClassName)}>{children}</div>
    </section>
  );
}

/* ============================================================ empty states */

export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('empty-state', className)}>
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      {hint ? <p className="max-w-sm text-[13px] leading-5 text-surface-600">{hint}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/* ================================================================ loading */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

/** Skeleton that matches the geometry of StatRow. */
export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white sm:grid-cols-2 lg:grid-cols-4 lg:divide-y-0">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="px-4 py-3.5">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="mt-2 h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton list that matches ListRow geometry. */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
          <Skeleton className="hidden h-8 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Full page skeleton: header + stats + list. Keeps layout from jumping. */
export function PageSkeleton({ stats = 4, rows = 4 }: { stats?: number; rows?: number }) {
  return (
    <div className="page" aria-busy="true">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-10 w-28" />
      </div>
      {stats > 0 ? <StatRowSkeleton count={stats} /> : null}
      <ListSkeleton rows={rows} />
    </div>
  );
}

/* ================================================================= status */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

const TONE_CLASS: Record<StatusTone, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-error',
  info: 'badge-info',
  neutral: 'badge-neutral',
  brand: 'badge-brand',
};

const TONE_DOT: Record<StatusTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  neutral: 'bg-surface-400',
  brand: 'bg-brand-700',
};

/** Status never relies on colour alone: label text always carries the meaning. */
export function StatusBadge({
  tone = 'neutral',
  children,
  dot,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(TONE_CLASS[tone], className)}>
      {dot ? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* ============================================================ tabs/filters */

export type TabItem = { id: string; label: string; count?: number };

/** Underline tabs. Scroll horizontally rather than wrapping on small screens. */
export function Tabs({
  items,
  active,
  onChange,
  className,
  label = 'Sections',
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Few enough tabs to read at 320px? Spread them across the full width.
  // A longer set keeps its natural width and scrolls, which stays legible.
  const fitsOnOneRow = items.length <= 4;

  useEffect(() => {
    const node = ref.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <div
      ref={ref}
      className={cn('tabs-bar', fitsOnOneRow && 'w-full', className)}
      role="tablist"
      aria-label={label}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-active={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              'tab-item justify-center',
              fitsOnOneRow && 'flex-1 sm:flex-none',
              isActive && 'tab-item-active'
            )}
          >
            {item.label}
            {item.count !== undefined ? <span className="tab-count num">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** 2-4 mutually exclusive options. Use a Select above that. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  // Up to four options share the full width evenly on phones. Beyond that the
  // labels would be unreadable, so the track scrolls instead.
  const fitsOnOneRow = options.length <= 4;

  return (
    <div
      className={cn(
        'segmented max-w-full',
        fitsOnOneRow ? 'flex w-full sm:w-auto' : 'overflow-x-auto scrollbar-hide',
        className
      )}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'segmented-item',
            fitsOnOneRow && 'flex-1 sm:flex-none',
            value === option.value && 'segmented-item-active'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ================================================================= search */

export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  className,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className'>) {
  const id = useId();
  return (
    <div className={cn('relative min-w-0', className)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
      </svg>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
        {...rest}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 icon-btn icon-btn-sm"
          aria-label="Clear search"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/** Debounce helper for search fields backed by network requests. */
export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ============================================================= pagination */

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const pages = useMemo(() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
    const window: Array<number | 'gap'> = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(pageCount - 1, page + 1);
    if (start > 2) window.push('gap');
    for (let index = start; index <= end; index += 1) window.push(index);
    if (end < pageCount - 1) window.push('gap');
    window.push(pageCount);
    return window;
  }, [page, pageCount]);

  if (pageCount <= 1) return null;

  const from = pageSize ? (page - 1) * pageSize + 1 : null;
  const to = pageSize && total !== undefined ? Math.min(page * pageSize, total) : null;

  return (
    <nav
      className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}
      aria-label="Pagination"
    >
      {from && to && total !== undefined ? (
        <p className="meta num">
          {from}-{to} of {total}
        </p>
      ) : (
        <p className="meta">
          Page {page} of {pageCount}
        </p>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((entry, index) =>
            entry === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-surface-500" aria-hidden="true">
                &hellip;
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  'num inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors',
                  entry === page
                    ? 'bg-brand-900 text-white'
                    : 'text-surface-700 hover:bg-surface-200 hover:text-brand-900'
                )}
              >
                {entry}
              </button>
            )
          )}
        </div>
        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

/** Client-side pagination state with a stable page when the data set shrinks. */
export function usePagination<T>(rows: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const slice = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize]
  );

  return { page: safePage, pageCount, pageSize, total: rows.length, rows: slice, setPage };
}

/* ================================================================= tables */

/**
 * Table shell. Scrolls inside itself so the page never scrolls sideways.
 * Pair with a card/list layout below `md` for anything wider than 4 columns.
 */
export function TableShell({
  head,
  children,
  className,
  minWidth = 720,
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
  minWidth?: number;
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="data-table" style={{ minWidth }}>
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'table-header',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <td
      className={cn(
        'table-cell',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </td>
  );
}

/* =================================================================== lists */

/**
 * One record. Identity and status first, then one metric line, then a single
 * primary action plus overflow. Reads as a native list row on mobile.
 */
export function ListRow({
  media,
  title,
  status,
  meta,
  metrics,
  action,
  overflow,
  href,
  className,
}: {
  media?: ReactNode;
  title: ReactNode;
  status?: ReactNode;
  meta?: ReactNode;
  metrics?: ReactNode;
  action?: ReactNode;
  overflow?: ReactNode;
  href?: string;
  className?: string;
}) {
  const identity = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {media ? <div className="shrink-0">{media}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-semibold leading-6 text-brand-900">{title}</span>
          {status}
        </div>
        {meta ? <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 meta">{meta}</div> : null}
      </div>
    </div>
  );

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', className)}>
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
          {identity}
        </Link>
      ) : (
        identity
      )}
      {metrics ? (
        <div className="hidden shrink-0 items-center gap-5 md:flex">{metrics}</div>
      ) : null}
      {action || overflow ? (
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {overflow}
        </div>
      ) : null}
    </div>
  );
}

/** Container for ListRow items. Divided surface, no card-per-row. */
export function ListSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white', className)}>
      {children}
    </div>
  );
}

/** Compact label/value pair used inside detail panels and mobile rows. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-[13px] text-surface-600">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-medium text-surface-900">{children}</dd>
    </div>
  );
}

/* ================================================================ controls */

/** Accessible on/off control. Use for settings that apply immediately. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={inputId} className="block text-sm font-medium text-surface-900">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[13px] leading-5 text-surface-600">{description}</p> : null}
      </div>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-45',
          checked ? 'bg-brand-900' : 'bg-surface-300'
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

/** Button that shows progress without changing width, and blocks re-submits. */
export function SubmitButton({
  loading,
  children,
  className = 'btn-primary',
  ...rest
}: {
  loading?: boolean;
  children: ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} disabled={loading || rest.disabled} className={className} aria-busy={loading || undefined}>
      {loading ? <Spinner /> : null}
      <span>{children}</span>
    </button>
  );
}

/** Copy-to-clipboard icon control with inline confirmation. */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      const field = document.createElement('textarea');
      field.value = value;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand('copy');
        setCopied(true);
      } finally {
        document.body.removeChild(field);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn('icon-btn icon-btn-sm', className)}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
    >
      {copied ? (
        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 13 4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.7}
            d="M8 5.5A2.5 2.5 0 0 1 10.5 3h6A2.5 2.5 0 0 1 19 5.5v9a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 8 14.5v-9Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M16 17v1.5A2.5 2.5 0 0 1 13.5 21h-6A2.5 2.5 0 0 1 5 18.5v-9A2.5 2.5 0 0 1 7.5 7H8" />
        </svg>
      )}
    </button>
  );
}

/** Initials avatar. Falls back cleanly when there is no image or name. */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

  const sizeClass = { sm: 'h-8 w-8 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' }[size];

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || ''}
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full object-cover', sizeClass, className)}
      />
    );
  }

  return (
    <span
      aria-hidden={name ? undefined : 'true'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-800',
        sizeClass,
        className
      )}
    >
      {initials}
    </span>
  );
}

/** Thumbnail with a deterministic fallback, for event covers. */
export function Thumb({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  return (
    <div className={cn('overflow-hidden rounded-lg border border-surface-200 bg-surface-200', className)}>
      {show ? (
        <img src={src as string} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-brand-900 to-brand-700" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * A guest-facing link belonging to an event: name, the address a guest sees,
 * and open / copy / share. Used by both the admin and owner event workspaces.
 *
 * Pass `url` when the caller has already resolved the event's public origin
 * (a connected custom domain); otherwise the current origin is used.
 */
export function PublicPageRow({
  label,
  path,
  url,
  disabled,
  onCopy,
}: {
  label: string;
  path: string;
  /** Absolute URL a guest would visit. Defaults to path on the current origin. */
  url?: string;
  disabled?: boolean;
  onCopy?: (path: string) => void;
}) {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const href = url || `${origin}${path}`;
  // Show what a guest actually types: host + path, without the scheme.
  const display = href ? href.replace(/^https?:\/\//, '') : path;

  return (
    <div className={cn('flex items-center gap-1 px-4 py-2.5', disabled && 'opacity-60')}>
      <div className="min-w-0 flex-1 pr-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-surface-900">{label}</span>
          {disabled ? <StatusBadge tone="neutral">Off</StatusBadge> : null}
        </div>
        <p className="truncate font-mono text-[12px] text-surface-600" title={display}>
          {display}
        </p>
      </div>
      <a
        href={href || path}
        target="_blank"
        rel="noopener noreferrer"
        className="icon-btn icon-btn-sm"
        aria-label={`Open ${label}`}
        title={`Open ${label}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.7}
            d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
      {/* Share covers copying on phones; desktop gets the plain copy control. */}
      <ShareButton url={href} title={label} className="sm:hidden" />
      {onCopy ? (
        <button
          type="button"
          onClick={() => onCopy(url || path)}
          className="icon-btn icon-btn-sm hidden sm:inline-flex"
          aria-label={`Copy link to ${label}`}
          title="Copy link"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.7}
              d="M8 5.5A2.5 2.5 0 0 1 10.5 3h6A2.5 2.5 0 0 1 19 5.5v9a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 8 14.5v-9Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.7}
              d="M16 17v1.5A2.5 2.5 0 0 1 13.5 21h-6A2.5 2.5 0 0 1 5 18.5v-9A2.5 2.5 0 0 1 7.5 7H8"
            />
          </svg>
        </button>
      ) : (
        <CopyButton value={href} label={`Copy link to ${label}`} className="hidden sm:inline-flex" />
      )}
    </div>
  );
}

/**
 * Hands a link to the device's own share sheet. Falls back to copying, so the
 * control is never dead on desktop browsers without the Web Share API.
 */
export function ShareButton({
  url,
  title,
  text,
  className,
  label = 'Share',
  showLabel,
}: {
  url: string;
  title?: string;
  text?: string;
  className?: string;
  label?: string;
  /** Render as a labelled button instead of an icon-only control. */
  showLabel?: boolean;
}) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    if (!url) return;

    if (canShare) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // A dismissed share sheet is not a failure; fall through to copying.
        if ((error as DOMException)?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const icon = copied ? (
    <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 13 4 4L19 7" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M12 4v12m0-12L8.5 7.5M12 4l3.5 3.5M5 14v3.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V14"
      />
    </svg>
  );

  if (showLabel) {
    return (
      <button type="button" onClick={share} disabled={!url} className={cn('btn-outline btn-sm', className)}>
        {icon}
        {copied ? 'Copied' : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={!url}
      className={cn('icon-btn icon-btn-sm', className)}
      aria-label={copied ? 'Link copied' : label}
      title={copied ? 'Link copied' : label}
    >
      {icon}
    </button>
  );
}
