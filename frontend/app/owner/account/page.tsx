'use client';

import { useState, useEffect } from 'react';
import { ownerAuthApi } from '@/lib/api';
import { useOwnerAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

export default function OwnerAccountPage() {
  const { owner, setAuth } = useOwnerAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [loading, setLoading] = useState(false);

  // Profile form
  const [profileData, setProfileData] = useState({
    name: owner?.name || '',
    email: owner?.email || '',
    phone: owner?.phone || '',
    company: owner?.company || '',
  });

  // Password form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (owner) {
      setProfileData({
        name: owner.name || '',
        email: owner.email || '',
        phone: owner.phone || '',
        company: owner.company || '',
      });
    }
  }, [owner]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('owner_token');
      const response = await ownerAuthApi.updateProfile({
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone || undefined,
        company: profileData.company || undefined,
      });

      // Update auth store with new owner data
      if (token) {
        setAuth(token, response.data.owner);
      }
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await ownerAuthApi.changePassword(passwordData.currentPassword, passwordData.newPassword);
      toast.success('Password changed successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Account Settings</h1>
        <p className="text-surface-600 mt-1">Manage your account information and security</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'profile'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
              }
            `}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'password'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
              }
            `}
          >
            Change Password
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-6">Profile Information</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-5">
            <div>
              <label htmlFor="name" className="label">
                Full Name *
              </label>
              <input
                id="name"
                type="text"
                required
                className="input"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email Address *
              </label>
              <input
                id="email"
                type="email"
                required
                className="input"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="phone" className="label">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                className="input"
                placeholder="+1 (555) 123-4567"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
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
                value={profileData.company}
                onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-6">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div>
              <label htmlFor="currentPassword" className="label">
                Current Password *
              </label>
              <input
                id="currentPassword"
                type="password"
                required
                className="input"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="label">
                New Password *
              </label>
              <input
                id="newPassword"
                type="password"
                required
                className="input"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              />
              <p className="text-sm text-surface-500 mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm New Password *
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                className="input"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

