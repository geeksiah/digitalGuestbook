'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useOwnerAuthStore } from '@/lib/store';
import { ownerAuthApi, ownerDashboardApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const navigation = [
  {
    name: 'Dashboard',
    href: '/owner',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    name: 'Events',
    href: '/owner/events',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    name: 'Payouts',
    href: '/owner/payouts',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  },
  {
    name: 'Account',
    href: '/owner/account',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { owner, setAuth, clearAuth } = useOwnerAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [ownerEvents, setOwnerEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/owner/login') {
      setIsVerifying(false);
      return;
    }
    
    // Verify token on mount and periodically
    const verifyAuth = async () => {
      const token = localStorage.getItem('owner_token');
      if (!token || token === 'null' || token === 'undefined') {
        if (pathname !== '/owner/login') {
          router.push('/owner/login');
        }
        setIsVerifying(false);
        return;
      }

      try {
        const response = await ownerAuthApi.getMe();
        // Update auth state with fresh owner data
        setAuth(token, response.data.owner);
        setIsVerifying(false);
      } catch (error: any) {
        // Only clear if it's actually an auth error
        if (error.response?.status === 401) {
          localStorage.removeItem('owner_token');
          clearAuth();
          if (pathname !== '/owner/login') {
            router.push('/owner/login');
          }
        }
        setIsVerifying(false);
      }
    };

    // Initial verification
    verifyAuth();

    // Set up periodic token verification (every 5 minutes) to keep session alive
    const verifyInterval = setInterval(() => {
      const token = localStorage.getItem('owner_token');
      if (token && token !== 'null' && token !== 'undefined') {
        ownerAuthApi.getMe().then((response: any) => {
          setAuth(token, response.data.owner);
        }).catch((error: any) => {
          // Only clear if it's a 401 (unauthorized)
          if (error.response?.status === 401) {
            localStorage.removeItem('owner_token');
            clearAuth();
            if (pathname !== '/owner/login') {
              router.push('/owner/login');
            }
          }
        });
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(verifyInterval);
    };
  }, [pathname, router, setAuth, clearAuth]);

  useEffect(() => {
    if (pathname === '/owner/login' || isVerifying) return;

    const fetchOwnerEvents = async () => {
      try {
        setLoadingEvents(true);
        const response = await ownerDashboardApi.getEvents();
        const events = Array.isArray(response.data?.events) ? response.data.events : [];
        setOwnerEvents(events.map((event: any) => ({ id: event.id, name: event.name })));

        const pathMatch = pathname.match(/^\/owner\/events\/([^/]+)/);
        const pathEventId = pathMatch?.[1] || '';
        const storedEventId = localStorage.getItem('owner_selected_event_id') || '';

        const preferredEventId = pathEventId || storedEventId;
        const exists = events.some((event: any) => event.id === preferredEventId);
        const nextEventId = exists ? preferredEventId : (events[0]?.id || '');

        setSelectedEventId(nextEventId);
        if (nextEventId) {
          localStorage.setItem('owner_selected_event_id', nextEventId);
        }
      } catch {
        // Keep layout usable even if event list fails
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchOwnerEvents();
  }, [pathname, isVerifying]);

  useEffect(() => {
    if (pathname === '/owner/login') return;
    const pathMatch = pathname.match(/^\/owner\/events\/([^/]+)/);
    const pathEventId = pathMatch?.[1];
    if (pathEventId) {
      setSelectedEventId(pathEventId);
      localStorage.setItem('owner_selected_event_id', pathEventId);
    }
  }, [pathname]);

  // Don't show layout on login page
  if (pathname === '/owner/login') {
    return <>{children}</>;
  }

  // Show loading while verifying
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-surface-50 px-4 py-8">
        <div className="mx-auto max-w-md space-y-4 animate-pulse">
          <div className="h-5 w-40 rounded-lg bg-surface-200" />
          <div className="h-24 rounded-2xl bg-surface-200" />
          <div className="h-24 rounded-2xl bg-surface-200" />
          <div className="h-24 rounded-2xl bg-surface-200" />
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    clearAuth();
    router.push('/owner/login');
  };

  const handleEventSwitch = (eventId: string) => {
    if (eventId === '__all__') {
      router.push('/owner/events');
      return;
    }

    setSelectedEventId(eventId);
    localStorage.setItem('owner_selected_event_id', eventId);
    router.push(`/owner/events/${eventId}`);
  };

  const isNavActive = (href: string) => pathname === href || (href !== '/owner' && pathname.startsWith(href));
  const currentSection = navigation.find((item) => isNavActive(item.href))?.name || 'Dashboard';

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-brand-950/45 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[272px] bg-white border-r border-surface-200/80 shadow-soft transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-surface-200/70">
            <div className="flex items-center">
              <img 
                src="/img/logo-dark.svg" 
                alt="EventPeepo" 
                className="h-8 w-auto"
                onError={(e) => {
                  // Fallback to text if logo fails to load
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              <div className="logo-fallback hidden items-center ml-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-900 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">E</span>
                </div>
                <span className="ml-3 text-lg font-semibold text-brand-900">EventPeepo</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg text-surface-500 hover:bg-surface-100 hover:text-brand-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = isNavActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2.5 text-sm font-medium rounded-xl border transition-all',
                    isActive
                      ? 'bg-brand-50 text-brand-900 border-brand-100 shadow-sm'
                      : 'text-surface-700 border-transparent hover:bg-surface-50 hover:text-brand-900 hover:border-surface-200'
                  )}
                >
                  <span className={cn('mr-3', isActive ? 'text-brand-700' : 'text-surface-400')}>{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-surface-200/70">
            <div className="flex items-center px-3 py-2.5 rounded-xl border border-surface-200 bg-surface-50">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                <span className="text-brand-900 font-semibold">
                  {owner?.name?.charAt(0).toUpperCase() || 'O'}
                </span>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-900 truncate">{owner?.name}</p>
                <p className="text-xs text-surface-500 truncate">{owner?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full mt-2 flex items-center px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-[272px] min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-surface-200/80">
          <div className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6 lg:px-8 gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex-shrink-0 p-2.5 -ml-2 rounded-xl text-surface-600 hover:bg-surface-100 hover:text-brand-900 active:bg-surface-200 transition-colors"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="min-w-0 flex items-center gap-2 flex-1">
                <span className="hidden xl:inline-block flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest text-surface-400">
                  Event
                </span>
                <select
                  value={selectedEventId || '__all__'}
                  onChange={(e) => handleEventSwitch(e.target.value)}
                  disabled={loadingEvents || ownerEvents.length === 0}
                  className="h-9 sm:h-10 w-full max-w-[320px] rounded-lg border border-surface-200 bg-white px-3 text-sm font-medium text-brand-900 focus:border-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-900/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="__all__">All events</option>
                  {ownerEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-sm flex-shrink-0">
              <span className="text-surface-400 text-xs font-medium">Workspace</span>
              <span className="text-surface-300">/</span>
              <span className="font-semibold text-brand-900 truncate">{currentSection}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 pb-28 sm:p-6 sm:pb-32 lg:p-7 lg:pb-7">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-200/60 bg-white/95 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-4 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            {navigation.map((item) => {
              const isActive = isNavActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-colors active:opacity-70',
                    isActive
                      ? 'text-brand-900 bg-brand-50/60'
                      : 'text-surface-500'
                  )}
                >
                  <span className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl transition-all [&>svg]:w-[22px] [&>svg]:h-[22px]',
                    isActive ? 'text-brand-900' : 'text-surface-500'
                  )}>
                    {item.icon}
                  </span>
                  <span className={cn(
                    'text-[11px] font-medium leading-none',
                    isActive ? 'font-semibold text-brand-900' : 'text-surface-500'
                  )}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

