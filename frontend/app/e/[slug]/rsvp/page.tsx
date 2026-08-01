'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { publicApi, rsvpApi, ticketingApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import BackendTemplateFrame, { useBackendTemplate } from '@/components/BackendTemplateFrame';

type FieldType = 'text' | 'email' | 'phone' | 'number' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'date';

interface EventData {
  event: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    date: string;
    venue: string | null;
    phase: string;
    invitationOnly: boolean;
    strictInviteOnly: boolean;
    capabilities: {
      canSubmitRsvp: boolean;
    };
  };
}

interface EventFormField {
  id: string;
  fieldName: string;
  label: string;
  type: FieldType;
  placeholder?: string | null;
  helpText?: string | null;
  options?: string[] | null;
  required: boolean;
  minLength?: number | null;
  maxLength?: number | null;
  pattern?: string | null;
}

interface TicketOption {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  available: number;
  maxPerOrder: number;
}

interface PaymentGatewayOption {
  id: string;
  name: string;
  gateway: string;
  currency: string;
  publicKey?: string | null;
}

interface PublicTicketingForm {
  eventId: string;
  eventName: string;
  rsvpMode: string;
  fields: EventFormField[];
  tickets: TicketOption[];
  paymentGateways: PaymentGatewayOption[];
}

const formatMoney = (currency: string, amount: number) => {
  const safeCurrency = String(currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency }).format(amount);
  } catch {
    return `${safeCurrency} ${amount.toFixed(2)}`;
  }
};

export default function EventRsvpPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  // Render the assigned RSVP template when the event has one; otherwise fall
  // back to the built-in form below.
  const { loading: templateLoading, available: hasTemplate } = useBackendTemplate(slug, 'rsvp');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [ticketingForm, setTicketingForm] = useState<PublicTicketingForm | null>(null);

  const [primaryName, setPrimaryName] = useState('');
  const [secondaryName, setSecondaryName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [attendance, setAttendance] = useState<'YES' | 'NO' | 'MAYBE'>('YES');
  const [guestCount, setGuestCount] = useState(1);
  const [mealPreference, setMealPreference] = useState('');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [note, setNote] = useState('');

  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({});
  const [selectedGatewayId, setSelectedGatewayId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string | boolean>>({});

  const isPaidMode = String(ticketingForm?.rsvpMode || '').toLowerCase() === 'paid';

  const selectedTickets = useMemo(() => {
    const catalog = ticketingForm?.tickets || [];
    return catalog
      .map((ticket) => ({
        ticketTypeId: ticket.id,
        quantity: ticketQuantities[ticket.id] || 0,
        ticket,
      }))
      .filter((item) => item.quantity > 0);
  }, [ticketQuantities, ticketingForm?.tickets]);

  const totalTicketAmount = useMemo(
    () => selectedTickets.reduce((sum, item) => sum + item.ticket.price * item.quantity, 0),
    [selectedTickets]
  );

  const totalTicketQty = useMemo(
    () => selectedTickets.reduce((sum, item) => sum + item.quantity, 0),
    [selectedTickets]
  );

  const selectedGateway = useMemo(() => {
    const list = ticketingForm?.paymentGateways || [];
    if (!list.length) return null;
    return list.find((gateway) => gateway.id === selectedGatewayId) || list[0];
  }, [ticketingForm?.paymentGateways, selectedGatewayId]);
  const hasGatewayOptions = (ticketingForm?.paymentGateways || []).length > 0;
  const paidReadyToSubmit =
    Boolean(primaryName.trim()) &&
    Boolean(phone.trim()) &&
    Boolean(selectedGateway?.id) &&
    selectedTickets.length > 0 &&
    hasGatewayOptions;
  const freeReadyToSubmit = Boolean(primaryName.trim());
  const submitDisabled = submitting || (isPaidMode ? !paidReadyToSubmit : !freeReadyToSubmit);

  useEffect(() => {
    if (!slug || templateLoading || hasTemplate) return;

    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const [eventResponse, formResponse] = await Promise.all([
          publicApi.getEvent(slug),
          ticketingApi.getPublicForm(slug),
        ]);

        if (cancelled) return;

        setEventData(eventResponse.data);
        setTicketingForm(formResponse.data);
        const firstGatewayId = formResponse.data?.paymentGateways?.[0]?.id;
        if (firstGatewayId) setSelectedGatewayId((current) => current || firstGatewayId);
      } catch (requestError: any) {
        if (cancelled) return;
        setError(requestError?.response?.data?.error || 'Unable to load RSVP page.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [slug, templateLoading, hasTemplate]);

  const updateTicketQty = (ticketId: string, nextValue: number, maxPerOrder: number, available: number) => {
    const safeMax = Math.max(0, Math.min(maxPerOrder, available));
    const safeQty = Math.max(0, Math.min(nextValue, safeMax));
    setTicketQuantities((prev) => ({ ...prev, [ticketId]: safeQty }));
  };

  const renderCustomField = (field: EventFormField) => {
    const fieldKey = field.fieldName;
    const value = customFields[fieldKey];
    const options = Array.isArray(field.options) ? field.options : [];

    const commonProps = {
      required: field.required,
      name: fieldKey,
      placeholder: field.placeholder || undefined,
    };

    return (
      <label key={field.id} className="block space-y-1.5">
        <span className="text-sm font-medium text-surface-700">{field.label}</span>

        {field.type === 'textarea' ? (
          <textarea
            className="input min-h-[90px]"
            value={String(value || '')}
            onChange={(event) => setCustomFields((prev) => ({ ...prev, [fieldKey]: event.target.value }))}
            {...commonProps}
          />
        ) : null}

        {field.type === 'select' ? (
          <select
            className="input"
            value={String(value || '')}
            onChange={(event) => setCustomFields((prev) => ({ ...prev, [fieldKey]: event.target.value }))}
            {...commonProps}
          >
            <option value="">Select {field.label}</option>
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : null}

        {field.type === 'radio' ? (
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <label key={option} className="inline-flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-2 text-sm">
                <input
                  type="radio"
                  name={fieldKey}
                  checked={String(value || '') === option}
                  onChange={() => setCustomFields((prev) => ({ ...prev, [fieldKey]: option }))}
                  required={field.required}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        ) : null}

        {field.type === 'checkbox' ? (
          <label className="inline-flex items-center gap-2 text-sm text-surface-700">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => setCustomFields((prev) => ({ ...prev, [fieldKey]: event.target.checked }))}
              required={field.required}
            />
            <span>{field.helpText || 'Check to confirm'}</span>
          </label>
        ) : null}

        {!['textarea', 'select', 'radio', 'checkbox'].includes(field.type) ? (
          <input
            className="input"
            type={field.type === 'phone' ? 'tel' : field.type}
            value={String(value || '')}
            onChange={(event) => setCustomFields((prev) => ({ ...prev, [fieldKey]: event.target.value }))}
            minLength={field.minLength || undefined}
            maxLength={field.maxLength || undefined}
            pattern={field.pattern || undefined}
            {...commonProps}
          />
        ) : null}

        {field.helpText ? <p className="text-xs text-surface-500">{field.helpText}</p> : null}
      </label>
    );
  };

  const onSubmit = async () => {
    if (!eventData) return;
    if (!primaryName.trim()) {
      toast.error('Primary name is required');
      return;
    }

    const customFieldsJson = Object.keys(customFields).length
      ? JSON.stringify(customFields)
      : undefined;
    const customFieldsObject = Object.keys(customFields).length
      ? customFields
      : undefined;

    if (isPaidMode) {
      if (!selectedTickets.length) {
        toast.error('Select at least one ticket');
        return;
      }
      if (!phone.trim()) {
        toast.error('Phone is required for ticket checkout');
        return;
      }
      if (!selectedGateway?.id) {
        toast.error('Select a payment gateway');
        return;
      }
      setSubmitting(true);
      try {
        const response = await ticketingApi.publicCheckout(slug, {
          primaryName: primaryName.trim(),
          secondaryName: secondaryName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim(),
          tickets: selectedTickets.map((item) => ({ ticketTypeId: item.ticketTypeId, quantity: item.quantity })),
          promoCode: promoCode.trim() || undefined,
          paymentGatewayId: selectedGateway.id,
          paymentMethod: selectedGateway.gateway,
          customFields: customFieldsObject,
          attendance: 'YES',
          guestCount: totalTicketQty || 1,
          note: note.trim() || undefined,
          submissionChannel: 'web',
        });

        const nextAction = response.data?.nextAction;
        if (nextAction?.type === 'REDIRECT' && nextAction?.url) {
          globalThis.window.location.href = String(nextAction.url);
          return;
        }
        toast.success('Checkout initialized. Please complete payment in the gateway window.');
      } catch (requestError: any) {
        toast.error(requestError?.response?.data?.error || 'Ticket checkout failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (eventData.event.strictInviteOnly) {
      const inviteToken = searchParams.get('inviteToken') || searchParams.get('token') || '';
      if (!inviteToken) {
        toast.error('This event requires an invite token.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await rsvpApi.submit(slug, {
        primaryName: primaryName.trim(),
        secondaryName: secondaryName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        attendance,
        guestCount,
        mealPreference: mealPreference.trim() || undefined,
        dietaryNotes: dietaryNotes.trim() || undefined,
        note: note.trim() || undefined,
        customFields: customFieldsJson,
        submissionChannel: 'WEB',
        inviteToken: searchParams.get('inviteToken') || searchParams.get('token') || undefined,
      });

      toast.success('RSVP submitted successfully');
    } catch (requestError: any) {
      toast.error(requestError?.response?.data?.error || 'RSVP submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (templateLoading) {
    return (
      <div className="min-h-screen section-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-900" />
      </div>
    );
  }

  if (hasTemplate) {
    return <BackendTemplateFrame slug={slug} endpoint="rsvp" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen section-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-900" />
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="min-h-screen section-gradient flex items-center justify-center p-4">
        <div className="card-premium max-w-md p-6 text-center">
          <h1 className="text-2xl font-bold text-brand-900">RSVP Unavailable</h1>
          <p className="mt-2 text-surface-600">{error || 'This RSVP page could not be loaded.'}</p>
          <Link href={`/e/${slug}`} className="btn-accent mt-5 inline-flex">Back to event</Link>
        </div>
      </div>
    );
  }

  if (!eventData.event.capabilities.canSubmitRsvp) {
    return (
      <div className="min-h-screen section-gradient flex items-center justify-center p-4">
        <div className="card-premium max-w-md p-6 text-center">
          <h1 className="text-2xl font-bold text-brand-900">RSVP Closed</h1>
          <p className="mt-2 text-surface-600">RSVP is not available in this event phase.</p>
          <Link href={`/e/${slug}`} className="btn-accent mt-5 inline-flex">Back to event</Link>
        </div>
      </div>
    );
  }

  const defaultCurrency = selectedTickets[0]?.ticket.currency || selectedGateway?.currency || 'USD';

  return (
    <div className="min-h-screen section-gradient pb-32">
      <div className="mx-auto w-full max-w-[440px] space-y-4 px-3 py-5">
        <section className="hero-premium p-4">
          <h1 className="text-xl font-bold tracking-tight text-white">{eventData.event.name}</h1>
          <p className="mt-1 text-sm text-surface-200">
            {formatDate(eventData.event.date)}{eventData.event.venue ? ` - ${eventData.event.venue}` : ''}
          </p>
          <p className="mt-2 text-sm text-surface-200">
            {isPaidMode ? 'Select tickets, add contact details, then complete payment.' : 'Complete your RSVP details below.'}
          </p>
        </section>

        {isPaidMode ? (
          <section className="card-premium p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-brand-900">Ticket Selection</h2>
              <span className="badge badge-info">{totalTicketQty} selected</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {(ticketingForm?.tickets || []).map((ticket) => (
                <article key={ticket.id} className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-900">{ticket.name}</p>
                      <p className="text-xs text-surface-600">{ticket.description || 'General access ticket'}</p>
                      <p className="mt-1 text-xs font-semibold text-rose-500">{formatMoney(ticket.currency, ticket.price)} / ticket</p>
                    </div>
                    <div className="inline-flex items-center rounded-full border border-surface-300 bg-white">
                      <button
                        type="button"
                        className="h-8 w-8 text-base font-semibold text-brand-900"
                        onClick={() => updateTicketQty(ticket.id, (ticketQuantities[ticket.id] || 0) - 1, ticket.maxPerOrder, ticket.available)}
                      >
                        -
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold text-brand-900">{ticketQuantities[ticket.id] || 0}</span>
                      <button
                        type="button"
                        className="h-8 w-8 text-base font-semibold text-brand-900"
                        onClick={() => updateTicketQty(ticket.id, (ticketQuantities[ticket.id] || 0) + 1, ticket.maxPerOrder, ticket.available)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-amber-700">Available: {ticket.available} - Max/order: {ticket.maxPerOrder}</p>
                </article>
              ))}
              {(!ticketingForm?.tickets || ticketingForm.tickets.length === 0) ? (
                <p className="rounded-xl border border-dashed border-surface-300 bg-surface-50 p-4 text-sm text-surface-600">
                  No active tickets are available for this event.
                </p>
              ) : null}
            </div>

            <div className="mt-3 rounded-xl border border-surface-200 bg-white p-3">
              <div className="flex items-center justify-between text-sm">
                <p className="text-surface-600">Order subtotal</p>
                <p className="font-semibold text-brand-900">{defaultCurrency} {totalTicketAmount.toFixed(2)}</p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="card-premium p-4 space-y-3">
          <h2 className="text-base font-semibold text-brand-900">Contact Information</h2>
          <input className="input" placeholder="Primary name" value={primaryName} onChange={(event) => setPrimaryName(event.target.value)} />
          <input className="input" placeholder="Secondary name (optional)" value={secondaryName} onChange={(event) => setSecondaryName(event.target.value)} />
          <input className="input" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="input" placeholder={isPaidMode ? 'Phone (required)' : 'Phone (optional)'} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />

          {!isPaidMode ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(['YES', 'NO', 'MAYBE'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAttendance(option)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium ${attendance === option ? 'border-brand-900 bg-brand-900 text-white' : 'border-surface-200 bg-white text-surface-700'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <input
                className="input"
                type="number"
                min={1}
                max={20}
                value={guestCount}
                onChange={(event) => setGuestCount(Math.max(1, Math.min(20, Number(event.target.value || 1))))}
                placeholder="Guest count"
              />
              <input className="input" placeholder="Meal preference (optional)" value={mealPreference} onChange={(event) => setMealPreference(event.target.value)} />
              <textarea className="input min-h-[88px]" placeholder="Dietary notes (optional)" value={dietaryNotes} onChange={(event) => setDietaryNotes(event.target.value)} />
            </>
          ) : null}

          {(ticketingForm?.fields || []).map(renderCustomField)}

          {isPaidMode ? (
            <>
              <h3 className="pt-1 text-sm font-semibold text-brand-900">Payment Information</h3>
              <select className="input" value={selectedGatewayId} onChange={(event) => setSelectedGatewayId(event.target.value)}>
                {(ticketingForm?.paymentGateways || []).length > 0 ? (
                  ticketingForm!.paymentGateways.map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>
                      {gateway.name} ({gateway.gateway.toUpperCase()} - {gateway.currency})
                    </option>
                  ))
                ) : (
                  <option value="">No payment gateway configured</option>
                )}
              </select>
              {!hasGatewayOptions ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No active payment gateway is configured for this event yet.
                </div>
              ) : null}
              <input className="input" placeholder="Promo code (optional)" value={promoCode} onChange={(event) => setPromoCode(event.target.value)} />
            </>
          ) : null}

          <textarea className="input min-h-[88px]" placeholder="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-surface-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[440px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-surface-500">{isPaidMode ? 'Order total' : 'RSVP status'}</p>
            <p className="text-sm font-semibold text-brand-900">
              {isPaidMode ? `${defaultCurrency} ${totalTicketAmount.toFixed(2)}` : `${attendance} - ${guestCount} guest(s)`}
            </p>
          </div>
          <button
            className="btn-accent px-5"
            disabled={submitDisabled}
            onClick={onSubmit}
          >
            {submitting ? 'Submitting...' : isPaidMode ? 'Pay Now' : 'Submit RSVP'}
          </button>
        </div>
      </div>
    </div>
  );
}
