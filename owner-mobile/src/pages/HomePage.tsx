import { useCallback, useMemo, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { useIonRouter } from '@ionic/react';
import { calendarOutline, checkmarkDoneOutline, peopleOutline, walletOutline } from 'ionicons/icons';
import { ownerDashboardApi } from '../api/client';
import type { OwnerEvent, OwnerStats } from '../types/domain';
import MetricCard from '../components/MetricCard';
import { useSessionStore } from '../store/session';
import { phaseLabel } from '../utils/format';

const formatMoney = (currency: string, amount: number) => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const safeCurrency = String(currency || '').toUpperCase();

  if (!/^[A-Z]{3}$/.test(safeCurrency)) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(safeAmount);
  }

  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency }).format(safeAmount);
  } catch {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(safeAmount);
  }
};

const HomePage = () => {
  const router = useIonRouter();
  const owner = useSessionStore((state) => state.owner);
  const [present] = useIonToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [events, setEvents] = useState<OwnerEvent[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; isRead: boolean; createdAt: string }>>([]);

  const topRevenue = useMemo(() => {
    if (!stats) return 'No revenue yet';
    const entries = Object.entries(stats.revenueByCurrency || {});
    if (!entries.length) return 'No revenue yet';
    const [currency, values] = entries[0];
    return formatMoney(currency, values.net);
  }, [stats]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsResponse, eventsResponse] = await Promise.all([
        ownerDashboardApi.stats(),
        ownerDashboardApi.events()
      ]);
      setStats(statsResponse.data?.stats ?? null);
      setEvents(Array.isArray(eventsResponse.data?.events) ? eventsResponse.data.events : []);
      const notificationsResponse = await ownerDashboardApi.notifications({ limit: 5 });
      setNotifications(notificationsResponse.data?.notifications || []);
    } catch {
      present({ message: 'Unable to load dashboard', duration: 2000, color: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [present]);

  useIonViewWillEnter(() => {
    void loadData();
  });

  const initials = (owner?.name || 'O').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(event) => loadData().finally(() => event.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <main className="screen-content">
          {/* Welcome */}
          <section className="hero-card">
            <div className="inline-row" style={{ gap: 12 }}>
              <div className="avatar-circle">{initials}</div>
              <div>
                <p className="eyebrow">Welcome back</p>
                <h2>{owner?.name || 'Event Owner'}</h2>
              </div>
            </div>
            <p style={{ marginTop: 4 }}>Your event operations at a glance.</p>
          </section>

          {/* Metrics */}
          {loading ? (
            <div className="metric-grid">
              <IonSkeletonText animated style={{ width: '100%', height: 80, borderRadius: 16 }} />
              <IonSkeletonText animated style={{ width: '100%', height: 80, borderRadius: 16 }} />
              <IonSkeletonText animated style={{ width: '100%', height: 80, borderRadius: 16 }} />
              <IonSkeletonText animated style={{ width: '100%', height: 80, borderRadius: 16 }} />
            </div>
          ) : (
            <div className="metric-grid">
              <MetricCard label="Events" value={stats?.totalEvents || 0} icon={calendarOutline} />
              <MetricCard label="RSVPs" value={stats?.totalRsvps || 0} icon={peopleOutline} />
              <MetricCard label="Check-ins" value={stats?.totalCheckIns || 0} icon={checkmarkDoneOutline} />
              <MetricCard label="Net Revenue" value={topRevenue} icon={walletOutline} />
            </div>
          )}

          {/* Quick actions */}
          <div className="quick-actions">
            <button className="quick-link" onClick={() => router.push('/app/payouts', 'forward')}>Payouts</button>
            <button className="quick-link" onClick={() => router.push('/app/analytics', 'forward')}>Analytics</button>
            <button className="quick-link" onClick={() => router.push('/app/events', 'forward')}>All events</button>
          </div>

          {/* Priority events */}
          <section className="surface-card">
            <header className="section-head">
              <h3>Priority events</h3>
              <button className="inline-link" onClick={() => router.push('/app/events', 'forward')}>See all</button>
            </header>

            {!events.length && !loading ? <p className="muted-text">No events assigned yet.</p> : null}

            <div className="event-list">
              {events.slice(0, 3).map((event) => {
                const phaseValue = String(event.currentPhase || 'PRE_EVENT');
                return (
                  <button
                    key={event.id}
                    className="event-list-item"
                    onClick={() => router.push('/app/events/' + event.id, 'forward')}
                  >
                    <div>
                      <p className="event-title">{event.name}</p>
                      <p className="event-subline">
                        {new Date(event.date).toLocaleDateString()}{event.venue ? ' \u00b7 ' + event.venue : ''}
                      </p>
                    </div>
                    <span className={'phase-chip phase-' + phaseValue.toLowerCase()}>{phaseLabel(phaseValue)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Notifications */}
          <section className="surface-card">
            <header className="section-head">
              <h3>
                Notifications
                {unreadCount > 0 ? (
                  <span className="status-pill tone-info" style={{ marginLeft: 8, verticalAlign: 'middle' }}>{unreadCount}</span>
                ) : null}
              </h3>
            </header>
            {!notifications.length ? <p className="muted-text">No notifications yet.</p> : null}
            <div className="event-list">
              {notifications.map((notification) => (
                <article key={notification.id} className="event-list-item static stack">
                  <div className="row-between">
                    <div className="inline-row" style={{ gap: 8 }}>
                      {!notification.isRead ? <span className="unread-dot" /> : null}
                      <p className="event-title">{notification.title}</p>
                    </div>
                  </div>
                  <p className="event-subline">{notification.body}</p>
                  <div className="inline-row wrap" style={{ gap: 8 }}>
                    <p className="event-subline">{new Date(notification.createdAt).toLocaleString()}</p>
                    {!notification.isRead ? (
                      <button
                        className="inline-link"
                        onClick={async () => {
                          await ownerDashboardApi.markNotificationRead(notification.id);
                          await loadData();
                        }}
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
