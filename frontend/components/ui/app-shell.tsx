import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function AppShellSidebar({
  brand,
  navigation,
  pathname,
  sidebarOpen,
  onClose,
  footer,
}: {
  brand: ReactNode;
  navigation: Array<{ name: string; href: string; icon: ReactNode }>;
  pathname: string;
  sidebarOpen: boolean;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <>
      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 bg-brand-950/35 backdrop-blur-sm lg:hidden" onClick={onClose} />
      ) : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[288px] border-r border-surface-200 bg-white/95 backdrop-blur-xl shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-[76px] items-center justify-between border-b border-surface-100 px-6">
            <div className="min-w-0">{brand}</div>
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

          <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== pathname && pathname.startsWith(item.href) && item.href !== '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-medium transition-all',
                    isActive
                      ? 'border-brand-100 bg-brand-50 text-brand-900 shadow-[0_8px_24px_rgba(6,57,50,0.08)]'
                      : 'border-transparent text-surface-700 hover:border-surface-200 hover:bg-surface-50 hover:text-brand-900'
                  )}
                >
                  <span className={cn(isActive ? 'text-brand-700' : 'text-surface-400')}>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {footer ? <div className="border-t border-surface-100 p-4">{footer}</div> : null}
        </div>
      </aside>
    </>
  );
}

export function AppShellBreadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="hidden items-center gap-2 text-sm md:flex">
      {items.map((item, index) => (
        <div key={`${item.label}:${index}`} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="text-surface-500 transition-colors hover:text-brand-900">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-brand-900">{item.label}</span>
          )}
          {index < items.length - 1 ? <span className="text-surface-300">/</span> : null}
        </div>
      ))}
    </div>
  );
}

export function AppShellQuickActions({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export function AppShellTopbar({
  title,
  breadcrumb,
  onOpenSidebar,
  center,
  actions,
}: {
  title: string;
  breadcrumb?: ReactNode;
  onOpenSidebar: () => void;
  center?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="rounded-xl p-2.5 text-surface-600 transition-colors hover:bg-surface-100 hover:text-brand-900 lg:hidden"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            {breadcrumb}
            <p className="truncate text-sm font-semibold text-brand-900 md:hidden">{title}</p>
          </div>
          {center ? <div className="hidden lg:block">{center}</div> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {center ? <div className="border-t border-surface-100 px-4 py-3 lg:hidden sm:px-6">{center}</div> : null}
    </header>
  );
}

export function AppShellSectionNav({
  items,
  active,
  onChange,
}: {
  items: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="subtle-toolbar overflow-x-auto">
      <div className="page-tabs min-w-max">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn('page-tab', active === item.id && 'page-tab-active')}
          >
            <span>{item.label}</span>
            {item.count !== undefined ? (
              <span className={cn('rounded-full px-2 py-0.5 text-[11px]', active === item.id ? 'bg-brand-50 text-brand-800' : 'bg-surface-100 text-surface-500')}>
                {item.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
