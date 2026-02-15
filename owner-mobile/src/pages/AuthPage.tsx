import { FormEvent, useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonText,
  useIonRouter,
  useIonToast
} from '@ionic/react';
import { ownerAuthApi } from '../api/client';
import { useSessionStore } from '../store/session';
import { getErrorMessage } from '../utils/error';

type AuthMode = 'login' | 'register' | 'setup' | 'reset';

const AuthPage = () => {
  const router = useIonRouter();
  const [present] = useIonToast();
  const setSession = useSessionStore((state) => state.setSession);
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const labels = useMemo(() => {
    if (mode === 'register') return { title: 'Create owner account', cta: 'Create account' };
    if (mode === 'setup') return { title: 'Set your password', cta: 'Set password' };
    if (mode === 'reset') return { title: 'Request password reset', cta: 'Submit request' };
    return { title: 'Sign in to owner app', cta: 'Sign in' };
  }, [mode]);

  const notify = (message: string, color: 'success' | 'danger' = 'success') =>
    present({ message, duration: 2200, color, position: 'top' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      notify('Email is required', 'danger');
      return;
    }
    if (mode !== 'reset' && !password.trim()) {
      notify('Password is required', 'danger');
      return;
    }
    setLoading(true);

    try {
      if (mode === 'register') {
        const response = await ownerAuthApi.register({
          name,
          email,
          password,
          phone: phone || undefined,
          company: company || undefined
        });
        setSession(response.data.token, response.data.owner);
        notify('Account created');
        router.push('/app/home', 'root');
      } else if (mode === 'setup') {
        const response = await ownerAuthApi.setupPassword(email, password);
        setSession(response.data.token, response.data.owner);
        notify('Password set successfully');
        router.push('/app/home', 'root');
      } else if (mode === 'reset') {
        await ownerAuthApi.requestPasswordReset(email, resetReason || undefined);
        notify('Reset request submitted');
        setMode('login');
        setPassword('');
      } else {
        const response = await ownerAuthApi.login(email, password);
        setSession(response.data.token, response.data.owner);
        notify('Welcome back');
        router.push('/app/home', 'root');
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Authentication failed');
      if (message.includes('created by admin') || message.includes('set up your password')) {
        setMode('setup');
      }
      notify(message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const showRegisterSwitch = mode === 'login' || mode === 'register';

  return (
    <IonPage>
      <IonContent fullscreen className="auth-screen">
        <div className="auth-wrap">
          <div className="auth-hero">
            <div className="brand-mark">E</div>
            <h1>{labels.title}</h1>
            <p>Clean, fast owner operations built for live event conditions.</p>
          </div>

          {showRegisterSwitch ? (
            <IonSegment
              value={mode}
              onIonChange={(event) => setMode((event.detail.value as 'login' | 'register') || 'login')}
            >
              <IonSegmentButton value="login">Sign in</IonSegmentButton>
              <IonSegmentButton value="register">Sign up</IonSegmentButton>
            </IonSegment>
          ) : null}

          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' ? (
              <label className="field">
                <span>Full name</span>
                <input
                  className="native-input"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            ) : null}

            <label className="field">
              <span>Email</span>
              <input
                className="native-input"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            {mode !== 'reset' ? (
              <label className="field">
                <span>Password</span>
                <div className="input-row">
                  <input
                    className="native-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    className="toggle-inline"
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>
            ) : null}

            {mode === 'register' ? (
              <>
                <label className="field">
                  <span>Phone (optional)</span>
                  <input
                    className="native-input"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Company (optional)</span>
                  <input
                    className="native-input"
                    type="text"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                  />
                </label>
              </>
            ) : null}

            {mode === 'reset' ? (
              <label className="field">
                <span>Reason (optional)</span>
                <textarea
                  className="native-input native-textarea"
                  value={resetReason}
                  onChange={(event) => setResetReason(event.target.value)}
                />
              </label>
            ) : null}

            <IonButton className="solid-cta" type="submit" expand="block" disabled={loading}>
              {loading ? 'Please wait...' : labels.cta}
            </IonButton>
          </form>

          <div className="auth-alt-actions">
            {mode !== 'setup' ? (
              <IonButton fill="clear" size="small" onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}>
                {mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
              </IonButton>
            ) : (
              <IonButton fill="clear" size="small" onClick={() => setMode('login')}>
                Back to sign in
              </IonButton>
            )}
            {mode === 'setup' ? (
              <IonText color="medium" className="tiny-note">
                Your account exists already. Set a password to continue.
              </IonText>
            ) : null}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AuthPage;
