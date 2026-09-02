'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useOwnerAuthStore } from '@/lib/store';
import { ownerAuthApi, ownerDashboardApi } from '@/lib/api';
import { AppShell, ContextSwitcher, isNavActive, type NavItem } from '@/components/ui/AppShell';
import { PageSkeleton } from '@/components/ui/Primitives';
import { Calendar, LayoutDashboard, User, Wallet } from '@/components/ui/icons';

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/owner', icon: LayoutDashboard, exact: true },
  { name: 'Events', href: '/owner/events', icon: Calendar },
  { name: 'Payouts', href: '/owner/payouts', icon: Wallet },
  { name: 'Account', href: '/owner/account', icon: User },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { owner, setAuth, clearAuth } = useOwnerAuthStore();
  const [isVerifying, setIsVerifying] = useState(true);
  const [ownerEvents, setOwnerEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);

  const isLoginRoute = pathname === '/owner/login';

  useEffect(() => {
    if (isLoginRoute) {
      setIsVerifying(false);
      return;
    }

    let cancelled = false;

    const readToken = () => {
      const token = localStorage.getItem('owner_token');
      return token && token !== 'null' && token !== 'undefined' ? token : null;
    };

    const verifyAuth = async () => {
      const token = readToken();
      if (!token) {
        router.push('/owner/login');
        if (!cancelled) setIsVerifying(false);
        return;
      }

      try {
        const response = await ownerAuthApi.getMe();
        if (!cancelled) {
          setAuth(token, response.data.owner);
          setIsVerifying(false);
        }
      } catch (error: any) {
        if (error?.response?.status === 401) {
          localStorage.removeItem('owner_token');
          clearAuth();
          router.push('/owner/login');
        }
        if (!cancelled) setIsVerifying(false);
      }
    };

    void verifyAuth();

    const interval = setInterval(() => {
      const token = readToken();
      if (!token) return;
      ownerAuthApi
        .getMe()
        .then((response: any) => setAuth(token, response.data.owner))
        .catch((error: any) => {
          if (error?.response?.status === 401) {
            localStorage.removeItem('owner_token');
            clearAuth();
            router.push('/owner/login');
          }
        });
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isLoginRoute, router, setAuth, clearAuth]);

  // Load the switcher's options once the session is known to be valid.
  useEffect(() => {
    if (isLoginRoute || isVerifying) return;

    let cancelled = false;
    const fetchOwnerEvents = async () => {
      try {
        setLoadingEvents(true);
        const response = await ownerDashboardApi.getEvents();
        const events = Array.isArray(response.data?.events) ? response.data.events : [];
        if (cancelled) return;
        setOwnerEvents(events.map((event: any) => ({ id: event.id, name: event.name })));
      } catch {
        // The switcher is a convenience: the rest of the shell stays usable.
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    };

    void fetchOwnerEvents();
    return () => {
      cancelled = true;
    };
  }, [isLoginRoute, isVerifying]);

  // The URL is the source of truth for which event is in context.
  useEffect(() => {
    if (isLoginRoute) return;
    const pathEventId = pathname.match(/^\/owner\/events\/([^/]+)/)?.[1];
    if (pathEventId) {
      setSelectedEventId(pathEventId);
      localStorage.setItem('owner_selected_event_id', pathEventId);
      return;
    }
    setSelectedEventId('');
  }, [pathname, isLoginRoute]);

  const handleSignOut = useCallback(() => {
    clearAuth();
    router.push('/owner/login');
  }, [clearAuth, router]);

  const handleEventSelect = useCallback(
    (eventId: string) => {
      localStorage.setItem('owner_selected_event_id', eventId);
      router.push(`/owner/events/${eventId}`);
    },
    [router]
  );

  if (isLoginRoute) return <>{children}</>;

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-surface-100 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1440px]">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  const section = navigation.find((item) => isNavActive(pathname, item))?.name || 'Dashboard';

  return (
    <AppShell
      brandHref="/owner"
      nav={navigation}
      bottomNav={navigation}
      sectionLabel={section}
      account={{ name: owner?.name, email: owner?.email, href: '/owner/account' }}
      onSignOut={handleSignOut}
      contextSwitcher={
        ownerEvents.length > 0 ? (
          <ContextSwitcher
            label="Current event"
            value={selectedEventId}
            options={ownerEvents}
            onSelect={handleEventSelect}
            allLabel="All events"
            onSelectAll={() => router.push('/owner/events')}
            disabled={loadingEvents}
          />
        ) : null
      }
    >
      {children}
    </AppShell>
  );
}
