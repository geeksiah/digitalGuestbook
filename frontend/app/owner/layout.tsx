'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useOwnerAuthStore } from '@/lib/store';
import { ownerAuthApi, ownerDashboardApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AppShellBreadcrumb, AppShellSidebar, AppShellTopbar } from '@/components/ui/AppShell';

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

      <AppShellSidebar
        brandHref="/owner"
        navItems={navigation}
        pathname={pathname}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        footer={(
          <div className="space-y-2">
            <div className="app-shell-panel p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-100">
                  <span className="font-semibold text-brand-900">{owner?.name?.charAt(0).toUpperCase() || 'O'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-brand-900">{owner?.name}</p>
                  <p className="truncate text-xs text-surface-500">{owner?.email}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-outline w-full justify-start"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      />

      {/* Main content */}
      <div className="min-h-screen flex flex-col lg:pl-[284px]">
        <AppShellTopbar
          title={currentSection}
          onOpenSidebar={() => setSidebarOpen(true)}
          breadcrumb={(
            <AppShellBreadcrumb
              items={[
                { label: 'Owner Workspace', href: '/owner' },
                { label: currentSection },
              ]}
            />
          )}
          leading={(
            <div className="flex min-w-0 flex-col items-start gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-400">Current event</span>
              <select
                value={selectedEventId || '__all__'}
                onChange={(e) => handleEventSwitch(e.target.value)}
                disabled={loadingEvents || ownerEvents.length === 0}
                className="input h-11 min-w-[260px] py-0"
              >
                <option value="__all__">All events</option>
                {ownerEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        />

        {/* Page content */}
        <main className="mx-auto flex-1 max-w-[1680px] p-4 pb-28 sm:p-6 sm:pb-32 lg:p-8 lg:pb-8">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-200 bg-white shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-4 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            {navigation.map((item) => {
              const isActive = isNavActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-colors active:opacity-80',
                    isActive
                      ? 'text-primary-700 bg-primary-50 ring-1 ring-primary-200'
                      : 'text-surface-500'
                  )}
                >
                  <span className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl transition-all [&>svg]:w-6 [&>svg]:h-6',
                    isActive ? 'text-primary-700' : 'text-surface-500'
                  )}>
                    {item.icon}
                  </span>
                  <span className={cn(
                    'text-[11px] font-medium leading-none',
                    isActive ? 'font-semibold text-primary-700' : 'text-surface-500'
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

