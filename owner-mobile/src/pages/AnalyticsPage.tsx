import { useCallback, useMemo, useState } from 'react';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { barChartOutline } from 'ionicons/icons';
import { ownerDashboardApi } from '../api/client';
import type { OwnerEvent, OwnerStats, PayoutResponse } from '../types/domain';
import { formatCurrency } from '../utils/format';
import { getErrorMessage } from '../utils/error';
import MetricCard from '../components/MetricCard';
import DateFilter, { type DateRange } from '../components/DateFilter';

type Tab = 'overview' | 'revenue' | 'events';

const AnalyticsPage = () => {
  const [present] = useIonToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [events, setEvents] = useState<OwnerEvent[]>([]);
  const [payoutData, setPayoutData] = useState<PayoutResponse | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, eventsRes, payoutsRes] = await Promise.all([
        ownerDashboardApi.stats(),
        ownerDashboardApi.events(),
        ownerDashboardApi.payouts()
      ]);
      setStats(statsRes.data.stats);
      setEvents(eventsRes.data.events);
      setPayoutData(payoutsRes.data);
    } catch (error: unknown) {
      present({ message: getErrorMessage(error, 'Failed to load analytics'), duration: 2200, color: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [present]);

  useIonViewWillEnter(() => { void load(); });

  const filteredEvents = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return events;
    return events.filter((e) => {
      const d = new Date(e.date);
      return d >= dateRange.from! && d <= dateRange.to!;
    });
  }, [events, dateRange]);

  const totalRevenue = useMemo(() => {
    if (!stats?.revenueByCurrency) return [];
    return Object.entries(stats.revenueByCurrency).map(([currency, data]) => ({
      currency,
      gross: data.gross,
      net: data.net
    }));
  }, [stats]);

  const eventPerformance = useMemo(() => {
    return filteredEvents.map((e) => {
      const total = e._count.rsvps + e._count.checkIns + e._count.mediaAssets;
      return { ...e, engagementScore: total };
    }).sort((a, b) => b.engagementScore - a.engagementScore);
  }, [filteredEvents]);

  const phaseBreakdown = useMemo(() => {
    const counts = { PRE_EVENT: 0, LIVE: 0, POST_EVENT: 0 };
    filteredEvents.forEach((e) => {
      if (e.currentPhase in counts) counts[e.currentPhase as keyof typeof counts]++;
    });
    return counts;
  }, [filteredEvents]);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/app/more" /></IonButtons>
          <IonTitle>Analytics</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(r) => load().finally(() => r.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <main className="screen-content">
          <DateFilter value={dateRange} onChange={setDateRange} />

          <section className="surface-card">
            <IonSegment
              value={tab}
              onIonChange={(e) => setTab((e.detail.value as Tab) || 'overview')}
            >
              <IonSegmentButton value="overview">Overview</IonSegmentButton>
              <IonSegmentButton value="revenue">Revenue</IonSegmentButton>
              <IonSegmentButton value="events">Events</IonSegmentButton>
            </IonSegment>
          </section>

          {tab === 'overview' && (
            <>
              <div className="metric-grid">
                <MetricCard label="Total Events" value={stats?.totalEvents || 0} />
                <MetricCard label="Total RSVPs" value={stats?.totalRsvps || 0} />
                <MetricCard label="Check-ins" value={stats?.totalCheckIns || 0} />
                <MetricCard label="Media" value={stats?.totalMedia || 0} />
                {stats?.totalGiftOrders ? (
                  <MetricCard label="Gift Orders" value={stats.totalGiftOrders} />
                ) : null}
              </div>

              <section className="surface-card">
                <h3>Event Phases</h3>
                <div className="analytics-bars">
                  {Object.entries(phaseBreakdown).map(([phase, count]) => {
                    const max = Math.max(...Object.values(phaseBreakdown), 1);
                    const pct = Math.round((count / max) * 100);
                    const label = phase === 'PRE_EVENT' ? 'Upcoming' : phase === 'LIVE' ? 'Live' : 'Past';
                    return (
                      <div className="analytics-bar-row" key={phase}>
                        <span className="analytics-bar-label">{label}</span>
                        <div className="analytics-bar-track">
                          <div className="analytics-bar-fill" style={{ width: pct + '%' }} />
                        </div>
                        <span className="analytics-bar-value">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {tab === 'revenue' && (
            <>
              <section className="hero-card compact">
                <p className="balance-label">Total Available</p>
                <p className="balance-amount">
                  {formatCurrency('USD', payoutData?.overallTotals.availableBalance || 0)}
                </p>
                <div className="inline-row wrap" style={{ gap: 16, marginTop: 4 }}>
                  <span className="event-subline">
                    Pending: {formatCurrency('USD', payoutData?.overallTotals.pendingAmount || 0)}
                  </span>
                  <span className="event-subline">
                    Fulfilled: {formatCurrency('USD', payoutData?.overallTotals.fulfilledAmount || 0)}
                  </span>
                </div>
              </section>

              {totalRevenue.length > 0 && (
                <section className="surface-card">
                  <h3>Revenue by Currency</h3>
                  <div className="event-list">
                    {totalRevenue.map((r) => (
                      <article className="event-list-item static stack" key={r.currency}>
                        <div className="row-between">
                          <p className="event-title">{r.currency}</p>
                        </div>
                        <p className="event-subline">
                          Gross: {formatCurrency(r.currency, r.gross)} &middot; Net: {formatCurrency(r.currency, r.net)}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {payoutData && payoutData.eventTotals.length > 0 && (
                <section className="surface-card">
                  <h3>Revenue by Event</h3>
                  <div className="event-list">
                    {payoutData.eventTotals.map((et) => (
                      <article className="event-list-item static stack" key={et.eventId}>
                        <div className="row-between">
                          <p className="event-title">{et.eventName}</p>
                          <span className="event-subline">{formatCurrency(et.currency, et.availableBalance)}</span>
                        </div>
                        <p className="event-subline">
                          Net: {formatCurrency(et.currency, et.totalNet)} &middot; {et.payoutCount} payouts
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {tab === 'events' && (
            <section className="surface-card">
              <h3>Event Performance</h3>
              {!eventPerformance.length && !loading ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <IonIcon icon={barChartOutline} />
                  </div>
                  <p>No events to analyze.</p>
                </div>
              ) : null}
              <div className="event-list">
                {eventPerformance.map((e) => (
                  <article className="event-list-item static stack" key={e.id}>
                    <div className="row-between">
                      <p className="event-title">{e.name}</p>
                      <span className={'phase-chip phase-' + String(e.currentPhase || '').toLowerCase()}>
                        {e.currentPhase === 'PRE_EVENT' ? 'Upcoming' : e.currentPhase === 'LIVE' ? 'Live' : 'Past'}
                      </span>
                    </div>
                    <p className="event-subline">
                      {e._count.rsvps} RSVPs &middot; {e._count.checkIns} check-ins &middot; {e._count.mediaAssets} media
                    </p>
                    <div className="analytics-bar-track" style={{ marginTop: 6 }}>
                      <div
                        className="analytics-bar-fill"
                        style={{
                          width: Math.min(100, Math.round((e.engagementScore / Math.max(eventPerformance[0]?.engagementScore || 1, 1)) * 100)) + '%'
                        }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
};

export default AnalyticsPage;
