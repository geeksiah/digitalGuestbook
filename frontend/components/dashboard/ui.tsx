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
    <div className={cn('flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-in', className)}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">Control Center</p>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-brand-900 mt-1 tracking-tight">{title}</h1>
        {subtitle ? <p className="text-surface-500 mt-1.5">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
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
    <section className={cn('bg-white rounded-xl border border-surface-200/80 shadow-soft overflow-hidden animate-in', className)}>
      {(title || subtitle || action) ? (
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-surface-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-50/70">
          <div>
            {title ? <h2 className="text-lg font-semibold text-brand-900">{title}</h2> : null}
            {subtitle ? <p className="text-sm text-surface-500 mt-1">{subtitle}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('p-4 sm:p-6', contentClassName)}>{children}</div>
    </section>
  );
}

export function DashboardKpiCard({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'emerald' | 'blue' | 'violet' | 'rose';
}) {
  const toneClass = {
    neutral: 'bg-surface-100 text-surface-600',
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
    rose: 'bg-rose-100 text-rose-700',
  }[tone];

  return (
    <div className="group bg-white rounded-xl border border-surface-200/80 shadow-soft p-4 sm:p-5 hover:border-brand-200 hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500 mb-2">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-brand-900 leading-none tracking-tight">{value}</p>
        </div>
        {icon ? (
          <div className={cn('w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-[1.03]', toneClass)}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
