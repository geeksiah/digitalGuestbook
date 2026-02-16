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
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { ownerDashboardApi } from '../api/client';
import type { OwnerEvent, PayoutRecord, PayoutResponse, PayoutStatus } from '../types/domain';
import { formatCurrency, formatDate, statusToneClass } from '../utils/format';
import { getErrorMessage } from '../utils/error';
import DateFilter, { type DateRange } from '../components/DateFilter';

type PayoutFilter = 'all' | 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'DELAYED' | 'REJECTED';

const statusLabel: Record<PayoutFilter, string> = {
  all: 'All',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  FULFILLED: 'Fulfilled',
  DELAYED: 'Delayed',
  REJECTED: 'Rejected'
};

const PayoutsPage = () => {
  const [present] = useIonToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<PayoutFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [events, setEvents] = useState<OwnerEvent[]>([]);
  const [payoutData, setPayoutData] = useState<PayoutResponse | null>(null);
  const [formData, setFormData] = useState({
    eventId: '',
    requestedAmount: '',
    notes: ''
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [eventsResponse, payoutsResponse] = await Promise.all([
        ownerDashboardApi.events(),
        ownerDashboardApi.payouts()
      ]);
      const ownerEvents = eventsResponse.data.events || [];
      setEvents(ownerEvents);
      setPayoutData(payoutsResponse.data);
      setFormData((prev) => ({
        ...prev,
        eventId: prev.eventId || ownerEvents[0]?.id || ''
      }));
    } catch (error: unknown) {
      present({
        message: getErrorMessage(error, 'Failed to load payouts'),
        duration: 2200,
        color: 'danger'
      });
    } finally {
      setLoading(false);
    }
  }, [present]);

  useIonViewWillEnter(() => {
    void load();
  });

  const filteredPayouts = useMemo(() => {
    const list = payoutData?.payouts || [];
    return list.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (dateRange.from && dateRange.to) {
        const d = new Date(item.createdAt);
        if (d < dateRange.from || d > dateRange.to) return false;
      }
      return true;
    });
  }, [filter, payoutData, dateRange]);

  const selectedEventBalance = useMemo(() => {
    const eventTotal = payoutData?.eventTotals.find((item) => item.eventId === formData.eventId);
    return eventTotal?.availableBalance || 0;
  }, [formData.eventId, payoutData]);

  const onSubmitPayout = async (event: FormEvent) => {
    event.preventDefault();
    const requestedAmount = Number(formData.requestedAmount);
    if (!formData.eventId || Number.isNaN(requestedAmount) || requestedAmount <= 0) {
      present({ message: 'Select event and valid amount', duration: 2000, color: 'danger' });
      return;
    }

    setSubmitting(true);
    try {
      await ownerDashboardApi.requestPayout({
        eventId: formData.eventId,
        requestedAmount,
        notes: formData.notes || undefined
      });
      present({ message: 'Payout request submitted', duration: 1800, color: 'success' });
      setFormData((prev) => ({ ...prev, requestedAmount: '', notes: '' }));
      setShowForm(false);
      await load();
    } catch (error: unknown) {
      present({
        message: getErrorMessage(error, 'Unable to submit payout request'),
        duration: 2200,
        color: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const statusClass = (status: PayoutStatus) => 'status-pill ' + statusToneClass(status);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>Payouts</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(refresh) => load().finally(() => refresh.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <main className="screen-content">
          <section className="hero-card compact">
            <p className="balance-label">Available balance</p>
            <p className="balance-amount">
              {formatCurrency('USD', payoutData?.overallTotals.availableBalance || 0)}
            </p>
            <div className="inline-row wrap" style={{ gap: 16, marginTop: 4 }}>
              <span className="event-subline">Pending: {formatCurrency('USD', payoutData?.overallTotals.pendingAmount || 0)}</span>
              <span className="event-subline">Fulfilled: {formatCurrency('USD', payoutData?.overallTotals.fulfilledAmount || 0)}</span>
            </div>
            <IonButton
              className="solid-cta"
              expand="block"
              onClick={() => setShowForm((prev) => !prev)}
              disabled={loading}
            >
              {showForm ? 'Close request form' : 'Request payout'}
            </IonButton>
          </section>

          {showForm ? (
            <section className="surface-card">
              <h3>New Payout Request</h3>
              <form className="auth-form" onSubmit={onSubmitPayout}>
                <label className="field">
                  <span>Event</span>
                  <select
                    className="native-select"
                    value={formData.eventId}
                    onChange={(event) => setFormData((prev) => ({ ...prev, eventId: event.target.value }))}
                    required
                  >
                    {events.map((ownerEvent) => {
                      const eventTotal = payoutData?.eventTotals.find((item) => item.eventId === ownerEvent.id);
                      const currency = eventTotal?.currency || 'USD';
                      return (
                        <option value={ownerEvent.id} key={ownerEvent.id}>
                          {ownerEvent.name} ({formatCurrency(currency, eventTotal?.availableBalance || 0)})
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="field">
                  <span>Amount</span>
                  <input
                    className="native-input"
                    type="number"
                    min="1"
                    step="0.01"
                    max={selectedEventBalance}
                    required
                    value={formData.requestedAmount}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, requestedAmount: event.target.value }))
                    }
                  />
                  <small className="muted-text">Max available: {formatCurrency('USD', selectedEventBalance)}</small>
                </label>
                <label className="field">
                  <span>Notes (optional)</span>
                  <textarea
                    className="native-input native-textarea"
                    value={formData.notes}
                    onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </label>
                <IonButton className="solid-cta" type="submit" expand="block" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit request'}
                </IonButton>
              </form>
            </section>
          ) : null}

          <DateFilter value={dateRange} onChange={setDateRange} />

          <section className="surface-card">
            <h3>Filter</h3>
            <IonSegment
              value={filter}
              scrollable={true}
              onIonChange={(event) => setFilter((event.detail.value as PayoutFilter) || 'all')}
            >
              {(Object.keys(statusLabel) as PayoutFilter[]).map((status) => (
                <IonSegmentButton key={status} value={status}>
                  {statusLabel[status]}
                </IonSegmentButton>
              ))}
            </IonSegment>
          </section>

          <section className="surface-card">
            <h3>Payout Requests</h3>
            {!filteredPayouts.length && !loading ? (
              <div className="empty-state">
                <div className="empty-state-icon">{'\u{1F4B3}'}</div>
                <p>No payout requests yet.</p>
              </div>
            ) : null}
            <div className="event-list">
              {filteredPayouts.map((payout: PayoutRecord) => {
                const currency = payout.requestedCurrency || payout.currency || 'USD';
                return (
                  <article className="event-list-item static stack" key={payout.id}>
                    <div className="row-between">
                      <p className="event-title">{payout.event?.name || 'Event payout'}</p>
                      <span className={statusClass(payout.status)}>{payout.status}</span>
                    </div>
                    <p className="event-subline">
                      {formatCurrency(currency, payout.requestedAmount)} &middot; {formatDate(payout.createdAt)}
                    </p>
                    {payout.notes ? <p className="event-subline">{payout.notes}</p> : null}
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default PayoutsPage;
