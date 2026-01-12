'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ownersApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  isActive: boolean;
  createdAt: string;
  eventCount?: number;
  wallet?: {
    id: string;
    preferredMethod: string;
    currency: string;
    isVerified: boolean;
    bankName?: string;
    accountName?: string;
    paypalEmail?: string;
    mobileProvider?: string;
    mobileNumber?: string;
  } | null;
}

const Icons = {
  plus: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  search: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  edit: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  user: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  building: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  mail: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  phone: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
};

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [passwordModalOwner, setPasswordModalOwner] = useState<Owner | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    fetchOwners();
  }, [search, filterActive]);

  const fetchOwners = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (filterActive !== undefined) params.isActive = filterActive;
      
      const response = await ownersApi.list(params);
      setOwners(response.data.owners);
    } catch (error) {
      toast.error('Failed to load owners');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (owner: Owner) => {
    setEditingOwner(owner);
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this owner? This will only work if they have no associated events.')) {
      return;
    }

    try {
      await ownersApi.delete(id);
      toast.success('Owner deleted');
      fetchOwners();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete owner');
    }
  };

  const handleResendWelcomeEmail = async (owner: Owner) => {
    try {
      await ownersApi.resendWelcomeEmail(owner.id);
      toast.success('Welcome email sent successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send email');
    }
  };

  if (showEditModal && editingOwner) {
    return (
      <EditOwnerModal
        owner={editingOwner}
        onClose={() => {
          setShowEditModal(false);
          setEditingOwner(null);
        }}
        onSave={() => {
          setShowEditModal(false);
          setEditingOwner(null);
          fetchOwners();
        }}
      />
    );
  }

  if (showPasswordModal && passwordModalOwner) {
    return (
      <PasswordManagementModal
        owner={passwordModalOwner}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordModalOwner(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Owners & Clients</h1>
          <p className="text-surface-600 mt-1">Manage event owners and clients</p>
        </div>
        <Link href="/admin/owners/new" className="btn-primary">
          {Icons.plus}
          <span className="ml-2">New Owner</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {Icons.search}
          </div>
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterActive(undefined)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filterActive === undefined
                ? 'bg-navy-900 text-white'
                : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilterActive(true)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filterActive === true
                ? 'bg-navy-900 text-white'
                : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
            )}
          >
            Active
          </button>
          <button
            onClick={() => setFilterActive(false)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filterActive === false
                ? 'bg-navy-900 text-white'
                : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
            )}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Owners List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900 mx-auto" />
        </div>
      ) : owners.length === 0 ? (
        <div className="text-center py-12 bg-surface-50 rounded-lg border-2 border-dashed border-surface-200">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-100 mb-4">
            {Icons.user}
          </div>
          <p className="text-surface-600">No owners found</p>
          <Link href="/admin/owners/new" className="btn-primary mt-4 inline-flex">
            {Icons.plus}
            <span className="ml-2">Create First Owner</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
          <table className="min-w-full divide-y divide-surface-200">
            <thead className="bg-surface-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">
                  Events
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-surface-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-surface-200">
              {owners.map((owner) => (
                <tr key={owner.id} className="hover:bg-surface-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-navy-100 flex items-center justify-center">
                        <span className="text-navy-700 font-medium">
                          {owner.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-navy-900">{owner.name}</div>
                        {owner.company && (
                          <div className="text-sm text-surface-500 flex items-center mt-0.5">
                            {Icons.building}
                            <span className="ml-1">{owner.company}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-surface-900 flex items-center">
                      {Icons.mail}
                      <span className="ml-2">{owner.email}</span>
                    </div>
                    {owner.phone && (
                      <div className="text-sm text-surface-500 flex items-center mt-1">
                        {Icons.phone}
                        <span className="ml-2">{owner.phone}</span>
                      </div>
                    )}
                    {owner.wallet && (
                      <div className="text-xs text-emerald-600 flex items-center mt-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="ml-1">Wallet: {owner.wallet.preferredMethod} {owner.wallet.isVerified ? '(Verified)' : '(Pending)'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-surface-900 font-medium">
                      {owner.eventCount || 0} event{owner.eventCount !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                        owner.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-surface-100 text-surface-600'
                      )}
                    >
                      {owner.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(owner)}
                        className="text-navy-600 hover:text-navy-900"
                        title="Edit"
                      >
                        {Icons.edit}
                      </button>
                      <button
                        onClick={() => {
                          setPasswordModalOwner(owner);
                          setShowPasswordModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="Password Management"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleResendWelcomeEmail(owner)}
                        className="text-emerald-600 hover:text-emerald-900"
                        title="Resend Welcome Email"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(owner.id)}
                        className="text-rose-600 hover:text-rose-900"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Edit Owner Modal Component
function EditOwnerModal({
  owner,
  onClose,
  onSave,
}: {
  owner: Owner;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: owner.name,
    email: owner.email,
    phone: owner.phone || '',
    company: owner.company || '',
    isActive: owner.isActive,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await ownersApi.update(owner.id, {
        ...formData,
        phone: formData.phone || undefined,
        company: formData.company || undefined,
      });
      toast.success('Owner updated');
      onSave();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update owner');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-navy-900 mb-4">Edit Owner</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              required
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              required
              className="input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              type="tel"
              className="input"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Company</label>
            <input
              type="text"
              className="input"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-navy-600 focus:ring-navy-500 border-surface-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-surface-900">
              Active
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Password Management Modal Component
function PasswordManagementModal({
  owner,
  onClose,
}: {
  owner: Owner;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await ownersApi.changePassword(owner.id, newPassword);
      toast.success('Password changed successfully');
      setNewPassword('');
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-navy-900 mb-4">Password Management</h2>
        <p className="text-sm text-surface-600 mb-4">Owner: {owner.name} ({owner.email})</p>
        
        <form onSubmit={handleChangePassword} className="space-y-4 mb-6">
          <div>
            <label className="label">New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>

        <div className="border-t border-surface-200 pt-4">
          <button
            onClick={onClose}
            className="btn-secondary w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

