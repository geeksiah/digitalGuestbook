'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useOwnerAuthStore } from '@/lib/store';
import { ownerAuthApi } from '@/lib/api';
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
    name: 'Account',
    href: '/owner/account',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, owner, setAuth, clearAuth } = useOwnerAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

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
        ownerAuthApi.getMe().then((response) => {
          setAuth(token, response.data.owner);
        }).catch((error) => {
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

  // Don't show layout on login page
  if (pathname === '/owner/login') {
    return <>{children}</>;
  }

  // Show loading while verifying
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    );
  }

  const handleLogout = () => {
    clearAuth();
    router.push('/owner/login');
  };

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-surface-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-surface-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="ml-3 text-lg font-semibold text-navy-900">Owner Portal</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-surface-400 hover:text-surface-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/owner' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-navy-900 text-white'
                      : 'text-surface-700 hover:bg-surface-100 hover:text-navy-900'
                  )}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-surface-200">
            <div className="flex items-center px-3 py-2">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center">
                <span className="text-navy-700 font-medium">
                  {owner?.name?.charAt(0).toUpperCase() || 'O'}
                </span>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-navy-900 truncate">{owner?.name}</p>
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
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-surface-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-surface-400 hover:text-surface-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex-1" />
            <div className="flex items-center">
              <div className="flex items-center text-sm text-surface-600">
                <span className="hidden sm:inline">{owner?.name}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

