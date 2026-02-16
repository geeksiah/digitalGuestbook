'use client';

import { useState, useEffect } from 'react';
import { ownerAuthApi, ownerDashboardApi } from '@/lib/api';
import { useOwnerAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { DashboardPageHeader } from '@/components/dashboard/ui';
import { cn } from '@/lib/utils';

interface PaystackBank {
  code: string;
  name: string;
  currency?: string;
  country?: string;
}

export default function OwnerAccountPage() {
  const { owner, setAuth } = useOwnerAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'wallet' | 'notifications' | 'support'>('profile');
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [paystackLoading, setPaystackLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [paystackBanks, setPaystackBanks] = useState<PaystackBank[]>([]);

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
    paystackSubaccount: '',
    preferredMethod: 'bank' as 'bank' | 'mobile' | 'paypal' | 'stripe' | 'paystack',
    currency: 'USD',
    autoPayoutEnabled: false,
    autoPayoutThreshold: 100,
  });
  const [paystackSetup, setPaystackSetup] = useState({
    country: 'ghana',
    currency: 'GHS',
    bankCode: '',
    accountNumber: '',
    businessName: '',
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    notificationsEnabled: true,
    marketingEnabled: true,
    soundEnabled: true,
    hapticsEnabled: true,
  });
  const [supportContent, setSupportContent] = useState<{
    supportEmail: string | null;
    supportWhatsAppNumber: string | null;
    faq: Array<{ question: string; answer: string }>;
  }>({
    supportEmail: null,
    supportWhatsAppNumber: null,
    faq: [],
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
    fetchNotificationPreferences();
    fetchSupportContent();
  }, [owner]);

  useEffect(() => {
    if (activeTab !== 'wallet') return;
    fetchPaystackBanks(paystackSetup.country, paystackSetup.currency, false);
  }, [activeTab]);

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
          paystackSubaccount: response.data.wallet.paystackSubaccount || '',
          preferredMethod: response.data.wallet.preferredMethod || 'bank',
          currency: response.data.wallet.currency || 'USD',
          autoPayoutEnabled: response.data.wallet.autoPayoutEnabled || false,
          autoPayoutThreshold: response.data.wallet.autoPayoutThreshold || 100,
        });
        if (response.data.wallet.preferredMethod === 'paystack') {
          setPaystackSetup((prev) => ({
            ...prev,
            accountNumber: response.data.wallet.accountNumber || prev.accountNumber,
            businessName: response.data.wallet.accountName || owner?.company || owner?.name || '',
            currency: response.data.wallet.currency || prev.currency,
          }));
        }
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

  const fetchNotificationPreferences = async () => {
    try {
      setNotificationLoading(true);
      const response = await ownerDashboardApi.getNotificationPreferences();
      if (response.data?.preferences) {
        setNotificationPrefs({
          notificationsEnabled: Boolean(response.data.preferences.notificationsEnabled),
          marketingEnabled: Boolean(response.data.preferences.marketingEnabled),
          soundEnabled: Boolean(response.data.preferences.soundEnabled),
          hapticsEnabled: Boolean(response.data.preferences.hapticsEnabled),
        });
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error(error.response?.data?.error || 'Failed to load notification settings');
      }
    } finally {
      setNotificationLoading(false);
    }
  };

  const fetchSupportContent = async () => {
    try {
      setSupportLoading(true);
      const response = await ownerDashboardApi.getSupportContent();
      setSupportContent({
        supportEmail: response.data?.supportEmail || null,
        supportWhatsAppNumber: response.data?.supportWhatsAppNumber || null,
        faq: response.data?.faq || [],
      });
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error(error.response?.data?.error || 'Failed to load support content');
      }
    } finally {
      setSupportLoading(false);
    }
  };

  const fetchPaystackBanks = async (country: string, currency?: string, notify = true) => {
    try {
      const response = await ownerDashboardApi.getPaystackBanks({ country, currency });
      setPaystackBanks(response.data.banks || []);
    } catch (error: any) {
      if (notify) {
        toast.error(error.response?.data?.error || 'Failed to load Paystack banks');
      }
    }
  };

  const handleConnectPaystack = async () => {
    if (!paystackSetup.bankCode || !paystackSetup.accountNumber) {
      toast.error('Select a bank and enter account number');
      return;
    }

    try {
      setPaystackLoading(true);
      const response = await ownerDashboardApi.connectPaystackWallet({
        bankCode: paystackSetup.bankCode,
        accountNumber: paystackSetup.accountNumber,
        businessName: paystackSetup.businessName || owner?.company || owner?.name || undefined,
        currency: paystackSetup.currency,
        country: paystackSetup.country,
        setAsPreferred: true,
      });

      const nextWallet = response.data.wallet;
      setWalletData((prev) => ({
        ...prev,
        preferredMethod: 'paystack',
        accountName: nextWallet.accountName || prev.accountName,
        accountNumber: nextWallet.accountNumber || prev.accountNumber,
        bankName: nextWallet.bankName || prev.bankName,
        paystackSubaccount: nextWallet.paystackSubaccount || prev.paystackSubaccount,
        currency: nextWallet.currency || prev.currency,
      }));
      toast.success('Paystack auto-payout connected');
      await fetchWallet();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to connect Paystack account');
    } finally {
      setPaystackLoading(false);
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

  const handleNotificationSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await ownerDashboardApi.updateNotificationPreferences(notificationPrefs);
      toast.success('Notification settings saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save notification settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
      <DashboardPageHeader title="Account" subtitle="Manage your profile, security, and preferences" />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-surface-100 p-1 rounded-xl">
        {([
          { id: 'profile' as const, label: 'Profile' },
          { id: 'password' as const, label: 'Password' },
          { id: 'wallet' as const, label: 'Wallet' },
          { id: 'notifications' as const, label: 'Alerts' },
          { id: 'support' as const, label: 'Support' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-white text-brand-900 shadow-sm'
                : 'text-surface-600 hover:text-brand-900'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-surface-200/80 shadow-soft p-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-brand-900 mb-5">Profile Information</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
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

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-xl border border-surface-200/80 shadow-soft p-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-brand-900 mb-5">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
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

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Wallet Tab */}
      {activeTab === 'wallet' && (
        <div className="bg-white rounded-xl border border-surface-200/80 shadow-soft p-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-brand-900 mb-5">Wallet & Payout Settings</h2>
          <p className="text-sm text-surface-600 mb-6">
            Configure your payout method to receive payments from your events.
          </p>
          
          {walletLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900 mx-auto" />
            </div>
          ) : (
            <form onSubmit={handleWalletUpdate} className="space-y-6">
              {/* Automated Paystack Setup */}
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-brand-900">Automated Paystack Payout</h3>
                    <p className="text-sm text-brand-800/80 mt-1">
                      Connect your bank account once. Ticket and gift payments can auto-route to your Paystack subaccount.
                    </p>
                  </div>
                  {walletData.paystackSubaccount ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Not connected
                    </span>
                  )}
                </div>

                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Country</label>
                    <select
                      className="input"
                      value={paystackSetup.country}
                      onChange={(e) => {
                        const nextCountry = e.target.value;
                        const nextCurrency = nextCountry === 'nigeria' ? 'NGN' : 'GHS';
                        setPaystackSetup((prev) => ({ ...prev, country: nextCountry, currency: nextCurrency, bankCode: '' }));
                        fetchPaystackBanks(nextCountry, nextCurrency);
                      }}
                    >
                      <option value="ghana">Ghana</option>
                      <option value="nigeria">Nigeria</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Currency</label>
                    <select
                      className="input"
                      value={paystackSetup.currency}
                      onChange={(e) => setPaystackSetup((prev) => ({ ...prev, currency: e.target.value }))}
                    >
                      <option value="GHS">GHS</option>
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Bank</label>
                    <select
                      className="input"
                      value={paystackSetup.bankCode}
                      onChange={(e) => setPaystackSetup((prev) => ({ ...prev, bankCode: e.target.value }))}
                    >
                      <option value="">Select bank</option>
                      {paystackBanks.map((bank) => (
                        <option key={`${bank.code}-${bank.name}`} value={bank.code}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Account Number</label>
                    <input
                      type="text"
                      className="input"
                      value={paystackSetup.accountNumber}
                      onChange={(e) =>
                        setPaystackSetup((prev) => ({
                          ...prev,
                          accountNumber: e.target.value.replace(/[^\d]/g, '').slice(0, 12),
                        }))
                      }
                      placeholder="0123456789"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Business Name (Optional)</label>
                    <input
                      type="text"
                      className="input"
                      value={paystackSetup.businessName}
                      onChange={(e) => setPaystackSetup((prev) => ({ ...prev, businessName: e.target.value }))}
                      placeholder={owner?.company || owner?.name || 'Your business name'}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={paystackLoading}
                    onClick={handleConnectPaystack}
                  >
                    {paystackLoading ? 'Connecting...' : 'Connect Paystack'}
                  </button>
                  {walletData.paystackSubaccount ? (
                    <span className="text-xs text-brand-900/70">
                      Subaccount: <span className="font-mono">{walletData.paystackSubaccount}</span>
                    </span>
                  ) : null}
                </div>
              </div>

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
                  <option value="paystack">Paystack</option>
                  <option value="stripe">Stripe</option>
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

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-surface-200">
            <h2 className="text-lg font-semibold text-navy-900">Notification Preferences</h2>
            <p className="text-sm text-surface-500 mt-1">Choose what alerts you want to receive</p>
          </div>

          {notificationLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-brand-900 border-t-transparent" />
            </div>
          ) : (
            <form onSubmit={handleNotificationSave}>
              <div className="divide-y divide-surface-100">
                {([
                  {
                    key: 'notificationsEnabled' as const,
                    label: 'Push Notifications',
                    description: 'Receive alerts for RSVPs, check-ins, and event updates',
                  },
                  {
                    key: 'marketingEnabled' as const,
                    label: 'Marketing & Tips',
                    description: 'Product updates, feature announcements, and event tips',
                  },
                  {
                    key: 'soundEnabled' as const,
                    label: 'Sound',
                    description: 'Play a sound when notifications arrive',
                  },
                  {
                    key: 'hapticsEnabled' as const,
                    label: 'Haptics',
                    description: 'Vibrate on notification events (mobile only)',
                  },
                ]).map((pref) => (
                  <label key={pref.key} htmlFor={pref.key} className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 cursor-pointer hover:bg-surface-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900">{pref.label}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{pref.description}</p>
                    </div>
                    <button
                      type="button"
                      id={pref.key}
                      role="switch"
                      aria-checked={notificationPrefs[pref.key]}
                      onClick={() => setNotificationPrefs((prev) => ({ ...prev, [pref.key]: !prev[pref.key] }))}
                      className={`
                        relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200
                        ${notificationPrefs[pref.key] ? 'bg-brand-900' : 'bg-surface-300'}
                      `}
                    >
                      <span
                        className={`
                          inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transform transition-transform duration-200
                          ${notificationPrefs[pref.key] ? 'translate-x-[22px]' : 'translate-x-[3px]'}
                        `}
                        style={{ width: 18, height: 18 }}
                      />
                    </button>
                  </label>
                ))}
              </div>

              <div className="px-5 sm:px-6 py-4 bg-surface-50 border-t border-surface-200">
                <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Support Tab */}
      {activeTab === 'support' && (
        <div className="space-y-5">
          {supportLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-brand-900 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Contact */}
              <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-surface-200">
                  <h2 className="text-lg font-semibold text-navy-900">Contact Support</h2>
                  <p className="text-sm text-surface-500 mt-1">Get help from our team</p>
                </div>
                <div className="p-5 sm:p-6 space-y-4">
                  {supportContent.supportEmail && (
                    <a
                      href={`mailto:${supportContent.supportEmail}`}
                      className="flex items-center gap-4 p-4 rounded-xl border border-surface-200 hover:border-brand-200 hover:bg-brand-50/30 transition-all"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-900">Email Support</p>
                        <p className="text-xs text-surface-500 truncate">{supportContent.supportEmail}</p>
                      </div>
                    </a>
                  )}
                  {supportContent.supportWhatsAppNumber && (
                    <a
                      href={`https://wa.me/${supportContent.supportWhatsAppNumber.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 rounded-xl border border-surface-200 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-900">WhatsApp Support</p>
                        <p className="text-xs text-surface-500 truncate">{supportContent.supportWhatsAppNumber}</p>
                      </div>
                    </a>
                  )}
                  {!supportContent.supportEmail && !supportContent.supportWhatsAppNumber && (
                    <p className="text-sm text-surface-500 text-center py-4">No support channels configured yet.</p>
                  )}
                </div>
              </div>

              {/* FAQ */}
              {supportContent.faq.length > 0 && (
                <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                  <div className="p-5 sm:p-6 border-b border-surface-200">
                    <h2 className="text-lg font-semibold text-navy-900">Frequently Asked Questions</h2>
                  </div>
                  <div className="divide-y divide-surface-100">
                    {supportContent.faq.map((item, index) => (
                      <details key={index} className="group">
                        <summary className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 cursor-pointer hover:bg-surface-50 transition-colors list-none">
                          <span className="text-sm font-medium text-navy-900">{item.question}</span>
                          <svg className="w-4 h-4 text-surface-400 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </summary>
                        <div className="px-5 sm:px-6 pb-4 text-sm text-surface-600 leading-relaxed">
                          {item.answer}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {supportContent.faq.length === 0 && !supportContent.supportEmail && !supportContent.supportWhatsAppNumber && (
                <div className="bg-white rounded-xl border border-surface-200 p-10 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-100 mb-3">
                    <svg className="w-6 h-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-sm text-surface-600">Support content will appear here once configured by the admin.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

