'use client';

import { useState, useEffect } from 'react';
import { ownerAuthApi, ownerDashboardApi } from '@/lib/api';
import { useOwnerAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { PageHeader, Panel, StatusBadge, SubmitButton, Switch, Tabs } from '@/components/ui/Primitives';
import { ConfirmDialog, Modal } from '@/components/ui/Overlay';
import { cn, getErrorMessage } from '@/lib/utils';

interface PaystackBank {
  code: string;
  name: string;
  currency?: string;
  country?: string;
}

type WalletMode = 'MANUAL_FALLBACK' | 'MANUAL_EXPLICIT' | 'AUTOMATED';
type WalletType = 'manual' | 'offline' | 'stripe' | 'paypal' | 'paystack' | 'flutterwave';

interface OwnerPayoutWallet {
  id: string;
  walletType: WalletType;
  currency: string;
  countryCode?: string | null;
  isActive: boolean;
  isVerified: boolean;
  paystackSubaccount?: string | null;
  paystackRecipientCode?: string | null;
}

interface ManualSettlementSummary {
  transactionCount: number;
  amountReceived: number;
  amountOwed: number;
  amountSettled: number;
  outstandingBalance: number;
}

const WALLET_LABEL: Record<WalletType, string> = {
  manual: 'Manual',
  offline: 'Offline',
  stripe: 'Stripe',
  paypal: 'PayPal',
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
};

const COUNTRY_OPTIONS = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'GH', label: 'Ghana' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'KE', label: 'Kenya' },
  { code: 'ZA', label: 'South Africa' },
];

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
    countryCode: owner?.countryCode || 'US',
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
    stripeAccountId: '',
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
  // The account is confirmed with the gateway before anything is created,
  // so the owner sees whose account they are about to connect.
  const [resolvedAccount, setResolvedAccount] = useState<{
    accountName: string;
    bankName?: string | null;
  } | null>(null);
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [walletMode, setWalletMode] = useState<WalletMode>('MANUAL_FALLBACK');
  const [availableWalletTypes, setAvailableWalletTypes] = useState<WalletType[]>(['manual', 'offline']);
  const [ownerWallets, setOwnerWallets] = useState<OwnerPayoutWallet[]>([]);
  const [manualSettlement, setManualSettlement] = useState<ManualSettlementSummary | null>(null);
  const [selectedWalletType, setSelectedWalletType] = useState<WalletType>('manual');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState({
    notificationsEnabled: true,
    marketingEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    notifyRsvp: true,
    notifyCheckIn: true,
    notifyGift: true,
    notifyTicketSold: true,
    notifyMarketing: true,
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
        countryCode: owner.countryCode || 'US',
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
      setWalletMode((response.data.walletMode || 'MANUAL_FALLBACK') as WalletMode);
      const nextWalletTypes = ((response.data.availableWalletTypes || ['manual', 'offline']) as string[])
        .map((type) => String(type).toLowerCase())
        .filter((type): type is WalletType =>
          ['manual', 'offline', 'stripe', 'paypal', 'paystack', 'flutterwave'].includes(type)
        );
      setAvailableWalletTypes(nextWalletTypes.length ? nextWalletTypes : ['manual', 'offline']);
      setOwnerWallets((response.data.wallets || []) as OwnerPayoutWallet[]);
      setManualSettlement((response.data.manualSettlement || null) as ManualSettlementSummary | null);

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
          stripeAccountId: response.data.wallet.stripeAccountId || '',
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
      const activeWallets = ((response.data.wallets || []) as OwnerPayoutWallet[]).filter((wallet) => wallet.isActive);
      const preferredWallet =
        activeWallets.find((wallet) => wallet.walletType === 'manual' || wallet.walletType === 'offline') ||
        activeWallets[0] ||
        null;
      if (preferredWallet) {
        setSelectedWalletId(preferredWallet.id);
        setSelectedWalletType(preferredWallet.walletType);
      } else {
        setSelectedWalletId('');
        setSelectedWalletType('manual');
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
        const p = response.data.preferences;
        setNotificationPrefs({
          notificationsEnabled: Boolean(p.notificationsEnabled),
          marketingEnabled: Boolean(p.marketingEnabled),
          emailEnabled: p.emailEnabled !== undefined ? Boolean(p.emailEnabled) : true,
          smsEnabled: p.smsEnabled !== undefined ? Boolean(p.smsEnabled) : false,
          pushEnabled: p.pushEnabled !== undefined ? Boolean(p.pushEnabled) : true,
          notifyRsvp: p.notifyRsvp !== undefined ? Boolean(p.notifyRsvp) : true,
          notifyCheckIn: p.notifyCheckIn !== undefined ? Boolean(p.notifyCheckIn) : true,
          notifyGift: p.notifyGift !== undefined ? Boolean(p.notifyGift) : true,
          notifyTicketSold: p.notifyTicketSold !== undefined ? Boolean(p.notifyTicketSold) : true,
          notifyMarketing: p.notifyMarketing !== undefined ? Boolean(p.notifyMarketing) : true,
          soundEnabled: Boolean(p.soundEnabled),
          hapticsEnabled: Boolean(p.hapticsEnabled),
        });
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error(getErrorMessage(error, 'Failed to load notification settings'));
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
        toast.error(getErrorMessage(error, 'Failed to load support content'));
      }
    } finally {
      setSupportLoading(false);
    }
  };

  // Confirm the destination as the owner types. Debounced so a 10-digit
  // account number costs one lookup, not ten.
  useEffect(() => {
    const { bankCode, accountNumber, currency } = paystackSetup;
    setResolvedAccount(null);
    setResolveError(null);

    if (!bankCode || accountNumber.length < 10) {
      setResolvingAccount(false);
      return;
    }

    let cancelled = false;
    setResolvingAccount(true);
    const timer = setTimeout(async () => {
      try {
        const response = await ownerDashboardApi.resolvePayoutAccount('paystack', {
          accountNumber,
          bankCode,
          currency,
        });
        if (cancelled) return;
        setResolvedAccount(response.data.account);
      } catch (error) {
        if (cancelled) return;
        setResolveError(getErrorMessage(error, 'Could not confirm this account'));
      } finally {
        if (!cancelled) setResolvingAccount(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [paystackSetup.bankCode, paystackSetup.accountNumber, paystackSetup.currency]);

  const fetchPaystackBanks = async (country: string, currency?: string, notify = true) => {
    try {
      const response = await ownerDashboardApi.getPaystackBanks({ country, currency });
      setPaystackBanks(response.data.banks || []);
    } catch (error: any) {
      if (notify) {
        toast.error(getErrorMessage(error, 'Failed to load Paystack banks'));
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
      const nextPayoutWallet = response.data.payoutWallet as OwnerPayoutWallet | undefined;
      setWalletData((prev) => ({
        ...prev,
        preferredMethod: 'paystack',
        accountName: nextWallet.accountName || prev.accountName,
        accountNumber: nextWallet.accountNumber || prev.accountNumber,
        bankName: nextWallet.bankName || prev.bankName,
        paystackSubaccount: nextWallet.paystackSubaccount || prev.paystackSubaccount,
        currency: nextWallet.currency || prev.currency,
      }));
      if (nextPayoutWallet?.id) {
        setSelectedWalletId(nextPayoutWallet.id);
        setSelectedWalletType('paystack');
      }
      toast.success('Paystack auto-payout connected');
      await fetchWallet();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to connect Paystack account'));
    } finally {
      setPaystackLoading(false);
    }
  };

  const handleWalletUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (selectedWalletType === 'paystack' && !walletData.paystackSubaccount) {
        throw new Error('Connect Paystack first before saving Paystack wallet.');
      }

      const payload: Record<string, any> = {
        walletType: selectedWalletType,
        walletId: selectedWalletId || undefined,
        countryCode: profileData.countryCode || 'US',
        currency: walletData.currency,
        isActive: true,
      };

      if (selectedWalletType === 'paystack') {
        payload.paystackSubaccount = walletData.paystackSubaccount || undefined;
      } else if (selectedWalletType === 'paypal') {
        payload.paypalEmail = walletData.paypalEmail || undefined;
      } else if (selectedWalletType === 'stripe') {
        payload.stripeAccountId = walletData.stripeAccountId || undefined;
      } else if (selectedWalletType === 'manual' || selectedWalletType === 'offline') {
        payload.bankName = walletData.bankName || undefined;
        payload.accountName = walletData.accountName || undefined;
        payload.accountNumber = walletData.accountNumber || undefined;
        payload.routingNumber = walletData.routingNumber || undefined;
        payload.swiftCode = walletData.swiftCode || undefined;
        payload.mobileProvider = walletData.mobileProvider || undefined;
        payload.mobileNumber = walletData.mobileNumber || undefined;
        payload.paypalEmail = walletData.paypalEmail || undefined;
      }

      await ownerDashboardApi.updateWallet(payload);
      toast.success('Payout destination saved');
      await fetchWallet();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to update wallet settings'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveWallet = async (walletId: string) => {
    try {
      setLoading(true);
      await ownerDashboardApi.removeWallet(walletId);
      toast.success('Wallet removed');
      if (selectedWalletId === walletId) {
        setSelectedWalletId('');
        setSelectedWalletType('manual');
      }
      await fetchWallet();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to remove wallet'));
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
        countryCode: profileData.countryCode || undefined,
      });

      // Update auth store with new owner data
      if (token) {
        setAuth(token, response.data.owner);
      }
      toast.success('Profile saved');
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to update profile'));
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
      toast.success('Password changed');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to change password'));
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
      toast.error(getErrorMessage(error, 'Failed to save notification settings'));
    } finally {
      setLoading(false);
    }
  };

  const walletTypeOptions = Array.from(new Set<WalletType>([...availableWalletTypes, selectedWalletType]));
  const hasManualWallet = ownerWallets.some(
    (wallet) => wallet.isActive && (wallet.walletType === 'manual' || wallet.walletType === 'offline')
  );
  const hasPaystackWallet = ownerWallets.some(
    (wallet) => wallet.isActive && wallet.walletType === 'paystack'
  );
  const disablePaystackConnect = hasManualWallet && !hasPaystackWallet;

  return (
    <div className="page mx-auto max-w-4xl">
      <PageHeader title="Account" />

      <Tabs
        items={[
          { id: 'profile', label: 'Profile' },
          { id: 'password', label: 'Password' },
          { id: 'wallet', label: 'Payouts' },
          { id: 'notifications', label: 'Alerts' },
          { id: 'support', label: 'Support' },
        ]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
        label="Account sections"
      />

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="panel p-4 sm:p-5">
          <h2 className="panel-title mb-4">Profile</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label htmlFor="name" className="label">
                Full name
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
                Email
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
                Phone
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

            <div>
              <label htmlFor="countryCode" className="label">
                Country
              </label>
              <select
                id="countryCode"
                className="input"
                value={profileData.countryCode}
                onChange={(e) => setProfileData({ ...profileData, countryCode: e.target.value })}
              >
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label} ({country.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="panel p-4 sm:p-5">
          <h2 className="panel-title mb-4">Password</h2>
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
                {loading ? 'Changing...' : 'Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Wallet Tab */}
      {activeTab === 'wallet' && (
        <div className="panel p-4 sm:p-5">
          <h2 className="panel-title mb-4">Payout destination</h2>
          <p className="text-sm text-surface-600 mb-6">
            Wallet mode controls guest payment methods and payout routing.
          </p>

          {walletLoading ? (
            <div className="space-y-3">
              <div className="skeleton h-20 rounded-xl" />
              <div className="skeleton h-32 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-surface-200 p-4 sm:p-5 bg-surface-50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-brand-900">Current Mode:</span>
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border',
                    walletMode === 'AUTOMATED'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  )}>
                    {walletMode === 'AUTOMATED' ? 'Automated Wallet Routing' : 'Manual Settlement'}
                  </span>
                </div>
                {manualSettlement ? (
                  <div className="grid sm:grid-cols-4 gap-3 mt-4">
                    <div className="rounded-lg border border-surface-200 bg-white p-3">
                      <p className="text-xs text-surface-500">Amount Received</p>
                      <p className="text-sm font-semibold text-brand-900">
                        {manualSettlement.amountReceived.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-surface-200 bg-white p-3">
                      <p className="text-xs text-surface-500">Amount Owed</p>
                      <p className="text-sm font-semibold text-brand-900">
                        {manualSettlement.amountOwed.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-surface-200 bg-white p-3">
                      <p className="text-xs text-surface-500">Settled</p>
                      <p className="text-sm font-semibold text-brand-900">
                        {manualSettlement.amountSettled.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-surface-200 bg-white p-3">
                      <p className="text-xs text-surface-500">Outstanding</p>
                      <p className="text-sm font-semibold text-amber-700">
                        {manualSettlement.outstandingBalance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-surface-200 p-4 sm:p-5">
                <h3 className="section-title mb-2">Saved destinations</h3>
                {ownerWallets.length === 0 ? (
                  <p className="text-sm text-surface-500">No wallet configured yet. System uses manual fallback.</p>
                ) : (
                  <div className="space-y-2">
                    {ownerWallets.map((wallet) => (
                      <div key={wallet.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-200 p-3">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => {
                            setSelectedWalletId(wallet.id);
                            setSelectedWalletType(wallet.walletType);
                            setWalletData((prev) => ({
                              ...prev,
                              currency: wallet.currency || prev.currency,
                              paystackSubaccount: wallet.paystackSubaccount || prev.paystackSubaccount,
                            }));
                          }}
                        >
                          <p className="text-sm font-semibold text-brand-900">
                            {WALLET_LABEL[wallet.walletType]} {wallet.isVerified ? 'Verified' : 'Pending'}
                          </p>
                          <p className="text-xs text-surface-500">
                            {wallet.currency} {wallet.countryCode ? `• ${wallet.countryCode}` : ''}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border',
                            wallet.id === selectedWalletId
                              ? 'bg-brand-50 border-brand-200 text-brand-700'
                              : 'bg-surface-100 border-surface-200 text-surface-600'
                          )}>
                            {wallet.id === selectedWalletId ? 'Selected' : 'Select'}
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                            onClick={() => handleRemoveWallet(wallet.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleWalletUpdate} className="space-y-6">
                <div>
                  <label className="label">Wallet Type *</label>
                  <select
                    className="input"
                    value={selectedWalletType}
                    onChange={(e) => {
                      setSelectedWalletType(e.target.value as WalletType);
                      setSelectedWalletId('');
                    }}
                  >
                    {walletTypeOptions.map((walletType) => (
                      <option key={walletType} value={walletType}>
                        {WALLET_LABEL[walletType]}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-surface-500 mt-1">
                    Manual/Offline keeps guest checkout on admin rails with manual settlement.
                  </p>
                </div>

                {(selectedWalletType === 'manual' || selectedWalletType === 'offline') && (
                  <div className="space-y-4">
                    <div>
                      <label className="label">Manual Destination Type</label>
                      <select
                        className="input"
                        value={walletData.preferredMethod}
                        onChange={(e) => setWalletData({ ...walletData, preferredMethod: e.target.value as any })}
                      >
                        <option value="bank">Bank Transfer</option>
                        <option value="mobile">Mobile Money</option>
                        <option value="paypal">PayPal</option>
                      </select>
                    </div>

                    {walletData.preferredMethod === 'bank' && (
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
                          <label className="label">Routing / SWIFT</label>
                          <input
                            type="text"
                            className="input"
                            value={walletData.routingNumber || walletData.swiftCode}
                            onChange={(e) => setWalletData({ ...walletData, routingNumber: e.target.value })}
                            placeholder="Routing number or SWIFT code"
                          />
                        </div>
                      </div>
                    )}

                    {walletData.preferredMethod === 'mobile' && (
                      <div className="grid sm:grid-cols-2 gap-4">
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
                      </div>
                    )}

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
                  </div>
                )}

                {selectedWalletType === 'stripe' && (
                  <div>
                    <label className="label">Stripe Account ID</label>
                    <input
                      type="text"
                      className="input"
                      value={walletData.stripeAccountId}
                      onChange={(e) => setWalletData({ ...walletData, stripeAccountId: e.target.value })}
                      placeholder="acct_..."
                    />
                  </div>
                )}

                {selectedWalletType === 'paypal' && (
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

                {selectedWalletType === 'paystack' && (
                  <div className="space-y-4 rounded-lg border border-brand-100 bg-brand-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-brand-900">Paystack Automation</p>
                        <p className="text-xs text-brand-800/80 mt-1">
                          Connect your bank account for direct owner routing.
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

                    <div className="grid sm:grid-cols-2 gap-3">
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

                    {resolvingAccount ? (
                      <p className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-[13px] text-surface-700">
                        Confirming account&hellip;
                      </p>
                    ) : resolvedAccount ? (
                      <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
                        <p className="text-[13px] font-semibold text-brand-900">
                          {resolvedAccount.accountName}
                        </p>
                        <p className="mt-0.5 text-[12px] text-brand-800">
                          {resolvedAccount.bankName
                            ? `${resolvedAccount.bankName} - confirmed with Paystack`
                            : 'Confirmed with Paystack'}
                        </p>
                      </div>
                    ) : resolveError ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
                        {resolveError}
                      </p>
                    ) : null}

                    <div className="actions-row">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={paystackLoading || disablePaystackConnect || !resolvedAccount}
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
                    {disablePaystackConnect ? (
                      <p className="text-xs text-amber-700">
                        Manual/offline wallet is active. Disable manual mode first to connect automated Paystack routing.
                      </p>
                    ) : null}
                  </div>
                )}

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

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading || (selectedWalletType === 'paystack' && !walletData.paystackSubaccount)}
                    className="btn-primary"
                  >
                    {loading ? 'Saving...' : selectedWalletId ? 'Update Wallet' : 'Add Wallet'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-4">
          {notificationLoading ? (
            <>
              <div className="skeleton h-40 rounded-xl" />
              <div className="skeleton h-64 rounded-xl" />
            </>
          ) : (
            <form onSubmit={handleNotificationSave} className="space-y-4">
              <Panel title="How to reach you">
                <div className="space-y-1">
                  {([
                    { key: 'emailEnabled' as const, label: 'Email' },
                    { key: 'smsEnabled' as const, label: 'SMS' },
                  ]).map((pref) => (
                    <Switch
                      key={pref.key}
                      id={pref.key}
                      label={pref.label}
                      checked={notificationPrefs[pref.key]}
                      onChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, [pref.key]: checked }))}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="What to tell you about">
                <div className="space-y-1">
                  {([
                    { key: 'notifyRsvp' as const, label: 'New RSVPs' },
                    { key: 'notifyCheckIn' as const, label: 'Guest check-ins' },
                    { key: 'notifyGift' as const, label: 'Gifts received' },
                    { key: 'notifyTicketSold' as const, label: 'Ticket sales' },
                    {
                      key: 'notifyMarketing' as const,
                      label: 'Product news',
                      description: 'Updates, new features and event tips.',
                    },
                  ]).map((pref) => (
                    <Switch
                      key={pref.key}
                      id={pref.key}
                      label={pref.label}
                      description={(pref as { description?: string }).description}
                      checked={notificationPrefs[pref.key]}
                      onChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, [pref.key]: checked }))}
                    />
                  ))}
                </div>
              </Panel>

              <div className="flex justify-end">
                <SubmitButton type="submit" loading={loading}>
                  Save
                </SubmitButton>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Support Tab */}
      {activeTab === 'support' && (
        <div className="space-y-5">
          {supportLoading ? (
            <div className="space-y-3">
              <div className="skeleton h-40 rounded-xl" />
              <div className="skeleton h-56 rounded-xl" />
            </div>
          ) : (
            <>
              {/* Contact */}
              <div className="panel">
                <div className="p-5 sm:p-6 border-b border-surface-200">
                  <h2 className="panel-title">Contact Support</h2>
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
                        <p className="text-base font-medium text-brand-900">Email Support</p>
                        <p className="text-sm text-surface-500 truncate">{supportContent.supportEmail}</p>
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
                        <p className="text-base font-medium text-brand-900">WhatsApp Support</p>
                        <p className="text-sm text-surface-500 truncate">{supportContent.supportWhatsAppNumber}</p>
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
                <div className="panel">
                  <div className="p-5 sm:p-6 border-b border-surface-200">
                    <h2 className="panel-title">Frequently Asked Questions</h2>
                  </div>
                  <div className="divide-y divide-surface-100">
                    {supportContent.faq.map((item, index) => (
                      <details key={index} className="group">
                        <summary className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 cursor-pointer hover:bg-surface-50 transition-colors list-none">
                          <span className="text-base font-medium text-brand-900">{item.question}</span>
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
