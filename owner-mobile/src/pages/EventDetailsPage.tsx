import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
  useIonToast
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { itineraryApi, ownerDashboardApi } from '../api/client';
import type {
  CheckIn,
  DomainRecord,
  GiftOrder,
  ItineraryItem,
  MediaAsset,
  OwnerEvent,
  RSVP,
  RsvpInvite,
  TicketType
} from '../types/domain';
import { copyText, formatCurrency, formatDate, formatDateTime, phaseLabel, statusToneClass } from '../utils/format';
import { getErrorMessage } from '../utils/error';

type EventTab = 'overview' | 'rsvps' | 'checkin' | 'media' | 'tickets' | 'itinerary' | 'invites' | 'domains' | 'gifts';

const cnameTarget = import.meta.env.VITE_DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com';

const EventDetailsPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [present] = useIonToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<EventTab>('overview');
  const [event, setEvent] = useState<OwnerEvent | null>(null);

  const [rsvpFilter, setRsvpFilter] = useState('all');
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [reviewingRsvpId, setReviewingRsvpId] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [domainHost, setDomainHost] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const [invites, setInvites] = useState<RsvpInvite[]>([]);
  const [inviteLines, setInviteLines] = useState('');
  const [inviteExpiryHours, setInviteExpiryHours] = useState(240);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [giftOrders, setGiftOrders] = useState<GiftOrder[]>([]);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [creatingMcLink, setCreatingMcLink] = useState(false);
  const [mcControlUrl, setMcControlUrl] = useState('');
  const [newItinerary, setNewItinerary] = useState({
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    location: ''
  });

  const toastError = (error: unknown, fallback: string) => {
    present({ message: getErrorMessage(error, fallback), duration: 2200, color: 'danger' });
  };

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const response = await ownerDashboardApi.event(eventId);
      setEvent(response.data.event);
    } catch (error: unknown) {
      toastError(error, 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const loadRsvps = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.rsvps(eventId, rsvpFilter);
      setRsvps(response.data.rsvps || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load RSVPs');
    }
  }, [eventId, rsvpFilter]);

  const loadCheckins = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.checkins(eventId);
      setCheckins(response.data.checkIns || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load check-ins');
    }
  }, [eventId]);

  const loadMedia = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.media(eventId);
      setMedia(response.data.media || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load media');
    }
  }, [eventId]);

  const loadTickets = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.tickets(eventId);
      setTickets(response.data.tickets || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load tickets');
    }
  }, [eventId]);

  const loadDomains = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.domains(eventId);
      setDomains(response.data.domains || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load domains');
    }
  }, [eventId]);

  const loadInvites = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.invites(eventId);
      setInvites(response.data.invites || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load invites');
    }
  }, [eventId]);

  const loadGifts = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.gifts(eventId);
      setGiftOrders(response.data.orders || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load gift orders');
    }
  }, [eventId]);

  const loadItinerary = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await itineraryApi.getItems(eventId);
      setItineraryItems(response.data.items || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load itinerary');
    }
  }, [eventId]);

  const loadForTab = useCallback(async (tab: EventTab) => {
    if (tab === 'rsvps') await loadRsvps();
    if (tab === 'checkin') await loadCheckins();
    if (tab === 'media') await loadMedia();
    if (tab === 'tickets') await loadTickets();
    if (tab === 'domains') await loadDomains();
    if (tab === 'invites') await loadInvites();
    if (tab === 'gifts') await loadGifts();
    if (tab === 'itinerary') await loadItinerary();
  }, [loadCheckins, loadDomains, loadGifts, loadInvites, loadItinerary, loadMedia, loadRsvps, loadTickets]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    if (!event) return;
    void loadForTab(activeTab);
  }, [activeTab, event, loadForTab]);

  useEffect(() => {
    if (activeTab !== 'rsvps' || !event) return;
    void loadRsvps();
  }, [activeTab, event, loadRsvps]);

  const onRefresh = async () => {
    await loadEvent();
    await loadForTab(activeTab);
  };

  const tabCounts = useMemo(() => ({
    rsvps: event?._count.rsvps || 0,
    checkin: event?._count.checkIns || 0,
    media: event?._count.mediaAssets || 0,
    tickets: tickets.length,
    itinerary: itineraryItems.length,
    invites: invites.length,
    domains: domains.length,
    gifts: giftOrders.length
  }), [domains.length, event?._count.checkIns, event?._count.mediaAssets, event?._count.rsvps, giftOrders.length, invites.length, itineraryItems.length, tickets.length]);

  const copyEventLink = async () => {
    if (!event) return;
    const ok = await copyText(`${window.location.origin}/e/${event.slug}`);
    present({ message: ok ? 'Event link copied' : 'Unable to copy link', duration: 1800, color: ok ? 'success' : 'danger' });
  };

  const copyMcLink = async () => {
    if (!mcControlUrl) return;
    const ok = await copyText(mcControlUrl);
    present({ message: ok ? 'MC link copied' : 'Unable to copy MC link', duration: 1800, color: ok ? 'success' : 'danger' });
  };

  const reviewRsvp = async (rsvpId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!eventId) return;
    setReviewingRsvpId(rsvpId);
    try {
      await ownerDashboardApi.reviewRsvp(eventId, rsvpId, status);
      present({ message: status === 'APPROVED' ? 'RSVP approved' : 'RSVP rejected', duration: 1800, color: 'success' });
      await Promise.all([loadRsvps(), loadEvent()]);
    } catch (error: unknown) {
      toastError(error, 'Failed to review RSVP');
    } finally {
      setReviewingRsvpId(null);
    }
  };

  const parseInviteLines = (raw: string): Array<{ name?: string; phone: string; email?: string }> => {
    return raw.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split(',').map((part) => part.trim());
      if (parts.length === 1) return { phone: parts[0] };
      if (parts.length === 2) return { name: parts[0], phone: parts[1] };
      return { name: parts[0], phone: parts[1], email: parts[2] };
    }).filter((invite) => Boolean(invite.phone));
  };

  const exportToCsv = (fileName: string, headers: string[], rows: Array<Array<string | number>>) => {
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportRsvps = () => {
    if (!event) return;
    const headers = ['Name', 'Email', 'Phone', 'Attendance', 'Guest Count', 'Status', 'Submitted At'];
    const rows = rsvps.map((item) => [
      item.primaryName,
      item.email || '',
      item.phone || '',
      item.attendance,
      item.guestCount,
      item.status,
      formatDateTime(item.submittedAt)
    ]);
    exportToCsv(`rsvps-${event.slug}.csv`, headers, rows);
  };

  const exportCheckins = () => {
    if (!event) return;
    const headers = ['Guest Name', 'Guest Count', 'Access Code', 'Method', 'Checked In At'];
    const rows = checkins.map((item) => [
      item.invitation.guestName,
      item.invitation.guestCount,
      item.invitation.accessCode,
      item.method,
      formatDateTime(item.checkedInAt)
    ]);
    exportToCsv(`checkins-${event.slug}.csv`, headers, rows);
  };

  const addItinerary = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!eventId) return;
    if (!newItinerary.title.trim()) {
      present({ message: 'Title is required', duration: 1800, color: 'danger' });
      return;
    }
    setSavingItinerary(true);
    try {
      await itineraryApi.createItem(eventId, {
        title: newItinerary.title.trim(),
        description: newItinerary.description || undefined,
        startsAt: newItinerary.startsAt ? new Date(newItinerary.startsAt).toISOString() : undefined,
        endsAt: newItinerary.endsAt ? new Date(newItinerary.endsAt).toISOString() : undefined,
        location: newItinerary.location || undefined
      });
      setNewItinerary({ title: '', description: '', startsAt: '', endsAt: '', location: '' });
      present({ message: 'Itinerary item added', duration: 1800, color: 'success' });
      await loadItinerary();
    } catch (error: unknown) {
      toastError(error, 'Failed to add itinerary item');
    } finally {
      setSavingItinerary(false);
    }
  };

  const toggleItineraryItem = async (item: ItineraryItem) => {
    if (!eventId) return;
    try {
      await itineraryApi.updateItem(eventId, item.id, { isCompleted: !item.isCompleted });
      await loadItinerary();
    } catch (error: unknown) {
      toastError(error, 'Failed to update itinerary item');
    }
  };

  const deleteItineraryItem = async (itemId: string) => {
    if (!eventId) return;
    try {
      await itineraryApi.deleteItem(eventId, itemId);
      present({ message: 'Itinerary item deleted', duration: 1800, color: 'success' });
      await loadItinerary();
    } catch (error: unknown) {
      toastError(error, 'Failed to delete itinerary item');
    }
  };

  const reorderItinerary = async (itemId: string, direction: 'up' | 'down') => {
    if (!eventId) return;
    const index = itineraryItems.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= itineraryItems.length) return;

    const previous = [...itineraryItems];
    const next = [...itineraryItems];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setItineraryItems(next);

    try {
      await itineraryApi.reorderItems(
        eventId,
        next.map((item) => item.id)
      );
    } catch (error: unknown) {
      setItineraryItems(previous);
      toastError(error, 'Failed to reorder itinerary');
    }
  };

  const createMcControlLink = async () => {
    if (!eventId) return;
    setCreatingMcLink(true);
    try {
      const response = await itineraryApi.createMcSession(eventId);
      if (!event?.slug || !response.data.sessionToken) {
        throw new Error('MC token missing');
      }
      setMcControlUrl(`${window.location.origin}/e/${event.slug}/itinerary/mc/${response.data.sessionToken}`);
      present({ message: 'MC control link generated', duration: 1800, color: 'success' });
    } catch (error: unknown) {
      toastError(error, 'Failed to create MC control link');
    } finally {
      setCreatingMcLink(false);
    }
  };

  const addDomain = async () => {
    if (!eventId || !domainHost.trim()) {
      present({ message: 'Domain host is required', duration: 1800, color: 'danger' });
      return;
    }
    setSavingDomain(true);
    try {
      await ownerDashboardApi.addDomain(eventId, domainHost.trim());
      setDomainHost('');
      present({ message: 'Domain added', duration: 1800, color: 'success' });
      await loadDomains();
    } catch (error: unknown) {
      toastError(error, 'Failed to add domain');
    } finally {
      setSavingDomain(false);
    }
  };

  const verifyDomain = async (domainId: string) => {
    if (!eventId) return;
    try {
      await ownerDashboardApi.verifyDomain(eventId, domainId);
      await loadDomains();
    } catch (error: unknown) {
      toastError(error, 'Failed to verify domain');
    }
  };

  const makePrimaryDomain = async (domainId: string) => {
    if (!eventId) return;
    try {
      await ownerDashboardApi.setPrimaryDomain(eventId, domainId);
      await loadDomains();
    } catch (error: unknown) {
      toastError(error, 'Failed to set primary domain');
    }
  };

  const removeDomain = async (domainId: string) => {
    if (!eventId) return;
    try {
      await ownerDashboardApi.deleteDomain(eventId, domainId);
      await loadDomains();
    } catch (error: unknown) {
      toastError(error, 'Failed to remove domain');
    }
  };

  const sendInvites = async () => {
    if (!eventId) return;
    const parsed = parseInviteLines(inviteLines);
    if (!parsed.length) {
      present({ message: 'Add at least one invite line', duration: 1800, color: 'danger' });
      return;
    }
    setSendingInvites(true);
    try {
      const response = await ownerDashboardApi.sendInvites(eventId, { invites: parsed, expiresInHours: inviteExpiryHours });
      setInviteLines('');
      present({ message: `Sent ${String(response.data.sentCount || 0)} invite(s)`, duration: 1800, color: 'success' });
      await loadInvites();
    } catch (error: unknown) {
      toastError(error, 'Failed to send invites');
    } finally {
      setSendingInvites(false);
    }
  };

  const resendInvite = async (inviteId: string) => {
    if (!eventId) return;
    try {
      await ownerDashboardApi.resendInvite(eventId, inviteId);
      await loadInvites();
    } catch (error: unknown) {
      toastError(error, 'Failed to resend invite');
    }
  };

  const inviteStats = useMemo(() => {
    return invites.reduce(
      (acc, invite) => {
        acc.total += 1;
        if (invite.status === 'SENT') acc.sent += 1;
        if (invite.status === 'OPENED') acc.opened += 1;
        if (invite.status === 'RESPONDED') acc.responded += 1;
        if (invite.status === 'EXPIRED') acc.expired += 1;
        return acc;
      },
      { total: 0, sent: 0, opened: 0, responded: 0, expired: 0 }
    );
  }, [invites]);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/events" />
          </IonButtons>
          <IonTitle>{event?.name || 'Event details'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(refresh) => onRefresh().finally(() => refresh.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <main className="screen-content">
          {!loading && event ? (
            <>
              <section className="hero-card compact">
                <p className="eyebrow">Event</p>
                <h2>{event.name}</h2>
                <p>{formatDateTime(event.date)} {event.venue ? '- ' + event.venue : ''}</p>
                <div className="inline-row">
                  <span className={'phase-chip phase-' + String(event.currentPhase).toLowerCase()}>{phaseLabel(event.currentPhase)}</span>
                  <IonButton size="small" fill="outline" onClick={copyEventLink}>Copy public link</IonButton>
                </div>
              </section>

              <section className="surface-card">
                <IonSegment scrollable={true} value={activeTab} onIonChange={(segmentEvent) => setActiveTab((segmentEvent.detail.value as EventTab) || 'overview')}>
                  <IonSegmentButton value="overview">Overview</IonSegmentButton>
                  <IonSegmentButton value="rsvps">RSVPs {tabCounts.rsvps}</IonSegmentButton>
                  <IonSegmentButton value="checkin">Check-in {tabCounts.checkin}</IonSegmentButton>
                  <IonSegmentButton value="media">Media {tabCounts.media}</IonSegmentButton>
                  <IonSegmentButton value="tickets">Tickets {tabCounts.tickets}</IonSegmentButton>
                  <IonSegmentButton value="itinerary">Itinerary {tabCounts.itinerary}</IonSegmentButton>
                  <IonSegmentButton value="invites">Invites {tabCounts.invites}</IonSegmentButton>
                  <IonSegmentButton value="domains">Domains {tabCounts.domains}</IonSegmentButton>
                  <IonSegmentButton value="gifts">Gifts {tabCounts.gifts}</IonSegmentButton>
                </IonSegment>
              </section>

              {activeTab === 'overview' ? (
                <section className="surface-card">
                  <h3>Operations snapshot</h3>
                  <div className="metric-grid">
                    <article className="surface-card metric-card">
                      <p className="metric-label">RSVPs</p>
                      <p className="metric-value">{event._count.rsvps}</p>
                    </article>
                    <article className="surface-card metric-card">
                      <p className="metric-label">Check-ins</p>
                      <p className="metric-value">{event._count.checkIns}</p>
                    </article>
                    <article className="surface-card metric-card">
                      <p className="metric-label">Media</p>
                      <p className="metric-value">{event._count.mediaAssets}</p>
                    </article>
                    <article className="surface-card metric-card">
                      <p className="metric-label">Invites</p>
                      <p className="metric-value">{event._count.invitations}</p>
                    </article>
                  </div>
                </section>
              ) : null}

              {activeTab === 'rsvps' ? (
                <section className="surface-card">
                  <div className="row-between">
                    <h3>RSVP Reviews</h3>
                    <IonButton size="small" fill="outline" onClick={exportRsvps}>Export CSV</IonButton>
                  </div>
                  <IonSegment value={rsvpFilter} onIonChange={(segmentEvent) => setRsvpFilter((segmentEvent.detail.value as string) || 'all')}>
                    <IonSegmentButton value="all">All</IonSegmentButton>
                    <IonSegmentButton value="PENDING">Pending</IonSegmentButton>
                    <IonSegmentButton value="APPROVED">Approved</IonSegmentButton>
                    <IonSegmentButton value="REJECTED">Rejected</IonSegmentButton>
                  </IonSegment>
                  {!rsvps.length ? <p className="muted-text">No RSVPs found.</p> : null}
                  <div className="event-list">
                    {rsvps.map((rsvp) => (
                      <article className="event-list-item static stack" key={rsvp.id}>
                        <div className="row-between">
                          <p className="event-title">{rsvp.primaryName}</p>
                          <span className={'status-pill ' + statusToneClass(rsvp.status)}>{rsvp.status}</span>
                        </div>
                        <p className="event-subline">{rsvp.attendance} - {rsvp.guestCount} guest(s) - {formatDateTime(rsvp.submittedAt)}</p>
                        <p className="event-subline">{rsvp.email || rsvp.phone || '-'}</p>
                        {rsvp.status === 'PENDING' ? (
                          <div className="inline-row">
                            <IonButton size="small" color="danger" fill="outline" disabled={reviewingRsvpId === rsvp.id} onClick={() => reviewRsvp(rsvp.id, 'REJECTED')}>Reject</IonButton>
                            <IonButton size="small" color="success" fill="outline" disabled={reviewingRsvpId === rsvp.id} onClick={() => reviewRsvp(rsvp.id, 'APPROVED')}>Approve</IonButton>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeTab === 'checkin' ? (
                <section className="surface-card">
                  <div className="row-between">
                    <h3>Check-ins</h3>
                    <IonButton size="small" fill="outline" onClick={exportCheckins}>Export CSV</IonButton>
                  </div>
                  {!checkins.length ? <p className="muted-text">No check-ins yet.</p> : null}
                  <div className="event-list">
                    {checkins.map((checkin) => (
                      <article className="event-list-item static stack" key={checkin.id}>
                        <p className="event-title">{checkin.invitation.guestName}</p>
                        <p className="event-subline">Guests: {checkin.invitation.guestCount} - Code: {checkin.invitation.accessCode}</p>
                        <p className="event-subline">{formatDateTime(checkin.checkedInAt)} - {checkin.method}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeTab === 'media' ? (
                <section className="surface-card">
                  <h3>Guestbook Media</h3>
                  {!media.length ? <p className="muted-text">No media uploaded yet.</p> : null}
                  <div className="event-list">
                    {media.map((asset) => (
                      <article className="event-list-item static stack" key={asset.id}>
                        <div className="row-between">
                          <p className="event-title">{asset.fileName}</p>
                          <span className={'status-pill tone-info'}>{asset.type}</span>
                        </div>
                        <p className="event-subline">Guest: {asset.guestName || 'Unknown'} - {formatDateTime(asset.createdAt)}</p>
                        <a href={asset.filePath} target="_blank" rel="noreferrer" className="inline-link">Open file</a>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeTab === 'tickets' ? (
                <section className="surface-card">
                  <h3>Ticket Performance</h3>
                  {!tickets.length ? <p className="muted-text">No tickets configured.</p> : null}
                  <div className="event-list">
                    {tickets.map((ticket) => (
                      <article className="event-list-item static stack" key={ticket.id}>
                        <div className="row-between">
                          <p className="event-title">{ticket.name}</p>
                          <span className={'status-pill ' + (ticket.isActive ? 'tone-success' : 'tone-neutral')}>
                            {ticket.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="event-subline">{ticket.price > 0 ? formatCurrency(ticket.currency, ticket.price) : 'Free'}</p>
                        <p className="event-subline">Sold: {ticket.quantitySold} / {ticket.quantityTotal}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeTab === 'itinerary' ? (
                <>
                  <section className="surface-card">
                    <div className="row-between">
                      <h3>Itinerary</h3>
                      <IonButton size="small" fill="outline" disabled={creatingMcLink} onClick={createMcControlLink}>
                        {creatingMcLink ? 'Creating...' : 'Create MC control link'}
                      </IonButton>
                    </div>
                    {mcControlUrl ? (
                      <div className="inline-row wrap">
                        <a href={mcControlUrl} target="_blank" rel="noreferrer" className="inline-link">Open MC link</a>
                        <IonButton size="small" fill="clear" onClick={copyMcLink}>Copy MC link</IonButton>
                      </div>
                    ) : null}
                    <form className="auth-form" onSubmit={addItinerary}>
                      <label className="field">
                        <span>Title</span>
                        <input className="native-input" required value={newItinerary.title} onChange={(inputEvent) => setNewItinerary((prev) => ({ ...prev, title: inputEvent.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Description</span>
                        <textarea className="native-input native-textarea" value={newItinerary.description} onChange={(inputEvent) => setNewItinerary((prev) => ({ ...prev, description: inputEvent.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Starts at</span>
                        <input className="native-input" type="datetime-local" value={newItinerary.startsAt} onChange={(inputEvent) => setNewItinerary((prev) => ({ ...prev, startsAt: inputEvent.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Ends at</span>
                        <input className="native-input" type="datetime-local" value={newItinerary.endsAt} onChange={(inputEvent) => setNewItinerary((prev) => ({ ...prev, endsAt: inputEvent.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Location</span>
                        <input className="native-input" value={newItinerary.location} onChange={(inputEvent) => setNewItinerary((prev) => ({ ...prev, location: inputEvent.target.value }))} />
                      </label>
                      <IonButton className="solid-cta" type="submit" expand="block" disabled={savingItinerary}>
                        {savingItinerary ? 'Adding...' : 'Add itinerary item'}
                      </IonButton>
                    </form>
                  </section>

                  <section className="surface-card">
                    <h3>Timeline items</h3>
                    {!itineraryItems.length ? <p className="muted-text">No itinerary items yet.</p> : null}
                    <div className="event-list">
                      {itineraryItems.map((item, index) => (
                        <article className="event-list-item static stack" key={item.id}>
                          <div className="row-between">
                            <p className="event-title">{item.title}</p>
                            <span className={'status-pill ' + (item.isCompleted ? 'tone-success' : 'tone-neutral')}>
                              {item.isCompleted ? 'Completed' : 'Pending'}
                            </span>
                          </div>
                          <p className="event-subline">
                            {formatDateTime(item.startsAt)} {item.location ? '- ' + item.location : ''}
                          </p>
                          {item.description ? <p className="event-subline">{item.description}</p> : null}
                          <div className="inline-row wrap">
                            <IonButton size="small" fill="outline" onClick={() => toggleItineraryItem(item)}>
                              {item.isCompleted ? 'Mark pending' : 'Mark completed'}
                            </IonButton>
                            <IonButton size="small" fill="outline" disabled={index === 0} onClick={() => reorderItinerary(item.id, 'up')}>
                              Move up
                            </IonButton>
                            <IonButton size="small" fill="outline" disabled={index === itineraryItems.length - 1} onClick={() => reorderItinerary(item.id, 'down')}>
                              Move down
                            </IonButton>
                            <IonButton size="small" color="danger" fill="outline" onClick={() => deleteItineraryItem(item.id)}>
                              Delete
                            </IonButton>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}

              {activeTab === 'invites' ? (
                <>
                  <section className="surface-card">
                    <h3>Send WhatsApp invites</h3>
                    <p className="muted-text">One per line: phone OR name,phone OR name,phone,email.</p>
                    <div className="inline-row wrap">
                      <span className="status-pill tone-neutral">Total: {inviteStats.total}</span>
                      <span className="status-pill tone-warning">Sent: {inviteStats.sent}</span>
                      <span className="status-pill tone-info">Opened: {inviteStats.opened}</span>
                      <span className="status-pill tone-success">Responded: {inviteStats.responded}</span>
                      <span className="status-pill tone-danger">Expired: {inviteStats.expired}</span>
                    </div>
                    <label className="field">
                      <span>Invite lines</span>
                      <textarea className="native-input native-textarea" value={inviteLines} placeholder="+233xxxxxxxxx&#10;Ama,+233xxxxxxxxx,ama@email.com" onChange={(inputEvent) => setInviteLines(inputEvent.target.value)} />
                    </label>
                    <label className="field">
                      <span>Expiry (hours)</span>
                      <select className="native-select" value={inviteExpiryHours} onChange={(inputEvent) => setInviteExpiryHours(Number(inputEvent.target.value || 240))}>
                        <option value={24}>24 hours</option>
                        <option value={72}>3 days</option>
                        <option value={168}>7 days</option>
                        <option value={240}>10 days</option>
                        <option value={720}>30 days</option>
                      </select>
                    </label>
                    <IonButton className="solid-cta" expand="block" disabled={sendingInvites} onClick={sendInvites}>
                      {sendingInvites ? 'Sending...' : 'Send invites'}
                    </IonButton>
                  </section>

                  <section className="surface-card">
                    <h3>Invite status list</h3>
                    {!invites.length ? <p className="muted-text">No invites yet.</p> : null}
                    <div className="event-list">
                      {invites.map((invite) => (
                        <article className="event-list-item static stack" key={invite.id}>
                          <div className="row-between">
                            <p className="event-title">{invite.inviteeName || '-'}</p>
                            <span className={'status-pill ' + statusToneClass(invite.status)}>{invite.status}</span>
                          </div>
                          <p className="event-subline">{invite.inviteePhone}</p>
                          <p className="event-subline">Sent: {formatDate(invite.sentAt)} - Expires: {formatDate(invite.expiresAt)}</p>
                          <div className="inline-row">
                            <IonButton size="small" fill="outline" onClick={() => resendInvite(invite.id)} disabled={invite.status === 'RESPONDED'}>
                              Resend
                            </IonButton>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}

              {activeTab === 'domains' ? (
                <>
                  <section className="surface-card">
                    <h3>Custom domains</h3>
                    <p className="muted-text">Connect your event domain with TXT + CNAME records.</p>
                    <div className="inline-row wrap">
                      <input className="native-input inline-input" placeholder="wedding.example.com" value={domainHost} onChange={(inputEvent) => setDomainHost(inputEvent.target.value)} />
                      <IonButton className="solid-cta" disabled={savingDomain} onClick={addDomain}>
                        {savingDomain ? 'Adding...' : 'Add domain'}
                      </IonButton>
                    </div>
                  </section>

                  <section className="surface-card">
                    <h3>Domain records</h3>
                    {!domains.length ? <p className="muted-text">No domains connected.</p> : null}
                    <div className="event-list">
                      {domains.map((domain) => (
                        <article className="event-list-item static stack" key={domain.id}>
                          <div className="row-between">
                            <p className="event-title">{domain.host}</p>
                            <div className="inline-row">
                              {domain.isPrimary ? <span className="status-pill tone-info">Primary</span> : null}
                              <span className={'status-pill ' + statusToneClass(domain.status)}>{domain.status}</span>
                            </div>
                          </div>
                          <p className="event-subline">TXT: _eventpeepo.{domain.host} = {domain.verificationToken}</p>
                          <p className="event-subline">CNAME: {domain.host.startsWith('www.') ? domain.host : `www.${domain.host}`} = {cnameTarget}</p>
                          {domain.verificationNotes ? <p className="event-subline">{domain.verificationNotes}</p> : null}
                          <div className="inline-row wrap">
                            <IonButton size="small" fill="outline" onClick={() => verifyDomain(domain.id)}>Verify</IonButton>
                            {!domain.isPrimary ? (
                              <IonButton size="small" fill="outline" disabled={!['VERIFIED', 'ACTIVE'].includes(domain.status)} onClick={() => makePrimaryDomain(domain.id)}>
                                Make primary
                              </IonButton>
                            ) : null}
                            <IonButton size="small" color="danger" fill="outline" onClick={() => removeDomain(domain.id)}>Remove</IonButton>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}

              {activeTab === 'gifts' ? (
                <section className="surface-card">
                  <h3>Gift orders</h3>
                  {!giftOrders.length ? <p className="muted-text">No gift orders yet.</p> : null}
                  <div className="event-list">
                    {giftOrders.map((order) => (
                      <article className="event-list-item static stack" key={order.id}>
                        <div className="row-between">
                          <p className="event-title">{order.guestName}</p>
                          <span className={'status-pill ' + statusToneClass(order.status)}>{order.status}</span>
                        </div>
                        <p className="event-subline">
                          Total: {formatCurrency(order.currency, order.totalAmount)} - Net: {formatCurrency(order.currency, order.ownerNetAmount)}
                        </p>
                        <p className="event-subline">{order.guestEmail || order.guestPhone || '-'}</p>
                        <p className="event-subline">{formatDateTime(order.createdAt)}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <section className="surface-card">
              <p className="muted-text">{loading ? 'Loading event...' : 'Event unavailable.'}</p>
            </section>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
};

export default EventDetailsPage;
