'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { cn } from '@/lib/utils';

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
    <div className="min-h-screen soft-grid-bg">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-brand-950/45 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-[272px] shell-sidebar transform transition-transform duration-300 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-surface-200">
            <Link href="/admin" className="flex items-center space-x-3 min-w-0">
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
              <div className="logo-fallback hidden items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-brand-900 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">E</span>
                </div>
                <span className="font-semibold text-brand-900 text-lg truncate">EventPeepo</span>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg text-surface-500 hover:bg-surface-100 hover:text-brand-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn('nav-pill', isActive && 'nav-pill-active')}
                >
                  <span className={cn(isActive ? 'text-brand-700' : 'text-surface-400')}>{item.icon}</span>
                  <span className="ml-3 font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-surface-200/70">
            <div className="flex items-center rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5">
              <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center">
                <span className="text-brand-900 font-semibold text-sm">
                  {admin?.name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-900 truncate">{admin?.name || 'Admin'}</p>
                <p className="text-xs text-surface-500 truncate">{admin?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-surface-500 hover:text-brand-900 hover:bg-white rounded-lg transition-colors"
                title="Sign out"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-[272px] min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6 lg:px-8">
          <div className="shell-main-surface flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 gap-3">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 -ml-2 text-surface-500 hover:text-brand-900 hover:bg-surface-100 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex-1 min-w-0 ml-2 lg:ml-0 flex items-center gap-3">
              <div className="hidden xl:flex items-center gap-2 text-sm">
                <span className="chip-brand">Admin Console</span>
                <span className="text-surface-300">/</span>
                <span className="font-semibold text-brand-900 truncate">{currentSection}</span>
              </div>
              <div className="hidden md:flex items-center w-full max-w-[520px]">
                <div className="relative w-full">
                  <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.8 5.8a7.5 7.5 0 0010.85 10.85z" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search events, templates, owners..."
                    className="h-10 w-full rounded-full border border-surface-200 bg-surface-50 pl-9 pr-4 text-sm text-brand-900 placeholder:text-surface-400 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex items-center space-x-2 shrink-0">
              <Link href="/admin/events/new" className="btn-accent">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Event
              </Link>
              <button className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-full border border-surface-200 bg-surface-50 text-surface-600 hover:bg-white hover:text-brand-900 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V4a2 2 0 10-4 0v1.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                </svg>
              </button>
              <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-brand-100 text-brand-900 text-sm font-semibold">
                {admin?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-28 lg:p-7 lg:pb-7">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-200 bg-white shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-5 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            {navigation.slice(0, 5).map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-colors active:opacity-80',
                    isActive
                      ? 'text-[#ff3b30] bg-[#fff3f1] ring-1 ring-[#ffd6d2]'
                      : 'text-surface-500'
                  )}
                >
                  <span className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl transition-all [&>svg]:w-6 [&>svg]:h-6',
                    isActive ? 'text-[#ff3b30]' : 'text-surface-500'
                  )}>
                    {item.icon}
                  </span>
                  <span className={cn(
                    'text-[11px] font-medium leading-none',
                    isActive ? 'font-semibold text-[#ff3b30]' : 'text-surface-500'
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
