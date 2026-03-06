import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DashboardPageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-surface-400">Workspace</p>
        <h1 className="mt-1 text-2xl font-display font-bold tracking-tight text-brand-900 sm:text-[2rem]">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function DashboardHeroHeader({
  eyebrow,
  title,
  subtitle,
  action,
  meta,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('app-hero', className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">{eyebrow}</p> : null}
          <h1 className="mt-1 text-3xl font-display font-bold tracking-tight text-brand-900 sm:text-[2.35rem]">{title}</h1>
          {subtitle ? <p className="mt-3 max-w-3xl text-sm leading-6 text-surface-600 sm:text-[15px]">{subtitle}</p> : null}
          {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </section>
  );
}

export function MetricStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}

export function DashboardSection({
  title,
  subtitle,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn('table-card', className)}>
      {title || subtitle || action ? (
        <div className="flex flex-col gap-3 border-b border-surface-200/80 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="min-w-0">
            {title ? <h2 className="text-lg font-semibold tracking-tight text-brand-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm leading-6 text-surface-500">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('p-5 sm:p-6', contentClassName)}>{children}</div>
    </section>
  );
}

export function DashboardKpiCard({
  label,
  value,
  icon,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'emerald' | 'blue' | 'violet' | 'rose';
  hint?: ReactNode;
}) {
  const toneClass = {
    neutral: 'bg-surface-100 text-surface-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
  }[tone];

  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">{label}</p>
          <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-brand-900 sm:text-[2rem]">{value}</p>
          {hint ? <div className="mt-3 text-sm text-surface-500">{hint}</div> : null}
        </div>
        {icon ? (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', toneClass)}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function QuickActionCard({
  title,
  description,
  icon,
  href,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  href?: string;
  action?: ReactNode;
  className?: string;
}) {
  const content = (
    <div className={cn('action-list-card transition-all hover:-translate-y-0.5 hover:border-brand-200', className)}>
      <div className="flex items-start gap-4">
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-900">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight text-brand-900">{title}</h3>
          {description ? <p className="mt-1 text-sm leading-6 text-surface-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }

  return content;
}

export function EntityListRow({
  media,
  title,
  subtitle,
  meta,
  stats,
  actions,
}: {
  media?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  stats?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-surface-200/80 bg-white p-4 transition-all hover:border-brand-200 hover:shadow-[0_12px_30px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {media}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold tracking-tight text-brand-900">{title}</div>
            {meta}
          </div>
          {subtitle ? <div className="mt-1.5 text-sm text-surface-500">{subtitle}</div> : null}
        </div>
      </div>
      {stats ? <div className="flex flex-wrap items-center gap-4 lg:justify-end">{stats}</div> : null}
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EntityGridCard({
  media,
  title,
  subtitle,
  children,
  footer,
}: {
  media?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article className="detail-card h-full">
      {media ? <div className="mb-4">{media}</div> : null}
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-brand-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-surface-500">{subtitle}</p> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      {footer ? <div className="mt-5">{footer}</div> : null}
    </article>
  );
}

export function InsightPanel({
  title,
  subtitle,
  children,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('detail-card', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-brand-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-surface-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SplitPanelLayout({
  main,
  side,
  className,
}: {
  main: ReactNode;
  side: ReactNode;
  className?: string;
}) {
  return <div className={cn('grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]', className)}>{main}{side}</div>;
}
