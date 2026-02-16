import {
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonToast
} from '@ionic/react';
import { useIonRouter } from '@ionic/react';
import {
  analyticsOutline,
  personOutline,
  helpCircleOutline,
  moonOutline,
  sunnyOutline,
  phonePortraitOutline,
  chevronForwardOutline,
  logOutOutline
} from 'ionicons/icons';
import { useSessionStore } from '../store/session';
import { useThemeStore } from '../store/theme';

const MorePage = () => {
  const router = useIonRouter();
  const [present] = useIonToast();
  const { owner, clearSession } = useSessionStore();
  const { mode, setMode } = useThemeStore();

  const initials = (owner?.name || 'O')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const cycleTheme = () => {
    const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setMode(next);
    present({ message: `Theme: ${next}`, duration: 1200, color: 'medium' });
  };

  const themeIcon = mode === 'dark' ? moonOutline : mode === 'system' ? phonePortraitOutline : sunnyOutline;
  const themeLabel = mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System';

  const onSignOut = () => {
    clearSession();
    present({ message: 'Signed out', duration: 1500, color: 'medium' });
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>More</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <main className="screen-content">
          {/* Profile header */}
          <section className="surface-card" style={{ textAlign: 'center', paddingTop: 28, paddingBottom: 20 }}>
            <div className="avatar-circle large" style={{ margin: '0 auto 12px' }}>{initials}</div>
            <p className="event-title">{owner?.name || 'Owner'}</p>
            <p className="event-subline">{owner?.email}</p>
          </section>

          {/* Menu items */}
          <section className="surface-card more-menu-list">
            <button className="more-menu-item" onClick={() => router.push('/app/analytics', 'forward')}>
              <IonIcon icon={analyticsOutline} />
              <span>Analytics</span>
              <IonIcon icon={chevronForwardOutline} className="chevron" />
            </button>
            <button className="more-menu-item" onClick={() => router.push('/app/account', 'forward')}>
              <IonIcon icon={personOutline} />
              <span>Account & Settings</span>
              <IonIcon icon={chevronForwardOutline} className="chevron" />
            </button>
            <button className="more-menu-item" onClick={cycleTheme}>
              <IonIcon icon={themeIcon} />
              <span>Theme: {themeLabel}</span>
              <span className="more-menu-badge">{themeLabel}</span>
            </button>
            <button className="more-menu-item" onClick={() => router.push('/app/support', 'forward')}>
              <IonIcon icon={helpCircleOutline} />
              <span>Help & Support</span>
              <IonIcon icon={chevronForwardOutline} className="chevron" />
            </button>
          </section>

          {/* Sign out */}
          <section className="surface-card">
            <button className="more-menu-item danger" onClick={onSignOut}>
              <IonIcon icon={logOutOutline} />
              <span>Sign out</span>
            </button>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default MorePage;
