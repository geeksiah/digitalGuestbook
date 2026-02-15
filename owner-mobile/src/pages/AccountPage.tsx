import { FormEvent, useCallback, useMemo, useState } from 'react';
import {
  IonButton,
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

type AccountTab = 'profile' | 'password' | 'wallet';

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

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>Account</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(refresh) => loadWallet().finally(() => refresh.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <main className="screen-content">
          <section className="surface-card">
            <IonSegment value={tab} onIonChange={(event) => setTab((event.detail.value as AccountTab) || 'profile')}>
              <IonSegmentButton value="profile">Profile</IonSegmentButton>
              <IonSegmentButton value="password">Password</IonSegmentButton>
              <IonSegmentButton value="wallet">Wallet</IonSegmentButton>
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

          <section className="surface-card">
            <h3>Session</h3>
            <p className="muted-text">Signed in as {owner?.email || 'Unknown owner'}</p>
            <IonButton color="medium" expand="block" onClick={onSignOut}>
              Sign out
            </IonButton>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default AccountPage;
