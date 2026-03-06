'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AppShellBreadcrumb, AppShellSidebar, AppShellTopbar } from '@/components/ui/AppShell';

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    name: 'Events',
    href: '/admin/events',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    name: 'Owners',
    href: '/admin/owners',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    name: 'Templates',
    href: '/admin/templates',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
  },
  {
    name: 'Sales',
    href: '/admin/sales',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
  },
  {
    name: 'Payouts',
    href: '/admin/payouts',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  },
  {
    name: 'Payment Gateways',
    href: '/admin/payment-gateways',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  },
  {
    name: 'USSD',
    href: '/admin/ussd',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h8M8 14h5M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H9l-5 3V6a2 2 0 012-2z" /></svg>,
  },
  {
    name: 'Notifications',
    href: '/admin/notifications',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9" /></svg>,
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, setAuth, clearAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/admin/login') {
      setIsVerifying(false);
      return;
    }
    
    // Verify token on mount and periodically
    const verifyAuth = async () => {
      const token = localStorage.getItem('admin_token');
      if (!token || token === 'null' || token === 'undefined') {
        if (pathname !== '/admin/login') {
          router.push('/admin/login');
        }
        setIsVerifying(false);
        return;
      }

      try {
        const response = await authApi.verify();
        // Update auth state with fresh token and admin data
        setAuth(token, response.data.admin);
        setIsVerifying(false);
      } catch (error: any) {
        // Only clear and redirect if it's actually an auth error
        if (error.response?.status === 401) {
          localStorage.removeItem('admin_token');
          clearAuth();
          if (pathname !== '/admin/login') {
            router.push('/admin/login');
          }
        }
        setIsVerifying(false);
      }
    };

    // Initial verification
    verifyAuth();

    // Set up periodic token verification (every 5 minutes) to keep session alive
    const verifyInterval = setInterval(() => {
      const token = localStorage.getItem('admin_token');
      if (token && token !== 'null' && token !== 'undefined') {
        authApi.verify().then((response) => {
          setAuth(token, response.data.admin);
        }).catch((error) => {
          // Only clear if it's a 401 (unauthorized)
          if (error.response?.status === 401) {
            localStorage.removeItem('admin_token');
            clearAuth();
            if (pathname !== '/admin/login') {
              router.push('/admin/login');
            }
          }
        });
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(verifyInterval);
    };
  }, [pathname, router, setAuth, clearAuth]);

  // Don't show layout on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Show loading while verifying
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900" />
      </div>
    );
  }

  const handleLogout = () => {
    clearAuth();
    router.push('/admin/login');
  };

  const currentSection = navigation.find((item) => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)))?.name || 'Dashboard';

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <AppShellSidebar
        brandHref="/admin"
        navItems={navigation}
        pathname={pathname}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        footer={(
          <div className="app-shell-panel p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-100">
                <span className="text-sm font-semibold text-brand-900">{admin?.name?.charAt(0).toUpperCase() || 'A'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-900">{admin?.name || 'Admin'}</p>
                <p className="truncate text-xs text-surface-500">{admin?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-xl p-2 text-surface-500 transition-colors hover:bg-white hover:text-brand-900"
                title="Sign out"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        )}
      />

      {/* Main content */}
      <div className="lg:pl-[284px]">
        <AppShellTopbar
          title={currentSection}
          onOpenSidebar={() => setSidebarOpen(true)}
          breadcrumb={(
            <AppShellBreadcrumb
              items={[
                { label: 'Admin Workspace', href: '/admin' },
                { label: currentSection },
              ]}
            />
          )}
          actions={(
            <>
              <Link href="/admin/events/new" className="btn-primary">
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New Event</span>
                <span className="sm:hidden">New</span>
              </Link>
              <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-brand-100 text-sm font-semibold text-brand-900 sm:flex">
                {admin?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
            </>
          )}
        />

        {/* Page content */}
        <main className="mx-auto max-w-[1680px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
