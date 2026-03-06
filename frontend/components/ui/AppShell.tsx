import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type AppShellNavItem = {
  name: string;
  href: string;
  icon: ReactNode;
};

export function AppShellBreadcrumb({
  items,
  className,
}: {
  items: Array<{ label: string; href?: string }>;
  className?: string;
}) {
  return (
    <nav className={cn('hidden min-w-0 items-center gap-2 text-sm text-surface-500 lg:flex', className)} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="truncate transition-colors hover:text-brand-900">
              {item.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-brand-900">{item.label}</span>
          )}
          {index < items.length - 1 ? <span className="text-surface-300">/</span> : null}
        </div>
      ))}
    </nav>
  );
}

export function AppShellSidebar({
  brandHref,
  navItems,
  pathname,
  sidebarOpen,
  onClose,
  footer,
}: {
  brandHref: string;
  navItems: AppShellNavItem[];
  pathname: string;
  sidebarOpen: boolean;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const isActive = (href: string) => pathname === href || (href !== brandHref && pathname.startsWith(href));

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 w-[284px] border-r border-surface-200/80 bg-white/95 backdrop-blur-xl shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-transform duration-300 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-surface-200/70 px-6 py-6">
          <div className="flex items-start justify-between gap-3">
            <Link href={brandHref} className="flex min-w-0 items-center gap-3">
              <img
                src="/img/logo-dark.svg"
                alt="EventPeepo"
                className="h-9 w-auto shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.app-shell-logo-fallback');
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              <div className="app-shell-logo-fallback hidden items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-900 text-sm font-bold text-white">E</div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-surface-400">Workspace</p>
                  <p className="text-lg font-semibold tracking-tight text-brand-900">EventPeepo</p>
                </div>
              </div>
            </Link>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-surface-500 transition-colors hover:bg-surface-100 hover:text-brand-900 lg:hidden"
              aria-label="Close menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-4 px-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-surface-400">Navigation</p>
          </div>
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'app-shell-nav-item',
                    active ? 'app-shell-nav-item-active' : 'app-shell-nav-item-inactive'
                  )}
                >
                  <span className={cn('shrink-0', active ? 'text-brand-900' : 'text-surface-400')}>{item.icon}</span>
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {footer ? <div className="border-t border-surface-200/70 p-4">{footer}</div> : null}
      </div>
    </aside>
  );
}

export function AppShellTopbar({
  title,
  breadcrumb,
  onOpenSidebar,
  actions,
  leading,
}: {
  title: string;
  breadcrumb?: ReactNode;
  onOpenSidebar: () => void;
  actions?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-200/80 bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          className="rounded-xl p-2 text-surface-600 transition-colors hover:bg-surface-100 hover:text-brand-900 lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold tracking-tight text-brand-900 lg:hidden">{title}</p>
          {breadcrumb}
        </div>

        {leading ? <div className="hidden items-center gap-3 lg:flex">{leading}</div> : null}
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function AppShellSectionNav({
  items,
  className,
}: {
  items: Array<{ label: string; active?: boolean; onClick?: () => void }>;
  className?: string;
}) {
  return (
    <div className={cn('page-tabs overflow-x-auto scrollbar-hide', className)}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className={cn('page-tabs-item', item.active && 'page-tabs-item-active')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function AppShellQuickActions({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="action-list-card">
      <div className="mb-4">
        <h3 className="text-base font-semibold tracking-tight text-brand-900">{title}</h3>
        {description ? <p className="mt-1 text-sm text-surface-500">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
