'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getErrorMessage } from '@/lib/utils';
import { SubmitButton } from '@/components/ui/Primitives';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await authApi.login(formData.email, formData.password);
      const { token, admin } = response.data;
      setAuth(token, admin);
      toast.success(`Welcome back, ${admin.name}`);
      router.push('/admin');
    } catch (err: any) {
      // Never say which half was wrong.
      setError(
        err?.response?.status === 401
          ? 'That email and password do not match.'
          : getErrorMessage(err, 'Could not sign you in.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 rounded text-[13px] font-medium text-surface-600 transition-colors hover:text-brand-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
          </svg>
          Home
        </Link>

        <div className="panel p-5 sm:p-6">
          <h1 className="text-xl font-bold tracking-tight text-brand-900">Sign in</h1>
          <p className="mt-1 meta">EventPeepo admin</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            {error ? (
              <div className="banner-error" role="alert">
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                className={error ? 'input input-error' : 'input'}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className={error ? 'input input-error pr-16' : 'input pr-16'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-[13px] font-semibold text-surface-600 transition-colors hover:text-brand-900"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <SubmitButton type="submit" loading={loading} className="btn-primary btn-block">
              Sign in
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
