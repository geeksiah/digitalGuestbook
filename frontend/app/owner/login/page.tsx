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
    ? 'Request Password Reset'
    : isSetupPassword
      ? 'Set Your Password'
      : isRegister
        ? 'Create Owner Account'
        : 'Owner Sign In';

  const pageSubtitle = isRequestReset
    ? 'Submit a reset request for admin review.'
    : isSetupPassword
      ? 'Complete your first-time password setup.'
      : isRegister
        ? 'Register to manage your assigned events.'
        : 'Sign in to manage RSVPs, media, tickets, and payouts.';

  const submitLabel = isRequestReset
    ? 'Submit Request'
    : isSetupPassword
      ? 'Set Password'
      : isRegister
        ? 'Create Account'
        : 'Sign In';

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
        toast.success('Password reset request submitted. Admin review is required before reset.');
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
        toast.error('Please set your password to continue.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-12 w-[420px] h-[420px] rounded-full bg-brand-900/8 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-[360px] h-[360px] rounded-full bg-brand-700/10 blur-3xl" />
      </div>

      <div className="relative min-h-screen mx-auto max-w-6xl flex items-center px-4 py-8 sm:px-8">
        <div className="w-full grid lg:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch">
          <section className="hidden lg:flex rounded-3xl border border-surface-200 bg-white shadow-soft p-8 xl:p-10 flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-3">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-brand-900 text-white font-bold">E</span>
                <span className="font-semibold text-brand-900 text-lg">EventPeepo Owner</span>
              </div>
              <h2 className="mt-8 text-4xl font-display font-bold text-brand-900 leading-tight">
                Manage Your Event
                <br />
                Operations in Real Time
              </h2>
              <p className="mt-4 text-surface-600 max-w-md">
                Handle RSVP approvals, guestbook media, ticket performance, itinerary updates, domains, and payout requests in one place.
              </p>
            </div>

            <div className="space-y-3">
              {[
                'Approve or reject incoming RSVP responses',
                'Review guestbook uploads and moderate content',
                'Track ticket sales and submit payout requests',
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h1 className="mt-4 text-3xl font-display font-bold text-brand-900">{pageTitle}</h1>
              <p className="mt-1 text-surface-600">{pageSubtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              {isRequestReset && (
                <>
                  <div>
                    <label htmlFor="reset-email" className="label">Email Address</label>
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
                    <label htmlFor="reset-reason" className="label">Reason (Optional)</label>
                    <textarea
                      id="reset-reason"
                      className="input"
                      rows={3}
                      placeholder="Share context for your reset request..."
                      value={resetReason}
                      onChange={(e) => setResetReason(e.target.value)}
                    />
                    <p className="text-xs text-surface-500 mt-1">
                      Reset requests are reviewed by an administrator before approval.
                    </p>
                  </div>
                </>
              )}

              {!isRequestReset && isSetupPassword && (
                <div>
                  <label htmlFor="setup-email" className="label">Account Email</label>
                  <input
                    id="setup-email"
                    type="email"
                    disabled
                    className="input bg-surface-50"
                    value={setupEmail}
                    readOnly
                  />
                  <p className="text-xs text-surface-500 mt-1">
                    This account was created by admin. Set your password to continue.
                  </p>
                </div>
              )}

              {!isRequestReset && isRegister && !isSetupPassword && (
                <div>
                  <label htmlFor="name" className="label">Full Name</label>
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
                  <label htmlFor="email" className="label">Email Address</label>
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
                      className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-surface-500 hover:text-brand-900 transition-colors"
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
                    <label htmlFor="phone" className="label">Phone (Optional)</label>
                    <input
                      id="phone"
                      type="tel"
                      className="input"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label htmlFor="company" className="label">Organization (Optional)</label>
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

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
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
                  className="text-sm text-surface-600 hover:text-brand-900 transition-colors"
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
                  className="text-sm text-surface-600 hover:text-brand-900 transition-colors"
                >
                  {isRequestReset ? 'Back to login' : 'Forgot password? Request reset'}
                </button>
              )}

              {isSetupPassword && (
                <button
                  type="button"
                  onClick={resetModeState}
                  className="text-sm text-surface-600 hover:text-brand-900 transition-colors"
                >
                  Back to login
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
