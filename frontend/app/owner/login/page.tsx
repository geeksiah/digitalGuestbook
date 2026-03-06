'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ownerAuthApi } from '@/lib/api';
import { useOwnerAuthStore } from '@/lib/store';

export default function OwnerLoginPage() {
  const router = useRouter();
  const { setAuth } = useOwnerAuthStore();
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [isSetupPassword, setIsSetupPassword] = useState(false);
  const [isRequestReset, setIsRequestReset] = useState(false);
  const [setupEmail, setSetupEmail] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    company: '',
  });

  const pageTitle = isRequestReset
    ? 'Request reset'
    : isSetupPassword
      ? 'Set password'
      : isRegister
        ? 'Create owner account'
        : 'Owner sign in';

  const pageSubtitle = isRequestReset
    ? 'Submit a reset request for review.'
    : isSetupPassword
      ? 'Finish setup to continue.'
      : isRegister
        ? 'Create your account to manage events.'
        : 'Access your event workspace.';

  const submitLabel = isRequestReset
    ? 'Submit request'
    : isSetupPassword
      ? 'Set password'
      : isRegister
        ? 'Create account'
        : 'Sign in';

  const loadingLabel = isRequestReset
    ? 'Submitting...'
    : isSetupPassword
      ? 'Setting password...'
      : isRegister
        ? 'Creating account...'
        : 'Signing in...';

  const resetModeState = () => {
    setIsRegister(false);
    setIsSetupPassword(false);
    setIsRequestReset(false);
    setSetupEmail('');
    setResetReason('');
    setShowPassword(false);
    setFormData({ name: '', email: '', password: '', phone: '', company: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRequestReset) {
        await ownerAuthApi.requestPasswordReset(setupEmail, resetReason);
        toast.success('Password reset request submitted.');
        resetModeState();
      } else if (isSetupPassword) {
        const response = await ownerAuthApi.setupPassword(setupEmail, formData.password);
        const { token, owner } = response.data;
        setAuth(token, owner);
        toast.success(`Password set. Welcome, ${owner.name}!`);
        router.push('/owner');
      } else if (isRegister) {
        const response = await ownerAuthApi.register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone || undefined,
          company: formData.company || undefined,
        });

        const { token, owner } = response.data;
        setAuth(token, owner);
        toast.success(`Welcome, ${owner.name}!`);
        router.push('/owner');
      } else {
        const response = await ownerAuthApi.login(formData.email, formData.password);
        const { token, owner } = response.data;

        setAuth(token, owner);
        toast.success(`Welcome back, ${owner.name}!`);
        router.push('/owner');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Request failed';

      if (errorMessage.includes('Account was created by admin') || errorMessage.includes('set up your password')) {
        setIsSetupPassword(true);
        setIsRegister(false);
        setIsRequestReset(false);
        setSetupEmail(formData.email);
        setFormData({ ...formData, password: '' });
        toast.error('Set your password to continue.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen soft-grid-bg px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-screen max-w-md items-center">
        <section className="app-shell-panel w-full p-6 sm:p-8">
          <Link href="/" className="inline-flex items-center text-sm text-surface-600 transition-colors hover:text-brand-900">
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>

          <div className="mt-6 rounded-3xl bg-surface-50 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">EventPeepo</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand-900">{pageTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-surface-600">{pageSubtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {isRequestReset && (
                <>
                  <div>
                    <label htmlFor="reset-email" className="label">Email</label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      className="input"
                      placeholder="owner@example.com"
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="reset-reason" className="label">Reason (optional)</label>
                    <textarea
                      id="reset-reason"
                      className="input"
                      rows={3}
                      placeholder="Brief context..."
                      value={resetReason}
                      onChange={(e) => setResetReason(e.target.value)}
                    />
                  </div>
                </>
              )}

              {!isRequestReset && isSetupPassword && (
                <div>
                  <label htmlFor="setup-email" className="label">Account email</label>
                  <input id="setup-email" type="email" disabled className="input bg-surface-100" value={setupEmail} readOnly />
                </div>
              )}

              {!isRequestReset && isRegister && !isSetupPassword && (
                <div>
                  <label htmlFor="name" className="label">Full name</label>
                  <input
                    id="name"
                    type="text"
                    required
                    className="input"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              )}

              {!isRequestReset && !isSetupPassword && (
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="input"
                    placeholder="owner@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              )}

              {!isRequestReset && (
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
              )}

              {!isRequestReset && isRegister && !isSetupPassword && (
                <>
                  <div>
                    <label htmlFor="phone" className="label">Phone (optional)</label>
                    <input
                      id="phone"
                      type="tel"
                      className="input"
                      placeholder="+1 555 123 4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label htmlFor="company" className="label">Organization (optional)</label>
                    <input
                      id="company"
                      type="text"
                      className="input"
                      placeholder="Acme Events"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>
                </>
              )}

              <button type="submit" disabled={loading} className="btn-accent w-full">
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="-ml-1 mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {loadingLabel}
                  </span>
                ) : (
                  submitLabel
                )}
              </button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            {!isRequestReset && !isSetupPassword && (
              <button
                type="button"
                onClick={() => {
                  setIsRegister((prev) => !prev);
                  setIsRequestReset(false);
                  setFormData({ name: '', email: '', password: '', phone: '', company: '' });
                  setShowPassword(false);
                }}
                className="text-sm text-surface-600 transition-colors hover:text-brand-900"
              >
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            )}

            {!isRegister && !isSetupPassword && (
              <button
                type="button"
                onClick={() => {
                  setIsRequestReset((prev) => !prev);
                  setIsRegister(false);
                  setFormData({ name: '', email: '', password: '', phone: '', company: '' });
                  setSetupEmail('');
                  setResetReason('');
                  setShowPassword(false);
                }}
                className="text-sm text-surface-600 transition-colors hover:text-brand-900"
              >
                {isRequestReset ? 'Back to sign in' : 'Forgot password?'}
              </button>
            )}

            {isSetupPassword && (
              <button type="button" onClick={resetModeState} className="text-sm text-surface-600 transition-colors hover:text-brand-900">
                Back to sign in
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
