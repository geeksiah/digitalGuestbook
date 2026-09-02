'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { AppShell, isNavActive, type NavItem } from '@/components/ui/AppShell';
import { PageSkeleton } from '@/components/ui/Primitives';
import {
  Bell,
  Building2,
  Calendar,
  CreditCard,
  LayoutDashboard,
  LayoutTemplate,
  MessageSquareText,
  Settings,
  ShoppingBag,
  Wallet,
} from '@/components/ui/icons';

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  { name: 'Events', href: '/admin/events', icon: Calendar },
  { name: 'Owners', href: '/admin/owners', icon: Building2 },
  { name: 'Sales', href: '/admin/sales', icon: ShoppingBag },
  { name: 'Templates', href: '/admin/templates', icon: LayoutTemplate },
  { name: 'Payouts', href: '/admin/payouts', icon: Wallet },
  { name: 'Payment gateways', href: '/admin/payment-gateways', icon: CreditCard },
  { name: 'USSD', href: '/admin/ussd', icon: MessageSquareText },
  { name: 'Notifications', href: '/admin/notifications', icon: Bell },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

// The four destinations an admin actually returns to on a phone.
const mobilePrimary = ['/admin', '/admin/events', '/admin/owners', '/admin/sales'];
const bottomNav = mobilePrimary
  .map((href) => navigation.find((item) => item.href === href))
  .filter(Boolean) as NavItem[];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, setAuth, clearAuth } = useAuthStore();
  const [isVerifying, setIsVerifying] = useState(true);

  const isLoginRoute = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginRoute) {
      setIsVerifying(false);
      return;
    }

    let cancelled = false;

    const readToken = () => {
      const token = localStorage.getItem('admin_token');
      return token && token !== 'null' && token !== 'undefined' ? token : null;
    };

    const verifyAuth = async () => {
      const token = readToken();
      if (!token) {
        router.push('/admin/login');
        if (!cancelled) setIsVerifying(false);
        return;
      }

      try {
        const response = await authApi.verify();
        if (!cancelled) {
          setAuth(token, response.data.admin);
          setIsVerifying(false);
        }
      } catch (error: any) {
        // Only a rejected token ends the session; transient failures keep it.
        if (error?.response?.status === 401) {
          localStorage.removeItem('admin_token');
          clearAuth();
          router.push('/admin/login');
        }
        if (!cancelled) setIsVerifying(false);
      }
    };

    void verifyAuth();

    // Keep the session warm while the tab stays open.
    const interval = setInterval(() => {
      const token = readToken();
      if (!token) return;
      authApi
        .verify()
        .then((response) => setAuth(token, response.data.admin))
        .catch((error: any) => {
          if (error?.response?.status === 401) {
            localStorage.removeItem('admin_token');
            clearAuth();
            router.push('/admin/login');
          }
        });
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isLoginRoute, router, setAuth, clearAuth]);

  const handleSignOut = useCallback(() => {
    clearAuth();
    router.push('/admin/login');
  }, [clearAuth, router]);

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
      brandHref="/admin"
      nav={navigation}
      bottomNav={bottomNav}
      sectionLabel={section}
      account={{ name: admin?.name || 'Admin', email: admin?.email, href: '/admin/settings' }}
      onSignOut={handleSignOut}
    >
      {children}
    </AppShell>
  );
}
