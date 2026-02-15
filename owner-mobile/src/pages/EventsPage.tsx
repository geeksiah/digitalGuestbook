import { useCallback, useMemo, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { useIonRouter } from '@ionic/react';
import { ownerDashboardApi } from '../api/client';
import type { OwnerEvent } from '../types/domain';
import { phaseLabel } from '../utils/format';

const EventsPage = () => {
  const router = useIonRouter();
  const [present] = useIonToast();
  const [events, setEvents] = useState<OwnerEvent[]>([]);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'PRE_EVENT' | 'LIVE' | 'POST_EVENT'>('all');

  const load = useCallback(async () => {
    try {
      const response = await ownerDashboardApi.events();
      setEvents(response.data.events);
    } catch {
      present({ message: 'Unable to load events', duration: 2000, color: 'danger' });
    }
  }, [present]);

  useIonViewWillEnter(() => {
    void load();
  });

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesPhase = phaseFilter === 'all' ? true : event.currentPhase === phaseFilter;
      if (!matchesPhase) return false;
      if (!value) return true;
      return (
        event.name.toLowerCase().includes(value) ||
        event.slug.toLowerCase().includes(value) ||
        (event.venue || '').toLowerCase().includes(value)
      );
    });
  }, [events, phaseFilter, search]);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>Events</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(event) => load().finally(() => event.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <main className="screen-content">
          <section className="surface-card">
            <h3>Phase filter</h3>
            <IonSegment
              scrollable={true}
              value={phaseFilter}
              onIonChange={(event) => setPhaseFilter((event.detail.value as 'all' | 'PRE_EVENT' | 'LIVE' | 'POST_EVENT') || 'all')}
            >
              <IonSegmentButton value="all">All</IonSegmentButton>
              <IonSegmentButton value="PRE_EVENT">Upcoming</IonSegmentButton>
              <IonSegmentButton value="LIVE">Live</IonSegmentButton>
              <IonSegmentButton value="POST_EVENT">Past</IonSegmentButton>
            </IonSegment>
            <p className="muted-text">Showing {filtered.length} of {events.length} events</p>
          </section>

          <IonSearchbar
            value={search}
            debounce={200}
            placeholder="Search events"
            onIonInput={(event) => setSearch(event.detail.value || '')}
          />

          <section className="surface-card event-list">
            {!filtered.length ? <p className="muted-text">No matching events.</p> : null}
            {filtered.map((event) => (
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
                  <p className="event-subline">
                    {event._count.rsvps} RSVPs - {event._count.checkIns} check-ins - {event._count.mediaAssets} media
                  </p>
                </div>
                <span className={'phase-chip phase-' + String(event.currentPhase || '').toLowerCase()}>
                  {phaseLabel(event.currentPhase)}
                </span>
              </button>
            ))}
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default EventsPage;
