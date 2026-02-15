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
import { ownerDashboardApi } from '../api/client';
import type { OwnerEvent, OwnerStats } from '../types/domain';
import MetricCard from '../components/MetricCard';
import { useSessionStore } from '../store/session';
import { phaseLabel } from '../utils/format';

const formatMoney = (currency: string, amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const HomePage = () => {
  const router = useIonRouter();
  const owner = useSessionStore((state) => state.owner);
  const [present] = useIonToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [events, setEvents] = useState<OwnerEvent[]>([]);

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
      setStats(statsResponse.data.stats);
      setEvents(eventsResponse.data.events);
    } catch {
      present({ message: 'Unable to load dashboard', duration: 2000, color: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [present]);

  useIonViewWillEnter(() => {
    void loadData();
  });

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>Owner Home</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(event) => loadData().finally(() => event.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <main className="screen-content">
          <section className="hero-card">
            <p className="eyebrow">Welcome back</p>
            <h2>{owner?.name || 'Event Owner'}</h2>
            <p>Snapshot of live operations, attendance, and payout readiness for your events.</p>
            <div className="inline-row wrap">
              <button className="inline-link" onClick={() => router.push('/app/payouts', 'forward')}>Open payouts</button>
              <button className="inline-link" onClick={() => router.push('/app/account', 'forward')}>Account settings</button>
            </div>
          </section>

          {loading ? (
            <div className="metric-grid">
              <IonSkeletonText animated style={{ width: '100%', height: '90px', borderRadius: 16 }} />
              <IonSkeletonText animated style={{ width: '100%', height: '90px', borderRadius: 16 }} />
              <IonSkeletonText animated style={{ width: '100%', height: '90px', borderRadius: 16 }} />
              <IonSkeletonText animated style={{ width: '100%', height: '90px', borderRadius: 16 }} />
            </div>
          ) : (
            <div className="metric-grid">
              <MetricCard label="Events" value={stats?.totalEvents || 0} />
              <MetricCard label="RSVPs" value={stats?.totalRsvps || 0} />
              <MetricCard label="Check-ins" value={stats?.totalCheckIns || 0} />
              <MetricCard label="Top net revenue" value={topRevenue} />
            </div>
          )}

          <section className="surface-card">
            <header className="section-head">
              <h3>Priority events</h3>
              <button className="inline-link" onClick={() => router.push('/app/events', 'forward')}>
                See all
              </button>
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
                        {new Date(event.date).toLocaleDateString()} {event.venue ? '- ' + event.venue : ''}
                      </p>
                    </div>
                    <span className={'phase-chip phase-' + phaseValue.toLowerCase()}>{phaseLabel(phaseValue)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
