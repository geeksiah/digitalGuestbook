import { FormEvent, useCallback, useMemo, useState } from 'react';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  useIonRouter,
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { ownerAuthApi, ownerDashboardApi } from '../api/client';
import { useSessionStore } from '../store/session';
import type { ManualSettlementSummary, OwnerPayoutWallet, PaystackBank, Wallet, WalletMode } from '../types/domain';
import { getErrorMessage } from '../utils/error';

type AccountTab = 'profile' | 'password' | 'wallet' | 'notifications' | 'support';
type WalletType = 'manual' | 'offline' | 'stripe' | 'paypal' | 'paystack' | 'flutterwave';

const WALLET_LABEL: Record<WalletType, string> = {
  manual: 'Manual',
  offline: 'Offline',
  stripe: 'Stripe',
  paypal: 'PayPal',
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
};

const AccountPage = () => {
  const router = useIonRouter();
  const [present] = useIonToast();
  const owner = useSessionStore((state) => state.owner);
  const setOwner = useSessionStore((state) => state.setOwner);
  const clearSession = useSessionStore((state) => state.clearSession);

  const [tab, setTab] = useState<AccountTab>('profile');
  const [loading, setLoading] = useState(false);
  const [paystackLoading, setPaystackLoading] = useState(false);
  const [paystackBanks, setPaystackBanks] = useState<PaystackBank[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
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

  const [profileData, setProfileData] = useState({
    name: owner?.name || '',
    email: owner?.email || '',
    phone: owner?.phone || '',
    company: owner?.company || '',
    countryCode: owner?.countryCode || 'US'
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

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
    preferredMethod: 'bank' as Wallet['preferredMethod'],
    currency: 'USD',
    autoPayoutEnabled: false,
    autoPayoutThreshold: 100
  });

  const [paystackSetup, setPaystackSetup] = useState({
    country: 'ghana',
    currency: 'GHS',
    bankCode: '',
    accountNumber: '',
    businessName: ''
  });

  const loadWallet = useCallback(async () => {
    try {
      const response = await ownerDashboardApi.wallet();
      const nextWallet = response.data.wallet;
      setWalletMode((response.data.walletMode || 'MANUAL_FALLBACK') as WalletMode);
      const nextWalletTypes = ((response.data.availableWalletTypes || ['manual', 'offline']) as string[])
        .map((type) => String(type).toLowerCase())
        .filter((type): type is WalletType =>
          ['manual', 'offline', 'stripe', 'paypal', 'paystack', 'flutterwave'].includes(type)
        );
      setAvailableWalletTypes(nextWalletTypes.length ? nextWalletTypes : ['manual', 'offline']);
      setOwnerWallets((response.data.wallets || []) as OwnerPayoutWallet[]);
      setManualSettlement((response.data.manualSettlement || null) as ManualSettlementSummary | null);
      setWallet(nextWallet || null);
      if (nextWallet) {
        setWalletData({
          bankName: nextWallet.bankName || '',
          accountName: nextWallet.accountName || '',
          accountNumber: nextWallet.accountNumber || '',
          routingNumber: nextWallet.routingNumber || '',
          swiftCode: nextWallet.swiftCode || '',
          mobileProvider: nextWallet.mobileProvider || '',
          mobileNumber: nextWallet.mobileNumber || '',
          paypalEmail: nextWallet.paypalEmail || '',
          stripeAccountId: nextWallet.stripeAccountId || '',
          paystackSubaccount: nextWallet.paystackSubaccount || '',
          preferredMethod: nextWallet.preferredMethod || 'bank',
          currency: nextWallet.currency || 'USD',
          autoPayoutEnabled: Boolean(nextWallet.autoPayoutEnabled),
          autoPayoutThreshold: nextWallet.autoPayoutThreshold || 100
        });
      }
      const activeWallets = ((response.data.wallets || []) as OwnerPayoutWallet[]).filter((item) => item.isActive);
      const preferredWallet =
        activeWallets.find((item) => item.walletType === 'manual' || item.walletType === 'offline') ||
        activeWallets[0] ||
        null;
      if (preferredWallet) {
        setSelectedWalletType(preferredWallet.walletType);
        setSelectedWalletId(preferredWallet.id);
      } else {
        setSelectedWalletType('manual');
        setSelectedWalletId('');
      }
    } catch (error: unknown) {
      present({ message: getErrorMessage(error, 'Failed to load wallet'), duration: 2200, color: 'danger' });
    }
  }, [present]);

  const loadPaystackBanks = useCallback(
    async (country: string, currency?: string) => {
      try {
        const response = await ownerDashboardApi.paystackBanks(country, currency);
        setPaystackBanks(response.data.banks || []);
      } catch (error: unknown) {
        present({
          message: getErrorMessage(error, 'Failed to load Paystack banks'),
          duration: 2000,
          color: 'danger'
        });
      }
    },
    [present]
  );

  useIonViewWillEnter(() => {
    setProfileData({
      name: owner?.name || '',
      email: owner?.email || '',
      phone: owner?.phone || '',
      company: owner?.company || '',
      countryCode: owner?.countryCode || 'US'
    });
    void loadWallet();
    void loadPaystackBanks(paystackSetup.country, paystackSetup.currency);
    void ownerDashboardApi.notificationPreferences()
      .then((response) => {
        if (response.data?.preferences) {
          const next = response.data.preferences;
          setNotificationPrefs({
            notificationsEnabled: Boolean(next.notificationsEnabled),
            marketingEnabled: Boolean(next.marketingEnabled),
            emailEnabled: next.emailEnabled !== undefined ? Boolean(next.emailEnabled) : true,
            smsEnabled: next.smsEnabled !== undefined ? Boolean(next.smsEnabled) : false,
            pushEnabled: next.pushEnabled !== undefined ? Boolean(next.pushEnabled) : true,
            notifyRsvp: next.notifyRsvp !== undefined ? Boolean(next.notifyRsvp) : true,
            notifyCheckIn: next.notifyCheckIn !== undefined ? Boolean(next.notifyCheckIn) : true,
            notifyGift: next.notifyGift !== undefined ? Boolean(next.notifyGift) : true,
            notifyTicketSold: next.notifyTicketSold !== undefined ? Boolean(next.notifyTicketSold) : true,
            notifyMarketing: next.notifyMarketing !== undefined ? Boolean(next.notifyMarketing) : true,
            soundEnabled: Boolean(next.soundEnabled),
            hapticsEnabled: Boolean(next.hapticsEnabled),
          });
        }
      })
      .catch(() => null);
    void ownerDashboardApi.supportContent()
      .then((response) => setSupportContent(response.data))
      .catch(() => null);
  });

  const walletTypeOptions = useMemo(
    () => Array.from(new Set<WalletType>([...availableWalletTypes, selectedWalletType])),
    [availableWalletTypes, selectedWalletType]
  );
  const hasManualWallet = useMemo(
    () => ownerWallets.some((walletItem) => walletItem.isActive && (walletItem.walletType === 'manual' || walletItem.walletType === 'offline')),
    [ownerWallets]
  );
  const hasPaystackWallet = useMemo(
    () => ownerWallets.some((walletItem) => walletItem.isActive && walletItem.walletType === 'paystack'),
    [ownerWallets]
  );
  const disablePaystackConnect = hasManualWallet && !hasPaystackWallet;
  const isPaystackMethod = useMemo(
    () => selectedWalletType === 'paystack' || Boolean(wallet?.paystackSubaccount),
    [selectedWalletType, wallet?.paystackSubaccount]
  );

  const onSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await ownerAuthApi.updateProfile({
        name: profileData.name || undefined,
        email: profileData.email || undefined,
        phone: profileData.phone || undefined,
        company: profileData.company || undefined,
        countryCode: profileData.countryCode || undefined,
      });
      setOwner(response.data.owner);
      present({ message: 'Profile updated', duration: 1800, color: 'success' });
    } catch (error: unknown) {
      present({ message: getErrorMessage(error, 'Failed to update profile'), duration: 2200, color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const onChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      present({ message: 'Passwords do not match', duration: 1800, color: 'danger' });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      present({ message: 'Password must be at least 6 characters', duration: 1800, color: 'danger' });
      return;
    }

    setLoading(true);
    try {
      await ownerAuthApi.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      present({ message: 'Password changed', duration: 1800, color: 'success' });
    } catch (error: unknown) {
      present({ message: getErrorMessage(error, 'Failed to change password'), duration: 2200, color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const onSaveWallet = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (selectedWalletType === 'paystack' && !walletData.paystackSubaccount) {
        throw new Error('Connect Paystack first before saving Paystack wallet.');
      }
      const payload: Record<string, unknown> = {
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
      await loadWallet();
      present({ message: 'Wallet settings saved', duration: 1800, color: 'success' });
    } catch (error: unknown) {
      present({ message: getErrorMessage(error, 'Failed to save wallet settings'), duration: 2200, color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const onConnectPaystack = async () => {
    if (!paystackSetup.bankCode || !paystackSetup.accountNumber) {
      present({ message: 'Select a bank and account number', duration: 1800, color: 'danger' });
      return;
    }
    setPaystackLoading(true);
    try {
      const response = await ownerDashboardApi.connectPaystack({
        bankCode: paystackSetup.bankCode,
        accountNumber: paystackSetup.accountNumber,
        businessName: paystackSetup.businessName || owner?.company || owner?.name || undefined,
        country: paystackSetup.country,
        currency: paystackSetup.currency,
        setAsPreferred: true
      });
      const payoutWallet = response.data.payoutWallet;
      if (payoutWallet?.id) {
        setSelectedWalletType('paystack');
        setSelectedWalletId(payoutWallet.id);
      }
      await loadWallet();
      present({ message: 'Paystack connected', duration: 1800, color: 'success' });
    } catch (error: unknown) {
      present({ message: getErrorMessage(error, 'Failed to connect Paystack'), duration: 2200, color: 'danger' });
    } finally {
      setPaystackLoading(false);
    }
  };

  const onSignOut = () => {
    clearSession();
    router.push('/auth', 'root');
  };

  const onRemoveWallet = async (walletId: string) => {
    try {
      setLoading(true);
      await ownerDashboardApi.removeWallet(walletId);
      if (selectedWalletId === walletId) {
        setSelectedWalletId('');
        setSelectedWalletType('manual');
      }
      await loadWallet();
      present({ message: 'Wallet removed', duration: 1800, color: 'success' });
    } catch (error: unknown) {
      present({ message: getErrorMessage(error, 'Failed to remove wallet'), duration: 2200, color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationPrefs = async () => {
    setLoading(true);
    try {
      await ownerDashboardApi.updateNotificationPreferences(notificationPrefs);
      present({ message: 'Notification settings saved', duration: 1800, color: 'success' });
    } catch (error: unknown) {
      present({ message: getErrorMessage(error, 'Failed to save notification settings'), duration: 2200, color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/app/more" /></IonButtons>
          <IonTitle>Account</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(refresh) => loadWallet().finally(() => refresh.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <main className="screen-content">
          <section className="hero-card compact">
            <div className="inline-row" style={{ gap: 14 }}>
              <div className="avatar-circle lg">
                {(owner?.name || 'O').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: 20 }}>{owner?.name || 'Owner'}</h2>
                <p className="event-subline">{owner?.email}</p>
              </div>
            </div>
          </section>

          <section className="surface-card">
            <IonSegment scrollable value={tab} onIonChange={(event) => setTab((event.detail.value as AccountTab) || 'profile')}>
              <IonSegmentButton value="profile">Profile</IonSegmentButton>
              <IonSegmentButton value="password">Password</IonSegmentButton>
              <IonSegmentButton value="wallet">Wallet</IonSegmentButton>
              <IonSegmentButton value="notifications">Alerts</IonSegmentButton>
              <IonSegmentButton value="support">Support</IonSegmentButton>
            </IonSegment>
          </section>

          {tab === 'profile' ? (
            <section className="surface-card">
              <h3>Profile information</h3>
              <form className="auth-form" onSubmit={onSaveProfile}>
                <label className="field">
                  <span>Full name</span>
                  <input
                    className="native-input"
                    required
                    value={profileData.name}
                    onChange={(event) => setProfileData((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    className="native-input"
                    required
                    type="email"
                    value={profileData.email}
                    onChange={(event) => setProfileData((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Phone</span>
                  <input
                    className="native-input"
                    type="tel"
                    value={profileData.phone}
                    onChange={(event) => setProfileData((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Company</span>
                  <input
                    className="native-input"
                    value={profileData.company}
                    onChange={(event) => setProfileData((prev) => ({ ...prev, company: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Country</span>
                  <select
                    className="native-select"
                    value={profileData.countryCode}
                    onChange={(event) => setProfileData((prev) => ({ ...prev, countryCode: event.target.value }))}
                  >
                    <option value="US">United States (US)</option>
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="GH">Ghana (GH)</option>
                    <option value="NG">Nigeria (NG)</option>
                    <option value="KE">Kenya (KE)</option>
                    <option value="ZA">South Africa (ZA)</option>
                  </select>
                </label>
                <IonButton className="solid-cta" type="submit" expand="block" disabled={loading}>
                  {loading ? 'Saving...' : 'Save profile'}
                </IonButton>
              </form>
            </section>
          ) : null}

          {tab === 'password' ? (
            <section className="surface-card">
              <h3>Change password</h3>
              <form className="auth-form" onSubmit={onChangePassword}>
                <label className="field">
                  <span>Current password</span>
                  <input
                    className="native-input"
                    type="password"
                    required
                    value={passwordData.currentPassword}
                    onChange={(event) => setPasswordData((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>New password</span>
                  <input
                    className="native-input"
                    type="password"
                    required
                    minLength={6}
                    value={passwordData.newPassword}
                    onChange={(event) => setPasswordData((prev) => ({ ...prev, newPassword: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Confirm new password</span>
                  <input
                    className="native-input"
                    type="password"
                    required
                    minLength={6}
                    value={passwordData.confirmPassword}
                    onChange={(event) => setPasswordData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  />
                </label>
                <IonButton className="solid-cta" type="submit" expand="block" disabled={loading}>
                  {loading ? 'Saving...' : 'Change password'}
                </IonButton>
              </form>
            </section>
          ) : null}

          {tab === 'wallet' ? (
            <>
              <section className="surface-card">
                <h3>Wallet mode</h3>
                <p className="muted-text">
                  {walletMode === 'AUTOMATED' ? 'Automated owner routing is active.' : 'Manual settlement mode is active.'}
                </p>
                {manualSettlement ? (
                  <div className="info-grid" style={{ marginTop: 12 }}>
                    <div className="info-item">
                      <span className="label">Received</span>
                      <strong>{manualSettlement.amountReceived.toFixed(2)}</strong>
                    </div>
                    <div className="info-item">
                      <span className="label">Owed</span>
                      <strong>{manualSettlement.amountOwed.toFixed(2)}</strong>
                    </div>
                    <div className="info-item">
                      <span className="label">Settled</span>
                      <strong>{manualSettlement.amountSettled.toFixed(2)}</strong>
                    </div>
                    <div className="info-item">
                      <span className="label">Outstanding</span>
                      <strong>{manualSettlement.outstandingBalance.toFixed(2)}</strong>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="surface-card">
                <h3>Configured wallets</h3>
                {ownerWallets.length === 0 ? (
                  <p className="muted-text">No wallet configured yet. System is in manual fallback mode.</p>
                ) : (
                  <div className="list-stack">
                    {ownerWallets.map((walletItem) => (
                      <div key={walletItem.id} className="list-row" style={{ justifyContent: 'space-between' }}>
                        <button
                          type="button"
                          className="ghost-link"
                          onClick={() => {
                            setSelectedWalletType(walletItem.walletType);
                            setSelectedWalletId(walletItem.id);
                            setWalletData((prev) => ({
                              ...prev,
                              currency: walletItem.currency || prev.currency,
                              paystackSubaccount: walletItem.paystackSubaccount || prev.paystackSubaccount,
                            }));
                          }}
                        >
                          {WALLET_LABEL[walletItem.walletType]} ({walletItem.currency}) {walletItem.isVerified ? 'Verified' : 'Pending'}
                        </button>
                        <IonButton
                          fill="clear"
                          size="small"
                          color="danger"
                          onClick={() => onRemoveWallet(walletItem.id)}
                        >
                          Remove
                        </IonButton>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="surface-card">
                <h3>Wallet settings</h3>
                <form className="auth-form" onSubmit={onSaveWallet}>
                  <label className="field">
                    <span>Wallet type</span>
                    <select
                      className="native-select"
                      value={selectedWalletType}
                      onChange={(event) =>
                        setSelectedWalletType(event.target.value as WalletType)
                      }
                    >
                      {walletTypeOptions.map((walletType) => (
                        <option key={walletType} value={walletType}>
                          {WALLET_LABEL[walletType]}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedWalletType === 'manual' || selectedWalletType === 'offline' ? (
                    <label className="field">
                      <span>Manual destination type</span>
                      <select
                        className="native-select"
                        value={walletData.preferredMethod}
                        onChange={(event) =>
                          setWalletData((prev) => ({
                            ...prev,
                            preferredMethod: event.target.value as Wallet['preferredMethod']
                          }))
                        }
                      >
                        <option value="bank">Bank transfer</option>
                        <option value="mobile">Mobile money</option>
                        <option value="paypal">PayPal</option>
                      </select>
                    </label>
                  ) : null}

                  {selectedWalletType === 'manual' || selectedWalletType === 'offline' ? (
                    walletData.preferredMethod === 'bank' ? (
                    <>
                      <label className="field">
                        <span>Bank name</span>
                        <input
                          className="native-input"
                          value={walletData.bankName}
                          onChange={(event) => setWalletData((prev) => ({ ...prev, bankName: event.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>Account name</span>
                        <input
                          className="native-input"
                          value={walletData.accountName}
                          onChange={(event) =>
                            setWalletData((prev) => ({ ...prev, accountName: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Account number</span>
                        <input
                          className="native-input"
                          value={walletData.accountNumber}
                          onChange={(event) =>
                            setWalletData((prev) => ({ ...prev, accountNumber: event.target.value }))
                          }
                        />
                      </label>
                    </>
                    ) : null
                  ) : null}

                  {selectedWalletType === 'manual' || selectedWalletType === 'offline' ? (
                    walletData.preferredMethod === 'mobile' ? (
                    <>
                      <label className="field">
                        <span>Mobile provider</span>
                        <select
                          className="native-select"
                          value={walletData.mobileProvider}
                          onChange={(event) =>
                            setWalletData((prev) => ({ ...prev, mobileProvider: event.target.value }))
                          }
                        >
                          <option value="">Select provider</option>
                          <option value="mpesa">M-Pesa</option>
                          <option value="mtn">MTN</option>
                          <option value="airtel">Airtel</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Mobile number</span>
                        <input
                          className="native-input"
                          type="tel"
                          value={walletData.mobileNumber}
                          onChange={(event) =>
                            setWalletData((prev) => ({ ...prev, mobileNumber: event.target.value }))
                          }
                        />
                      </label>
                    </>
                    ) : null
                  ) : null}

                  {(selectedWalletType === 'paypal' || ((selectedWalletType === 'manual' || selectedWalletType === 'offline') && walletData.preferredMethod === 'paypal')) ? (
                    <label className="field">
                      <span>PayPal email</span>
                      <input
                        className="native-input"
                        type="email"
                        value={walletData.paypalEmail}
                        onChange={(event) => setWalletData((prev) => ({ ...prev, paypalEmail: event.target.value }))}
                      />
                    </label>
                  ) : null}

                  {selectedWalletType === 'stripe' ? (
                    <label className="field">
                      <span>Stripe account ID</span>
                      <input
                        className="native-input"
                        value={walletData.stripeAccountId}
                        onChange={(event) => setWalletData((prev) => ({ ...prev, stripeAccountId: event.target.value }))}
                        placeholder="acct_..."
                      />
                    </label>
                  ) : null}

                  <label className="field">
                    <span>Currency</span>
                    <select
                      className="native-select"
                      value={walletData.currency}
                      onChange={(event) => setWalletData((prev) => ({ ...prev, currency: event.target.value }))}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="GHS">GHS</option>
                      <option value="NGN">NGN</option>
                      <option value="KES">KES</option>
                    </select>
                  </label>
                  <IonButton className="solid-cta" type="submit" expand="block" disabled={loading}>
                    {loading ? 'Saving...' : selectedWalletId ? 'Update wallet' : 'Add wallet'}
                  </IonButton>
                </form>
              </section>

              <section className="surface-card">
                <h3>Paystack automation</h3>
                <p className="muted-text">
                  {wallet?.paystackSubaccount ? 'Connected: ' + wallet.paystackSubaccount : 'Not connected yet'}
                </p>
                <div className="auth-form">
                  <label className="field">
                    <span>Country</span>
                    <select
                      className="native-select"
                      value={paystackSetup.country}
                      onChange={(event) => {
                        const country = event.target.value;
                        const currency = country === 'nigeria' ? 'NGN' : 'GHS';
                        setPaystackSetup((prev) => ({ ...prev, country, currency, bankCode: '' }));
                        void loadPaystackBanks(country, currency);
                      }}
                    >
                      <option value="ghana">Ghana</option>
                      <option value="nigeria">Nigeria</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Currency</span>
                    <select
                      className="native-select"
                      value={paystackSetup.currency}
                      onChange={(event) => setPaystackSetup((prev) => ({ ...prev, currency: event.target.value }))}
                    >
                      <option value="GHS">GHS</option>
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Bank</span>
                    <select
                      className="native-select"
                      value={paystackSetup.bankCode}
                      onChange={(event) => setPaystackSetup((prev) => ({ ...prev, bankCode: event.target.value }))}
                    >
                      <option value="">Select bank</option>
                      {paystackBanks.map((bank) => (
                        <option key={bank.code} value={bank.code}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Account number</span>
                    <input
                      className="native-input"
                      value={paystackSetup.accountNumber}
                      onChange={(event) =>
                        setPaystackSetup((prev) => ({
                          ...prev,
                          accountNumber: event.target.value.replace(/[^\d]/g, '').slice(0, 12)
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Business name (optional)</span>
                    <input
                      className="native-input"
                      value={paystackSetup.businessName}
                      onChange={(event) => setPaystackSetup((prev) => ({ ...prev, businessName: event.target.value }))}
                    />
                  </label>
                  <IonButton className="solid-cta" expand="block" onClick={onConnectPaystack} disabled={paystackLoading || disablePaystackConnect}>
                    {paystackLoading ? 'Connecting...' : isPaystackMethod ? 'Reconnect Paystack' : 'Connect Paystack'}
                  </IonButton>
                  {disablePaystackConnect ? (
                    <p className="muted-text">Manual/offline wallet is active. Disable it before Paystack automation.</p>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}

          {tab === 'notifications' ? (
            <section className="surface-card">
              <h3>Notification preferences</h3>
              <p className="muted-text">Control delivery channels, content types, and mobile behavior.</p>

              <div className="surface-card">
                <h4>Delivery methods</h4>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.emailEnabled}
                    onChange={(event) => setNotificationPrefs((prev) => ({ ...prev, emailEnabled: event.target.checked }))}
                  />
                  <span>Email notifications</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.smsEnabled}
                    onChange={(event) => setNotificationPrefs((prev) => ({ ...prev, smsEnabled: event.target.checked }))}
                  />
                  <span>SMS notifications</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.pushEnabled}
                    onChange={(event) => setNotificationPrefs((prev) => ({ ...prev, pushEnabled: event.target.checked }))}
                  />
                  <span>Push notifications</span>
                </label>
              </div>

              <div className="surface-card">
                <h4>Notification content</h4>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.notifyRsvp}
                    onChange={(event) => setNotificationPrefs((prev) => ({ ...prev, notifyRsvp: event.target.checked }))}
                  />
                  <span>New RSVPs</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.notifyCheckIn}
                    onChange={(event) => setNotificationPrefs((prev) => ({ ...prev, notifyCheckIn: event.target.checked }))}
                  />
                  <span>Check-ins</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.notifyGift}
                    onChange={(event) => setNotificationPrefs((prev) => ({ ...prev, notifyGift: event.target.checked }))}
                  />
                  <span>Gifts received</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.notifyTicketSold}
                    onChange={(event) => setNotificationPrefs((prev) => ({ ...prev, notifyTicketSold: event.target.checked }))}
                  />
                  <span>Ticket sales</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.notifyMarketing}
                    onChange={(event) => setNotificationPrefs((prev) => ({ ...prev, notifyMarketing: event.target.checked }))}
                  />
                  <span>Marketing and tips</span>
                </label>
              </div>

              <div className="surface-card">
                <h4>Mobile only</h4>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.soundEnabled}
                    onChange={(event) =>
                      setNotificationPrefs((prev) => ({ ...prev, soundEnabled: event.target.checked }))
                    }
                  />
                  <span>Notification sound</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.hapticsEnabled}
                    onChange={(event) =>
                      setNotificationPrefs((prev) => ({ ...prev, hapticsEnabled: event.target.checked }))
                    }
                  />
                  <span>Haptic feedback</span>
                </label>
              </div>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={notificationPrefs.notificationsEnabled}
                  onChange={(event) =>
                    setNotificationPrefs((prev) => ({ ...prev, notificationsEnabled: event.target.checked }))
                  }
                />
                <span>Master notification switch</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={notificationPrefs.marketingEnabled}
                  onChange={(event) =>
                    setNotificationPrefs((prev) => ({ ...prev, marketingEnabled: event.target.checked }))
                  }
                />
                <span>Enable marketing campaigns</span>
              </label>

              <IonButton className="solid-cta" expand="block" disabled={loading} onClick={saveNotificationPrefs}>
                {loading ? 'Saving...' : 'Save notification settings'}
              </IonButton>
            </section>
          ) : null}

          {tab === 'support' ? (
            <section className="surface-card">
              <h3>FAQ and contact support</h3>
              <p className="muted-text">Use support channels below for account and event assistance.</p>
              {supportContent.supportEmail ? (
                <a className="inline-link" href={`mailto:${supportContent.supportEmail}`}>
                  Email: {supportContent.supportEmail}
                </a>
              ) : null}
              {supportContent.supportWhatsAppNumber ? (
                <a
                  className="inline-link"
                  href={`https://wa.me/${supportContent.supportWhatsAppNumber.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp: {supportContent.supportWhatsAppNumber}
                </a>
              ) : null}
              <div className="event-list">
                {supportContent.faq.length === 0 ? (
                  <p className="muted-text">No FAQ content configured yet.</p>
                ) : (
                  supportContent.faq.map((item, index) => (
                    <article key={index} className="event-list-item static stack">
                      <p className="event-title">{item.question}</p>
                      <p className="event-subline">{item.answer}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          ) : null}

          <section className="surface-card" style={{ marginTop: 8 }}>
            <IonButton color="danger" fill="outline" expand="block" onClick={onSignOut}>
              Sign out
            </IonButton>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default AccountPage;
