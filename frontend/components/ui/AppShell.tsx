'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppBarSlotContext } from './app-bar-context';
import { ChevronsUpDown, LogOut, MoreHorizontal } from './icons';
import { Menu, MenuItem, MenuLabel, MenuSeparator, Modal } from './Overlay';
import { Avatar } from './Primitives';

/* ==========================================================================
   Application shell.

   Desktop  a two column grid: a sticky, compact sidebar and the content
            column. No fixed-position panel, no padding offset, so content
            starts immediately beside the navigation.
   Mobile   a native pattern: slim top app bar (title + page action supplied
            by the page), and a bottom tab bar with a More sheet for the
            secondary destinations. Never the desktop sidebar in a drawer.
   ========================================================================== */

export type NavIcon = (props: { className?: string; strokeWidth?: number }) => ReactNode;

export type NavItem = {
  name: string;
  href: string;
  icon: NavIcon;
  /** Match this href exactly instead of by prefix (used for section roots). */
  exact?: boolean;
};

export function isNavActive(pathname: string, item: Pick<NavItem, 'href' | 'exact'>) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}


type Account = {
  name?: string | null;
  email?: string | null;
  href?: string;
};

export function AppShell({
  brandHref,
  nav,
  bottomNav,
  account,
  onSignOut,
  sectionLabel,
  contextSwitcher,
  children,
}: {
  brandHref: string;
  nav: NavItem[];
  /** Up to five primary destinations for the mobile tab bar. */
  bottomNav: NavItem[];
  account: Account;
  onSignOut: () => void;
  /** Fallback title for the mobile app bar. */
  sectionLabel: string;
  /** Optional workspace/event switcher rendered under the sidebar brand. */
  contextSwitcher?: ReactNode;
  children: ReactNode;
}) {
  const [barSlot, setBarSlot] = useState<HTMLDivElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const secondary = nav.filter((item) => !bottomNav.some((entry) => entry.href === item.href));
  const hasMore = secondary.length > 0;

  // The account link only earns a slot in the sheet when it is not already nav.
  const showAccountInSheet = Boolean(account.href) && !nav.some((item) => item.href === account.href);

  return (
    <AppBarSlotContext.Provider value={barSlot}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-brand-900 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <div className="min-h-screen bg-surface-100 lg:grid lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
        <Sidebar
          brandHref={brandHref}
          nav={nav}
          account={account}
          onSignOut={onSignOut}
          contextSwitcher={contextSwitcher}
        />

        <div className="flex min-w-0 flex-col">
          {/* Mobile top app bar */}
          <header className="sticky top-0 z-30 border-b border-surface-200 bg-white/95 backdrop-blur-xl lg:hidden">
            <div className="flex min-h-[52px] items-center gap-1 px-2">
              <div ref={setBarSlot} className="ep-bar-slot flex min-w-0 flex-1 items-center gap-1" />
              <div className="ep-bar-fallback min-w-0 flex-1 items-center px-2">
                <span className="truncate text-[15px] font-semibold text-brand-900">{sectionLabel}</span>
              </div>
              <AccountControl account={account} onSignOut={onSignOut} />
            </div>
          </header>

          <main id="main" className="min-w-0 flex-1 px-4 py-4 pb-bottom-nav sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>

          {/* Mobile tab bar */}
          <nav className="bottom-nav" aria-label="Primary">
            <div
              className="grid px-1 pt-0.5"
              style={{ gridTemplateColumns: `repeat(${bottomNav.length + (hasMore ? 1 : 0)}, minmax(0, 1fr))` }}
            >
              {bottomNav.map((item) => (
                <BottomNavLink key={item.href} item={item} />
              ))}
              {hasMore ? (
                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className="bottom-nav-item"
                  aria-haspopup="dialog"
                  aria-expanded={moreOpen}
                >
                  <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
                  <span>More</span>
                </button>
              ) : null}
            </div>
          </nav>

          {hasMore ? (
            <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" size="sm" bodyClassName="px-2 py-2">
              <div className="space-y-0.5">
                {secondary.map((item) => (
                  <MoreSheetLink key={item.href} item={item} onNavigate={() => setMoreOpen(false)} />
                ))}
                <div className="menu-sep" />
                {showAccountInSheet && account.href ? (
                  <MoreSheetLink
                    item={{ name: 'Account', href: account.href, icon: () => null }}
                    onNavigate={() => setMoreOpen(false)}
                  />
                ) : null}
                <button
                  type="button"
                  className="menu-item-danger"
                  onClick={() => {
                    setMoreOpen(false);
                    onSignOut();
                  }}
                >
                  <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </Modal>
          ) : null}
        </div>
      </div>
    </AppBarSlotContext.Provider>
  );
}

/* ================================================================ sidebar */

function Sidebar({
  brandHref,
  nav,
  account,
  onSignOut,
  contextSwitcher,
}: {
  brandHref: string;
  nav: NavItem[];
  account: Account;
  onSignOut: () => void;
  contextSwitcher?: ReactNode;
}) {
  return (
    <aside className="hidden border-r border-surface-200 bg-white lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-14 shrink-0 items-center px-4">
          <Link href={brandHref} className="flex min-w-0 items-center gap-2 rounded-lg" aria-label="EventPeepo home">
            <BrandMark />
          </Link>
        </div>

        {contextSwitcher ? <div className="px-3 pb-2">{contextSwitcher}</div> : null}

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3" aria-label="Sections">
          {nav.map((item) => (
            <SidebarLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="shrink-0 border-t border-surface-200 p-2">
          <AccountRow account={account} onSignOut={onSignOut} />
        </div>
      </div>
    </aside>
  );
}

function BrandMark() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-900 text-[13px] font-bold text-white">
          E
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-brand-900">EventPeepo</span>
      </span>
    );
  }
  return <img src="/img/logo-dark.svg" alt="EventPeepo" className="h-7 w-auto" onError={() => setFailed(true)} />;
}

function SidebarLink({ item }: { item: NavItem }) {
  const pathname = useCurrentPath();
  const active = isNavActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn('app-shell-nav-item', active ? 'app-shell-nav-item-active' : 'app-shell-nav-item-inactive')}
    >
      <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-brand-800' : 'text-surface-500')} strokeWidth={1.75} />
      <span className="truncate">{item.name}</span>
    </Link>
  );
}

function BottomNavLink({ item }: { item: NavItem }) {
  const pathname = useCurrentPath();
  const active = isNavActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn('bottom-nav-item', active && 'bottom-nav-item-active')}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
      <span className="max-w-full truncate">{item.name}</span>
    </Link>
  );
}

function MoreSheetLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = useCurrentPath();
  const active = isNavActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn('menu-item min-h-[46px]', active && 'bg-brand-50 font-semibold text-brand-900')}
    >
      <Icon className="h-[18px] w-[18px] shrink-0 text-surface-500" strokeWidth={1.75} aria-hidden="true" />
      {item.name}
    </Link>
  );
}

/* ================================================================ account */

function AccountRow({ account, onSignOut }: { account: Account; onSignOut: () => void }) {
  return (
    <Menu
      align="start"
      label="Account menu"
      className="w-full rounded-lg p-2 text-left transition-colors hover:bg-surface-100"
      trigger={
        <span className="flex w-full min-w-0 items-center gap-2.5">
          <Avatar name={account.name || 'A'} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-brand-900">{account.name || 'Account'}</span>
            {account.email ? (
              <span className="block truncate text-[12px] text-surface-600">{account.email}</span>
            ) : null}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-surface-500" strokeWidth={1.75} aria-hidden="true" />
        </span>
      }
    >
      <MenuLabel>{account.email || 'Signed in'}</MenuLabel>
      {account.href ? <MenuItem href={account.href}>Account settings</MenuItem> : null}
      <MenuSeparator />
      <MenuItem danger onClick={onSignOut} icon={<LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />}>
        Sign out
      </MenuItem>
    </Menu>
  );
}

function AccountControl({ account, onSignOut }: { account: Account; onSignOut: () => void }) {
  return (
    <Menu
      align="end"
      label="Account"
      sheetTitle={account.name || 'Account'}
      className="icon-btn shrink-0"
      trigger={<Avatar name={account.name || 'A'} size="sm" />}
    >
      <MenuLabel>{account.email || 'Signed in'}</MenuLabel>
      {account.href ? <MenuItem href={account.href}>Account settings</MenuItem> : null}
      <MenuSeparator />
      <MenuItem danger onClick={onSignOut} icon={<LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />}>
        Sign out
      </MenuItem>
    </Menu>
  );
}

/* =========================================================== switcher UI */

/**
 * Workspace-level record switcher (owner's current event). Compact, keyboard
 * accessible, and degrades to a bottom sheet on small screens.
 */
export function ContextSwitcher({
  label,
  value,
  options,
  onSelect,
  allLabel,
  onSelectAll,
  disabled,
}: {
  label: string;
  value?: string;
  options: Array<{ id: string; name: string }>;
  onSelect: (id: string) => void;
  allLabel: string;
  onSelectAll: () => void;
  disabled?: boolean;
}) {
  const current = options.find((option) => option.id === value);
  return (
    <Menu
      align="start"
      label={label}
      sheetTitle={label}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-lg border border-surface-300 bg-white px-2.5 py-2 text-left transition-colors hover:border-surface-400',
        disabled && 'pointer-events-none opacity-60'
      )}
      trigger={
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-brand-900">
            {current?.name || allLabel}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-surface-500" strokeWidth={1.75} aria-hidden="true" />
        </span>
      }
    >
      <MenuItem onClick={onSelectAll}>{allLabel}</MenuItem>
      {options.length ? <MenuSeparator /> : null}
      {options.map((option) => (
        <MenuItem key={option.id} onClick={() => onSelect(option.id)}>
          {option.name}
        </MenuItem>
      ))}
    </Menu>
  );
}

/* ================================================================= utils */

function useCurrentPath() {
  return usePathname() || '';
}
