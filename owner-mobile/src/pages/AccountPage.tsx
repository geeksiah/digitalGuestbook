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
import type { PaystackBank, Wallet } from '../types/domain';
import { getErrorMessage } from '../utils/error';

type AccountTab = 'profile' | 'password' | 'wallet' | 'notifications' | 'support';

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
    company: owner?.company || ''
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
          preferredMethod: nextWallet.preferredMethod || 'bank',
          currency: nextWallet.currency || 'USD',
          autoPayoutEnabled: Boolean(nextWallet.autoPayoutEnabled),
          autoPayoutThreshold: nextWallet.autoPayoutThreshold || 100
        });
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
      company: owner?.company || ''
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

  const isPaystackMethod = useMemo(() => walletData.preferredMethod === 'paystack', [walletData.preferredMethod]);

  const onSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await ownerAuthApi.updateProfile({
        name: profileData.name || undefined,
        email: profileData.email || undefined,
        phone: profileData.phone || undefined,
        company: profileData.company || undefined
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
      const payload: Partial<Wallet> = {
        bankName: walletData.bankName || undefined,
        accountName: walletData.accountName || undefined,
        accountNumber: walletData.accountNumber || undefined,
        routingNumber: walletData.routingNumber || undefined,
        swiftCode: walletData.swiftCode || undefined,
        mobileProvider: walletData.mobileProvider || undefined,
        mobileNumber: walletData.mobileNumber || undefined,
        paypalEmail: walletData.paypalEmail || undefined,
        preferredMethod: walletData.preferredMethod,
        currency: walletData.currency,
        autoPayoutEnabled: walletData.autoPayoutEnabled,
        autoPayoutThreshold: walletData.autoPayoutThreshold
      };
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
      await ownerDashboardApi.connectPaystack({
        bankCode: paystackSetup.bankCode,
        accountNumber: paystackSetup.accountNumber,
        businessName: paystackSetup.businessName || owner?.company || owner?.name || undefined,
        country: paystackSetup.country,
        currency: paystackSetup.currency,
        setAsPreferred: true
      });
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
                <h3>Wallet settings</h3>
                <form className="auth-form" onSubmit={onSaveWallet}>
                  <label className="field">
                    <span>Preferred payout method</span>
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
                      <option value="paystack">Paystack</option>
                      <option value="stripe">Stripe</option>
                    </select>
                  </label>

                  {walletData.preferredMethod === 'bank' ? (
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
                  ) : null}

                  {walletData.preferredMethod === 'mobile' ? (
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
                  ) : null}

                  {walletData.preferredMethod === 'paypal' ? (
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
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={walletData.autoPayoutEnabled}
                      onChange={(event) =>
                        setWalletData((prev) => ({ ...prev, autoPayoutEnabled: event.target.checked }))
                      }
                    />
                    <span>Enable auto payout</span>
                  </label>
                  {walletData.autoPayoutEnabled ? (
                    <label className="field">
                      <span>Auto payout threshold</span>
                      <input
                        className="native-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={walletData.autoPayoutThreshold}
                        onChange={(event) =>
                          setWalletData((prev) => ({
                            ...prev,
                            autoPayoutThreshold: Number(event.target.value || 0)
                          }))
                        }
                      />
                    </label>
                  ) : null}
                  <IonButton className="solid-cta" type="submit" expand="block" disabled={loading}>
                    {loading ? 'Saving...' : 'Save wallet'}
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
                  <IonButton className="solid-cta" expand="block" onClick={onConnectPaystack} disabled={paystackLoading}>
                    {paystackLoading ? 'Connecting...' : isPaystackMethod ? 'Reconnect Paystack' : 'Connect Paystack'}
                  </IonButton>
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
