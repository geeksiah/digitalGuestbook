'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ownersApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function NewOwnerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    countryCode: 'US',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await ownersApi.create({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        company: formData.company || undefined,
        countryCode: formData.countryCode,
      });
      toast.success('Owner created successfully');
      router.push('/admin/owners');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create owner');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/owners"
          className="text-surface-600 hover:text-navy-900 inline-flex items-center mb-4"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Owners
        </Link>
        <h1 className="text-2xl font-bold text-navy-900">New Owner</h1>
        <p className="text-surface-600 mt-1">Create a new owner or client account</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border border-surface-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="label">
              Name *
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

          <div>
            <label htmlFor="email" className="label">
              Email *
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Phone
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
              Company
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

          <div>
            <label htmlFor="countryCode" className="label">
              Country
            </label>
            <select
              id="countryCode"
              className="input"
              value={formData.countryCode}
              onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
            >
              <option value="US">United States (US)</option>
              <option value="GB">United Kingdom (GB)</option>
              <option value="GH">Ghana (GH)</option>
              <option value="NG">Nigeria (NG)</option>
              <option value="KE">Kenya (KE)</option>
              <option value="ZA">South Africa (ZA)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Link href="/admin/owners" className="btn-secondary flex-1 text-center">
              Cancel
            </Link>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Owner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

