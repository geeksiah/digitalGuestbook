'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ownerAuthApi } from '@/lib/api';
import { useOwnerAuthStore } from '@/lib/store';
import { getErrorMessage } from '@/lib/utils';
import { SubmitButton } from '@/components/ui/Primitives';

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
      const errorMessage = getErrorMessage(error, 'That did not work. Try again.');

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
          <h1 className="text-xl font-bold tracking-tight text-brand-900">{pageTitle}</h1>
          <p className="mt-1 meta">{pageSubtitle}</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
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
                      className="input pr-16"
                      placeholder="********"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-[13px] font-semibold text-surface-600 transition-colors hover:text-brand-900"
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

              <SubmitButton type="submit" loading={loading} className="btn-primary btn-block">
                {submitLabel}
              </SubmitButton>
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
        </div>
      </div>
    </div>
  );
}
