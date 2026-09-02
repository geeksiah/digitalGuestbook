'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ownersApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/utils';
import { PageHeader, Panel, SubmitButton } from '@/components/ui/Primitives';

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'GH', name: 'Ghana' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'ZA', name: 'South Africa' },
];

export default function NewOwnerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    countryCode: 'US',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setFormError(null);

    try {
      await ownersApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        countryCode: form.countryCode,
      });
      toast.success('Owner created');
      router.push('/admin/owners');
    } catch (error) {
      // Values stay on screen so nothing typed is lost.
      setFormError(getErrorMessage(error, 'Could not create this owner.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page mx-auto max-w-2xl">
      <PageHeader title="New owner" backHref="/admin/owners" backLabel="Owners" />

      <Panel>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError ? (
            <div className="banner-error" role="alert">
              {formError}
            </div>
          ) : null}

          <div>
            <label htmlFor="name" className="label">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              autoFocus
              className="input"
              placeholder="Ama Serwaa"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="ama@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <p className="field-hint">A welcome email with sign-in details goes to this address.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className="label">
                Phone <span className="font-normal text-surface-600">(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="company" className="label">
                Company <span className="font-normal text-surface-600">(optional)</span>
              </label>
              <input
                id="company"
                type="text"
                className="input"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="countryCode" className="label">
              Country
            </label>
            <select
              id="countryCode"
              className="input"
              value={form.countryCode}
              onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <p className="field-hint">Sets the default payout options available to this owner.</p>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-surface-200 pt-4 sm:flex-row sm:justify-end">
            <Link href="/admin/owners" className="btn-outline">
              Cancel
            </Link>
            <SubmitButton type="submit" loading={loading} disabled={!form.name.trim() || !form.email.trim()}>
              Create owner
            </SubmitButton>
          </div>
        </form>
      </Panel>
    </div>
  );
}
