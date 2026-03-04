'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authApi.login(formData.email, formData.password);
      const { token, admin } = response.data;

      setAuth(token, admin);
      toast.success(`Welcome back, ${admin.name}!`);
      router.push('/admin');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f6]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative overflow-hidden rounded-[28px] border border-surface-200 bg-white">
            <div className="relative h-[260px] sm:h-[320px]">
              <img
                src="/og-app-eventpeepo.png"
                alt="EventPeepo admin workspace"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 sm:bottom-7 sm:left-7 sm:right-7">
                <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur">
                  Admin Console
                </p>
                <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                  Run every event from one clean command center.
                </h2>
              </div>
            </div>

            <div className="grid gap-2 border-t border-surface-100 p-5 sm:grid-cols-3 sm:p-6">
              {['Events & owners', 'Templates & media', 'Sales & payouts'].map((item) => (
                <div key={item} className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm font-medium text-surface-700">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-surface-200 bg-white p-6 shadow-soft sm:p-8">
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-surface-600 transition-colors hover:text-brand-900"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to home
            </Link>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">EventPeepo</p>
              <h1 className="mt-2 text-3xl font-bold text-brand-900">Admin sign in</h1>
              <p className="mt-1 text-sm text-surface-600">Use your admin credentials to access controls.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  className="input"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="input pr-12"
                    placeholder="********"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-surface-500 transition-colors hover:text-brand-900"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-accent w-full">
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="-ml-1 mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-surface-600">
              Need access support?{' '}
              <a href="mailto:support@eventpeepo.com" className="font-semibold text-brand-900 transition-colors hover:text-brand-700">
                Contact support
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
