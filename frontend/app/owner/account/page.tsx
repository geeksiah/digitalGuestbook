'use client';

import { useState, useEffect } from 'react';
import { ownerAuthApi, ownerDashboardApi } from '@/lib/api';
import { useOwnerAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

export default function OwnerAccountPage() {
  const { owner, setAuth } = useOwnerAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'wallet'>('profile');
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);

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

  // Wallet form
  const [walletData, setWalletData] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    routingNumber: '',
    swiftCode: '',
    mobileProvider: '',
    mobileNumber: '',
    paypalEmail: '',
    preferredMethod: 'bank' as 'bank' | 'mobile' | 'paypal' | 'stripe' | 'paystack',
    currency: 'USD',
    autoPayoutEnabled: false,
    autoPayoutThreshold: 100,
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
    fetchWallet();
  }, [owner]);

  const fetchWallet = async () => {
    try {
      setWalletLoading(true);
      const response = await ownerDashboardApi.getWallet();
      if (response.data.wallet) {
        setWalletData({
          bankName: response.data.wallet.bankName || '',
          accountName: response.data.wallet.accountName || '',
          accountNumber: response.data.wallet.accountNumber || '',
          routingNumber: response.data.wallet.routingNumber || '',
          swiftCode: response.data.wallet.swiftCode || '',
          mobileProvider: response.data.wallet.mobileProvider || '',
          mobileNumber: response.data.wallet.mobileNumber || '',
          paypalEmail: response.data.wallet.paypalEmail || '',
          preferredMethod: response.data.wallet.preferredMethod || 'bank',
          currency: response.data.wallet.currency || 'USD',
          autoPayoutEnabled: response.data.wallet.autoPayoutEnabled || false,
          autoPayoutThreshold: response.data.wallet.autoPayoutThreshold || 100,
        });
      }
    } catch (error: any) {
      // Wallet might not exist yet, that's okay
      if (error.response?.status !== 404) {
        console.error('Failed to load wallet:', error);
      }
    } finally {
      setWalletLoading(false);
    }
  };

  const handleWalletUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await ownerDashboardApi.updateWallet(walletData);
      toast.success('Wallet settings updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update wallet settings');
    } finally {
      setLoading(false);
    }
  };

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
          <button
            onClick={() => setActiveTab('wallet')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'wallet'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
              }
            `}
          >
            Wallet & Payouts
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

      {/* Wallet Tab */}
      {activeTab === 'wallet' && (
        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-6">Wallet & Payout Settings</h2>
          <p className="text-sm text-surface-600 mb-6">
            Configure your payout method to receive payments from your events.
          </p>
          
          {walletLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900 mx-auto" />
            </div>
          ) : (
            <form onSubmit={handleWalletUpdate} className="space-y-6">
              {/* Preferred Method */}
              <div>
                <label className="label">Preferred Payout Method *</label>
                <select
                  className="input"
                  value={walletData.preferredMethod}
                  onChange={(e) => setWalletData({ ...walletData, preferredMethod: e.target.value as any })}
                  required
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="mobile">Mobile Money</option>
                  <option value="paypal">PayPal</option>
                  <option value="stripe">Stripe</option>
                  <option value="paystack">Paystack</option>
                </select>
              </div>

              {/* Bank Details */}
              {walletData.preferredMethod === 'bank' && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Bank Name</label>
                      <input
                        type="text"
                        className="input"
                        value={walletData.bankName}
                        onChange={(e) => setWalletData({ ...walletData, bankName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Account Name</label>
                      <input
                        type="text"
                        className="input"
                        value={walletData.accountName}
                        onChange={(e) => setWalletData({ ...walletData, accountName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Account Number</label>
                      <input
                        type="text"
                        className="input"
                        value={walletData.accountNumber}
                        onChange={(e) => setWalletData({ ...walletData, accountNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Routing Number (US) / SWIFT Code</label>
                      <input
                        type="text"
                        className="input"
                        value={walletData.routingNumber || walletData.swiftCode}
                        onChange={(e) => {
                          if (walletData.routingNumber) {
                            setWalletData({ ...walletData, routingNumber: e.target.value });
                          } else {
                            setWalletData({ ...walletData, swiftCode: e.target.value });
                          }
                        }}
                        placeholder="Routing number or SWIFT code"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Mobile Money */}
              {walletData.preferredMethod === 'mobile' && (
                <>
                  <div>
                    <label className="label">Mobile Provider</label>
                    <select
                      className="input"
                      value={walletData.mobileProvider}
                      onChange={(e) => setWalletData({ ...walletData, mobileProvider: e.target.value })}
                    >
                      <option value="">Select provider</option>
                      <option value="mpesa">M-Pesa</option>
                      <option value="mtn">MTN Mobile Money</option>
                      <option value="airtel">Airtel Money</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Mobile Number</label>
                    <input
                      type="tel"
                      className="input"
                      value={walletData.mobileNumber}
                      onChange={(e) => setWalletData({ ...walletData, mobileNumber: e.target.value })}
                      placeholder="+1234567890"
                    />
                  </div>
                </>
              )}

              {/* PayPal */}
              {walletData.preferredMethod === 'paypal' && (
                <div>
                  <label className="label">PayPal Email</label>
                  <input
                    type="email"
                    className="input"
                    value={walletData.paypalEmail}
                    onChange={(e) => setWalletData({ ...walletData, paypalEmail: e.target.value })}
                    placeholder="your@paypal.com"
                  />
                </div>
              )}

              {/* Currency */}
              <div>
                <label className="label">Currency</label>
                <select
                  className="input"
                  value={walletData.currency}
                  onChange={(e) => setWalletData({ ...walletData, currency: e.target.value })}
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="GHS">GHS - Ghanaian Cedi</option>
                  <option value="KES">KES - Kenyan Shilling</option>
                  <option value="NGN">NGN - Nigerian Naira</option>
                </select>
              </div>

              {/* Auto Payout Settings */}
              <div className="border-t border-surface-200 pt-6">
                <h3 className="text-md font-semibold text-navy-900 mb-4">Auto Payout Settings</h3>
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="autoPayout"
                    checked={walletData.autoPayoutEnabled}
                    onChange={(e) => setWalletData({ ...walletData, autoPayoutEnabled: e.target.checked })}
                    className="h-4 w-4 text-navy-600 focus:ring-navy-500 border-surface-300 rounded"
                  />
                  <label htmlFor="autoPayout" className="ml-2 block text-sm text-surface-900">
                    Enable automatic payouts
                  </label>
                </div>
                {walletData.autoPayoutEnabled && (
                  <div>
                    <label className="label">Auto Payout Threshold</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={walletData.autoPayoutThreshold}
                      onChange={(e) => setWalletData({ ...walletData, autoPayoutThreshold: parseFloat(e.target.value) || 0 })}
                      placeholder="100"
                    />
                    <p className="text-xs text-surface-500 mt-1">
                      Automatically process payouts when balance reaches this amount
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Saving...' : 'Save Wallet Settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

