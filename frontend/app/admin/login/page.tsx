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
    <div className="min-h-screen bg-surface-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-16 w-[420px] h-[420px] rounded-full bg-brand-900/8 blur-3xl" />
        <div className="absolute -bottom-20 -right-10 w-[360px] h-[360px] rounded-full bg-brand-800/10 blur-3xl" />
      </div>

      <div className="relative min-h-screen mx-auto max-w-6xl flex items-center px-4 py-8 sm:px-8">
        <div className="w-full grid lg:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch">
          <section className="hidden lg:flex rounded-3xl border border-surface-200 bg-white shadow-soft p-8 xl:p-10 flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-3">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-brand-900 text-white font-bold">E</span>
                <span className="font-semibold text-brand-900 text-lg">EventPeepo Admin</span>
              </div>
              <h2 className="mt-8 text-4xl font-display font-bold text-brand-900 leading-tight">
                Run Every Event
                <br />
                from One Control Room
              </h2>
              <p className="mt-4 text-surface-600 max-w-md">
                Monitor activity, moderate submissions, assign templates, and keep operations smooth across all events.
              </p>
            </div>

            <div className="space-y-3">
              {[
                'Event lifecycle and phase controls',
                'Guestbook moderation and media governance',
                'Template, payout, and owner management',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <span className="mt-0.5 inline-flex w-5 h-5 items-center justify-center rounded-full bg-brand-900 text-white text-[10px] font-bold">?</span>
                  <span className="text-sm text-surface-700">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 sm:p-8">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-surface-600 hover:text-brand-900 transition-colors group"
            >
              <svg className="w-4 h-4 mr-2 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>

            <div className="mt-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-900 text-white shadow-lg">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="mt-4 text-3xl font-display font-bold text-brand-900">Admin Sign In</h1>
              <p className="mt-1 text-surface-600">Use your admin credentials to access system controls.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="label">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    className="input pl-10"
                    placeholder="admin@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m6 4H6a2 2 0 01-2-2v-6a2 2 0 012-2h12a2 2 0 012 2v6a2 2 0 01-2 2zM8 11V7a4 4 0 118 0v4" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="input pl-10 pr-12"
                    placeholder="********"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-surface-500 hover:text-brand-900 transition-colors"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
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

            <p className="mt-6 text-sm text-surface-600 text-center">
              Need access support?{' '}
              <a href="mailto:support@eventpeepo.com" className="font-semibold text-brand-900 hover:text-brand-700 transition-colors">
                Contact Support
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
