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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    company: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRequestReset) {
        await ownerAuthApi.requestPasswordReset(setupEmail, resetReason);
        toast.success('Password reset request submitted. An admin will review your request and notify you once approved.');
        setIsRequestReset(false);
        setSetupEmail('');
        setResetReason('');
        setFormData({ ...formData, email: '', password: '' });
      } else if (isSetupPassword) {
        const response = await ownerAuthApi.setupPassword(setupEmail, formData.password);
        const { token, owner } = response.data;
        setAuth(token, owner);
        toast.success(`Password set successfully! Welcome, ${owner.name}!`);
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
      const errorMessage = error.response?.data?.error || 'Failed';
      
      // Check if this is a "password not set" error
      if (errorMessage.includes('Account was created by admin') || errorMessage.includes('set up your password')) {
        setIsSetupPassword(true);
        setSetupEmail(formData.email);
        setFormData({ ...formData, password: '' });
        toast.error('Please set up your password to continue');
      } else {
        toast.error(errorMessage || (isRegister ? 'Registration failed' : isSetupPassword ? 'Password setup failed' : 'Login failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-primary-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center text-surface-400 hover:text-white transition-colors mb-8"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <div className="bg-white rounded-2xl shadow-elegant p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary-500/20 mb-4">
              <svg className="w-7 h-7 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-display font-bold text-navy-900">
              {isRequestReset ? 'Request Password Reset' : isRegister ? 'Create Account' : 'Owner Portal'}
            </h1>
            <p className="text-surface-600 mt-1">
              {isRequestReset ? 'Submit a request for admin approval' : isRegister ? 'Sign up to manage your events' : 'Sign in to manage your events'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRequestReset && (
              <>
                <div>
                  <label htmlFor="reset-email" className="label">
                    Email Address *
                  </label>
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
                  <label htmlFor="reset-reason" className="label">
                    Reason (Optional)
                  </label>
                  <textarea
                    id="reset-reason"
                    className="input"
                    rows={3}
                    placeholder="Please explain why you need to reset your password..."
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                  />
                  <p className="text-xs text-surface-500 mt-1">
                    Your request will be reviewed by an administrator. You'll be notified once it's approved or rejected.
                  </p>
                </div>
              </>
            )}
            {isSetupPassword && (
              <div>
                <label htmlFor="setup-email" className="label">
                  Email
                </label>
                <input
                  id="setup-email"
                  type="email"
                  required
                  disabled
                  className="input bg-surface-50"
                  value={setupEmail}
                  readOnly
                />
                <p className="text-xs text-surface-500 mt-1">
                  Your account was created by an admin. Please set your password to continue.
                </p>
              </div>
            )}
            {isRegister && !isSetupPassword && (
              <div>
                <label htmlFor="name" className="label">
                  Full Name *
                </label>
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

            {!isRequestReset && (
              <>
                <div>
                  <label htmlFor="email" className="label">
                    Email Address *
                  </label>
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

                <div>
                  <label htmlFor="password" className="label">
                    Password *
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    className="input"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </>
            )}

            {isRegister && (
              <>
                <div>
                  <label htmlFor="phone" className="label">
                    Phone (Optional)
                  </label>
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
                  <label htmlFor="company" className="label">
                    Company (Optional)
                  </label>
                  <input
                    id="company"
                    type="text"
                    className="input"
                    placeholder="Acme Corporation"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isRequestReset ? 'Submitting...' : isRegister ? 'Creating...' : 'Signing in...'}
                </span>
              ) : (
                isRequestReset ? 'Submit Request' : isRegister ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            {!isRequestReset && (
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setFormData({ name: '', email: '', password: '', phone: '', company: '' });
                }}
                className="text-sm text-surface-600 hover:text-navy-900 block"
              >
                {isRegister
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            )}
            {!isRegister && !isSetupPassword && (
              <button
                type="button"
                onClick={() => {
                  setIsRequestReset(!isRequestReset);
                  setFormData({ name: '', email: '', password: '', phone: '', company: '' });
                  setSetupEmail('');
                  setResetReason('');
                }}
                className="text-sm text-surface-600 hover:text-navy-900 block"
              >
                {isRequestReset
                  ? 'Back to login'
                  : 'Forgot password? Request reset'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

