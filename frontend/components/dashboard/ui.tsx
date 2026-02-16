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
    <div className={cn('flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 animate-in', className)}>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Control Center</p>
        <h1 className="text-lg sm:text-2xl font-display font-bold text-brand-900 mt-0.5 tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-surface-500 mt-1 leading-relaxed">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2 flex-shrink-0">{action}</div> : null}
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
        <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-surface-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-surface-50/50">
          <div className="min-w-0">
            {title ? <h2 className="text-base sm:text-lg font-semibold text-brand-900">{title}</h2> : null}
            {subtitle ? <p className="text-xs sm:text-sm text-surface-500 mt-0.5 leading-relaxed">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex-shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('p-4 sm:p-5', contentClassName)}>{children}</div>
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
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
  }[tone];

  return (
    <div className="bg-white rounded-xl border border-surface-200/80 shadow-soft p-4 sm:p-5 hover:border-brand-200 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-surface-400 mb-1.5">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-brand-900 leading-none tracking-tight">{value}</p>
        </div>
        {icon ? (
          <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0', toneClass)}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
