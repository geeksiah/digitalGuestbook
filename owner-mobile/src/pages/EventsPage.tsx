import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
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
import { calendarOutline } from 'ionicons/icons';
import { ownerDashboardApi } from '../api/client';
import type { OwnerEvent } from '../types/domain';
import { phaseLabel } from '../utils/format';
import DateFilter, { type DateRange } from '../components/DateFilter';

const EventsPage = () => {
  const router = useIonRouter();
  const [present] = useIonToast();
  const [events, setEvents] = useState<OwnerEvent[]>([]);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'PRE_EVENT' | 'LIVE' | 'POST_EVENT'>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [createData, setCreateData] = useState({
    name: '',
    slug: '',
    date: '',
    timezone: 'UTC',
    defaultCurrency: 'USD',
    venue: '',
  });

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

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

  useEffect(() => {
    if (!showCreate) return;
    const slug = createData.slug.trim().toLowerCase();
    if (!slug || slug.length < 2) {
      setSlugAvailable(null);
      setCheckingSlug(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setCheckingSlug(true);
      try {
        const response = await ownerDashboardApi.checkSlugAvailability(slug);
        setSlugAvailable(Boolean(response.data?.available));
      } catch {
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [createData.slug, showCreate]);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesPhase = phaseFilter === 'all' ? true : event.currentPhase === phaseFilter;
      if (!matchesPhase) return false;
      if (dateRange.from && dateRange.to) {
        const eventDate = new Date(event.date);
        if (eventDate < dateRange.from || eventDate > dateRange.to) return false;
      }
      if (!value) return true;
      return (
        event.name.toLowerCase().includes(value) ||
        event.slug.toLowerCase().includes(value) ||
        (event.venue || '').toLowerCase().includes(value)
      );
    });
  }, [events, phaseFilter, search, dateRange]);

  const createEvent = async () => {
    if (!createData.name.trim() || !createData.slug.trim() || !createData.date) {
      present({ message: 'Name, slug, and date are required', duration: 2000, color: 'danger' });
      return;
    }
    if (slugAvailable === false) {
      present({ message: 'Slug already exists. Please choose another one.', duration: 2200, color: 'danger' });
      return;
    }
    setCreating(true);
    try {
      await ownerDashboardApi.createEvent({
        name: createData.name.trim(),
        slug: createData.slug.trim().toLowerCase().replace(/\s+/g, '-'),
        date: new Date(createData.date).toISOString(),
        timezone: createData.timezone || 'UTC',
        defaultCurrency: createData.defaultCurrency || 'USD',
        venue: createData.venue || undefined,
      });
      present({ message: 'Event created and submitted for admin approval', duration: 2200, color: 'success' });
      setShowCreate(false);
      setSlugManuallyEdited(false);
      setSlugAvailable(null);
      setCreateData({ name: '', slug: '', date: '', timezone: 'UTC', defaultCurrency: 'USD', venue: '' });
      await load();
    } catch {
      present({ message: 'Failed to create event', duration: 2000, color: 'danger' });
    } finally {
      setCreating(false);
    }
  };

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
            <div className="row-between">
              <h3>Create event</h3>
              <IonButton
                size="small"
                fill="outline"
                onClick={() => {
                  setShowCreate((prev) => {
                    const next = !prev;
                    if (!next) {
                      setSlugManuallyEdited(false);
                      setSlugAvailable(null);
                    }
                    return next;
                  });
                }}
              >
                {showCreate ? 'Close' : 'Quick create'}
              </IonButton>
            </div>
            {showCreate ? (
              <div className="auth-form">
                <label className="field">
                  <span>Event name</span>
                  <input
                    className="native-input"
                    value={createData.name}
                    onChange={(event) =>
                      setCreateData((prev) => {
                        const name = event.target.value;
                        return {
                          ...prev,
                          name,
                          slug: slugManuallyEdited ? prev.slug : slugify(name),
                        };
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Event slug</span>
                  <input
                    className="native-input"
                    value={createData.slug}
                    onChange={(event) => {
                      setSlugManuallyEdited(true);
                      setSlugAvailable(null);
                      setCreateData((prev) => ({ ...prev, slug: slugify(event.target.value) }));
                    }}
                    placeholder="my-event-2026"
                  />
                  {checkingSlug ? <p className="muted-text">Checking slug...</p> : null}
                  {!checkingSlug && slugAvailable === true ? <p className="muted-text" style={{ color: 'var(--success)' }}>Slug is available.</p> : null}
                  {!checkingSlug && slugAvailable === false ? <p className="muted-text" style={{ color: 'var(--danger)' }}>Slug is already taken.</p> : null}
                </label>
                <label className="field">
                  <span>Date</span>
                  <input
                    className="native-input"
                    type="datetime-local"
                    value={createData.date}
                    onChange={(event) => setCreateData((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Default currency</span>
                  <select
                    className="native-select"
                    value={createData.defaultCurrency}
                    onChange={(event) => setCreateData((prev) => ({ ...prev, defaultCurrency: event.target.value }))}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="GHS">GHS</option>
                    <option value="KES">KES</option>
                    <option value="NGN">NGN</option>
                  </select>
                </label>
                <label className="field">
                  <span>Venue (optional)</span>
                  <input
                    className="native-input"
                    value={createData.venue}
                    onChange={(event) => setCreateData((prev) => ({ ...prev, venue: event.target.value }))}
                  />
                </label>
                <IonButton className="solid-cta" expand="block" disabled={creating} onClick={createEvent}>
                  {creating ? 'Creating...' : 'Create and submit'}
                </IonButton>
              </div>
            ) : (
              <p className="muted-text">New events start in pending review until admin approval.</p>
            )}
          </section>

          <DateFilter value={dateRange} onChange={setDateRange} />

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
            {!filtered.length ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <IonIcon icon={calendarOutline} />
                </div>
                <p>No matching events found.</p>
              </div>
            ) : null}
            {filtered.map((event) => (
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
                  <p className="event-subline">
                    {event._count.rsvps} RSVPs &middot; {event._count.checkIns} check-ins &middot; {event._count.mediaAssets} media
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
