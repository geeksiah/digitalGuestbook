'use client';

import { useState, useEffect } from 'react';
import { paymentGatewaysApi, ticketingApi, promoCodeApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn, getErrorMessage } from '@/lib/utils';
import {
  EmptyState,
  ListSkeleton,
  StatusBadge,
  SubmitButton,
  Switch,
  Td,
  Th,
  Toolbar,
} from '@/components/ui/Primitives';
import { ConfirmDialog, Menu, MenuItem, Modal } from '@/components/ui/Overlay';
import PaymentGatewaySelector from './PaymentGatewaySelector';
import { CURRENCY_OPTIONS, getCurrencyOption, uniqueCurrencyCodes } from '@/lib/paymentGatewayConfig';

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  maxPerOrder: number;
  saleStartDate: string | null;
  saleEndDate: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface TicketsTabProps {
  eventId: string;
  event: any;
  tickets: TicketType[];
  loading: boolean;
  onRefresh: () => void;
}

const CURRENCIES = CURRENCY_OPTIONS;

export default function TicketsTab({ eventId, event, tickets, loading, onRefresh }: TicketsTabProps) {
  const defaultCurrency = CURRENCY_OPTIONS[0]?.code || 'USD';
  const eventDefaultCurrency =
    typeof event?.defaultCurrency === 'string' && event.defaultCurrency.trim().length === 3
      ? event.defaultCurrency.toUpperCase()
      : defaultCurrency;
  const [showForm, setShowForm] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState<any | null>(null);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [gatewayCurrencies, setGatewayCurrencies] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    currency: event.rsvpMode === 'paid' ? (event.ticketTypes?.[0]?.currency || eventDefaultCurrency) : eventDefaultCurrency,
    quantityTotal: '',
    maxPerOrder: '',
    saleStartDate: '',
    saleEndDate: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const availableCurrencies = gatewayCurrencies.length > 0
    ? gatewayCurrencies
    : CURRENCY_OPTIONS.map((currency) => currency.code);

  const pickNewTicketCurrency = () => {
    const preferred = event.ticketTypes?.[0]?.currency || eventDefaultCurrency;
    if (availableCurrencies.includes(preferred)) return preferred;
    return availableCurrencies[0] || defaultCurrency;
  };

  useEffect(() => {
    void fetchGatewayCurrencies();
  }, [eventId]);

  useEffect(() => {
    if (!availableCurrencies.includes(formData.currency)) {
      setFormData((prev) => ({
        ...prev,
        currency: availableCurrencies[0] || defaultCurrency,
      }));
    }
  }, [availableCurrencies, defaultCurrency, formData.currency]);

  const fetchGatewayCurrencies = async () => {
    try {
      const response = await paymentGatewaysApi.getEventGateways(eventId);
      const eventGateways = response.data.eventGateways || [];
      const currencies = uniqueCurrencyCodes(
        eventGateways.map((item: any) => item?.paymentGateway?.currency)
      );
      setGatewayCurrencies(currencies);
    } catch (error) {
      console.error('Failed to load event gateway currencies:', error);
      setGatewayCurrencies([]);
    }
  };

  const handleEdit = (ticket: TicketType) => {
    setEditingTicket(ticket);
    setFormData({
      name: ticket.name,
      description: ticket.description || '',
      price: ticket.price,
      currency: ticket.currency,
      quantityTotal: ticket.quantityTotal.toString(),
      maxPerOrder: ticket.maxPerOrder.toString(),
      saleStartDate: ticket.saleStartDate ? new Date(ticket.saleStartDate).toISOString().slice(0, 16) : '',
      saleEndDate: ticket.saleEndDate ? new Date(ticket.saleEndDate).toISOString().slice(0, 16) : '',
      isActive: ticket.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await ticketingApi.deleteTicketType(eventId, id);
      toast.success('Ticket type deleted');
      onRefresh();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to delete ticket'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const parsedQuantityTotal =
        formData.quantityTotal.trim() === '' ? 0 : parseInt(formData.quantityTotal, 10);
      const parsedMaxPerOrder =
        formData.maxPerOrder.trim() === '' ? 10 : parseInt(formData.maxPerOrder, 10);

      if (!Number.isFinite(parsedQuantityTotal) || parsedQuantityTotal < 0) {
        throw new Error('Total quantity must be 0 or greater');
      }

      if (!Number.isFinite(parsedMaxPerOrder) || parsedMaxPerOrder < 1) {
        throw new Error('Max per order must be at least 1');
      }

      const data = {
        ...formData,
        price: parseFloat(formData.price.toString()),
        quantityTotal: parsedQuantityTotal,
        maxPerOrder: parsedMaxPerOrder,
        saleStartDate: formData.saleStartDate ? new Date(formData.saleStartDate).toISOString() : undefined,
        saleEndDate: formData.saleEndDate ? new Date(formData.saleEndDate).toISOString() : undefined,
        description: formData.description.trim() ? formData.description.trim() : undefined,
      };

      if (editingTicket) {
        await ticketingApi.updateTicketType(eventId, editingTicket.id, data);
        toast.success('Ticket updated');
      } else {
        await ticketingApi.createTicketType(eventId, data);
        toast.success('Ticket type created');
      }

      setShowForm(false);
      setEditingTicket(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        currency: pickNewTicketCurrency(),
        quantityTotal: '',
        maxPerOrder: '',
        saleStartDate: '',
        saleEndDate: '',
        isActive: true,
      });
      onRefresh();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to save ticket'));
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const code = (currency || defaultCurrency).toUpperCase();
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount);
    } catch {
      return `${code} ${amount.toFixed(2)}`;
    }
  };


  return (
    <div className="space-y-4">
      <Toolbar
        end={
          event.rsvpMode === 'paid' ? (
            <button
              onClick={() => {
                setEditingTicket(null);
                setFormData({
                  name: '',
                  description: '',
                  price: 0,
                  currency: pickNewTicketCurrency(),
                  quantityTotal: '',
                  maxPerOrder: '',
                  saleStartDate: '',
                  saleEndDate: '',
                  isActive: true,
                });
                setShowForm(true);
              }}
              className="btn-primary btn-sm"
            >
              New ticket type
            </button>
          ) : null
        }
      >
        <span className="meta num">
          {tickets.length} {tickets.length === 1 ? 'ticket type' : 'ticket types'}
        </span>
      </Toolbar>

      {event.rsvpMode !== 'paid' ? (
        <div className="banner-info" role="status">
          Ticketing is off. Switch this event&rsquo;s RSVP type to &ldquo;Ticketed&rdquo; in Settings to sell tickets.
        </div>
      ) : null}

      {loading ? (
        <ListSkeleton rows={3} />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No ticket types yet"
          hint={event.rsvpMode === 'paid' ? undefined : 'Turn on ticketed RSVP in Settings first.'}
          action={
            event.rsvpMode === 'paid' ? (
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  setEditingTicket(null);
                  setShowForm(true);
                }}
              >
                New ticket type
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white md:hidden">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-brand-900">{ticket.name}</span>
                    <StatusBadge tone={ticket.isActive ? 'success' : 'neutral'}>
                      {ticket.isActive ? 'On sale' : 'Off'}
                    </StatusBadge>
                  </div>
                  <p className="mt-0.5 meta num">
                    {formatCurrency(ticket.price, ticket.currency)} &middot;{' '}
                    {ticket.quantityTotal === 0
                      ? 'Unlimited'
                      : `${ticket.quantitySold} of ${ticket.quantityTotal} sold`}
                  </p>
                </div>
                <Menu label={`Actions for ${ticket.name}`} sheetTitle={ticket.name}>
                  <MenuItem onClick={() => handleEdit(ticket)}>Edit ticket</MenuItem>
                  <MenuItem danger onClick={() => setDeletingTicket(ticket)}>
                    Delete ticket
                  </MenuItem>
                </Menu>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="data-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <Th>Ticket</Th>
                    <Th align="right">Price</Th>
                    <Th>Availability</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="table-row">
                      <Td>
                        <p className="font-medium text-brand-900">{ticket.name}</p>
                        {ticket.description ? <p className="meta max-w-sm truncate">{ticket.description}</p> : null}
                      </Td>
                      <Td align="right" className="num font-medium text-brand-900">
                        {formatCurrency(ticket.price, ticket.currency)}
                      </Td>
                      <Td>
                        <p className="num">
                          {ticket.quantityTotal === 0
                            ? 'Unlimited'
                            : `${ticket.quantitySold} of ${ticket.quantityTotal} sold`}
                        </p>
                        <p className="meta num">Max {ticket.maxPerOrder} per order</p>
                      </Td>
                      <Td>
                        <StatusBadge tone={ticket.isActive ? 'success' : 'neutral'} dot>
                          {ticket.isActive ? 'On sale' : 'Off'}
                        </StatusBadge>
                      </Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn-outline btn-sm" onClick={() => handleEdit(ticket)}>
                            Edit
                          </button>
                          <Menu label={`Actions for ${ticket.name}`} sheetTitle={ticket.name}>
                            <MenuItem danger onClick={() => setDeletingTicket(ticket)}>
                              Delete ticket
                            </MenuItem>
                          </Menu>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deletingTicket)}
        onClose={() => setDeletingTicket(null)}
        onConfirm={() => {
          if (deletingTicket) void handleDelete(deletingTicket.id);
          setDeletingTicket(null);
        }}
        title={`Delete "${deletingTicket?.name || ''}"?`}
        body="Guests can no longer buy this ticket. Tickets already sold are unaffected."
        confirmLabel="Delete ticket"
      />

      {/* Payment Gateway Selection */}
      {event.rsvpMode === 'paid' && (
        <div className="panel p-4 sm:p-5">
          <PaymentGatewaySelector
            eventId={eventId}
            onUpdate={() => {
              void fetchGatewayCurrencies();
              onRefresh();
            }}
            title="Ticket payments"
            description="Select which event gateways guests can use to pay for tickets."
          />
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingTicket(null);
        }}
        title={editingTicket ? editingTicket.name : 'New ticket type'}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn-outline"
              disabled={saving}
              onClick={() => {
                setShowForm(false);
                setEditingTicket(null);
              }}
            >
              Cancel
            </button>
            <SubmitButton
              loading={saving}
              onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
            >
              {editingTicket ? 'Save' : 'Create ticket'}
            </SubmitButton>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Name</label>
        <input
          type="text"
          required
          className="input"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="General Admission"
        />
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          className="input"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Includes access to main event..."
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Price</label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            className="input"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div>
          <label className="label">Currency</label>
          <select
            required
            className="input"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
          >
            {availableCurrencies.map((currencyCode) => {
              const currency = getCurrencyOption(currencyCode);
              return (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name}
                </option>
              );
            })}
          </select>
          <p className="text-xs text-surface-500 mt-1">
            {gatewayCurrencies.length > 0
              ? 'Currencies are driven by enabled event gateways.'
              : 'No gateway currencies found. Using fallback currency list.'}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Total Quantity</label>
          <input
            type="number"
            min="0"
            className="input"
            value={formData.quantityTotal}
            onChange={(e) => setFormData({ ...formData, quantityTotal: e.target.value })}
            placeholder="0 = unlimited"
          />
          <p className="text-xs text-surface-500 mt-1">Leave 0 for unlimited</p>
        </div>

        <div>
          <label className="label">Max Per Order</label>
          <input
            type="number"
            min="1"
            className="input"
            value={formData.maxPerOrder}
            onChange={(e) => setFormData({ ...formData, maxPerOrder: e.target.value })}
            placeholder="10"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Sale Start Date</label>
          <input
            type="datetime-local"
            className="input"
            value={formData.saleStartDate}
            onChange={(e) => setFormData({ ...formData, saleStartDate: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Sale End Date</label>
          <input
            type="datetime-local"
            className="input"
            value={formData.saleEndDate}
            onChange={(e) => setFormData({ ...formData, saleEndDate: e.target.value })}
          />
        </div>
      </div>

      <Switch
        label="On sale"
        description="Guests can buy this ticket while it is on sale."
        checked={formData.isActive}
        onChange={(checked) => setFormData({ ...formData, isActive: checked })}
      />

        </form>
      </Modal>
    </div>
  );
}

// Payment gateway Component
function PaymentGatewayConfig({ eventId }: { eventId: string }) {
  const [gateway, setGateway] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    gateway: 'free' as string,
    isLive: false,
    currency: 'USD',
    stripePublicKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    paystackPublicKey: '',
    paystackSecretKey: '',
    flutterwavePublicKey: '',
    flutterwaveSecretKey: '',
    mtnMomoApiKey: '',
    mtnMomoApiSecret: '',
    mtnMomoSubscriptionKey: '',
    mtnMomoEnvironment: 'sandbox' as string,
    telecelCashApiKey: '',
    telecelCashApiSecret: '',
    telecelCashMerchantId: '',
    airteltigoCashApiKey: '',
    airteltigoCashApiSecret: '',
    airteltigoCashMerchantId: '',
    customGatewayName: '',
    customGatewayApiUrl: '',
    customGatewayApiKey: '',
    customGatewayApiSecret: '',
    customGatewayConfig: '',
    successUrl: '',
    cancelUrl: '',
  });

  useEffect(() => {
    fetchGateway();
  }, [eventId]);

  const fetchGateway = async () => {
    try {
      setLoading(true);
      const response = await ticketingApi.getPaymentGateway(eventId);
      if (response.data.gateway) {
        const g = response.data.gateway;
        setGateway(g);
        setFormData({
          gateway: g.gateway || 'free',
          isLive: g.isLive || false,
          currency: g.currency || 'USD',
          stripePublicKey: g.stripePublicKey || '',
          stripeSecretKey: g.stripeSecretKey || '',
          stripeWebhookSecret: g.stripeWebhookSecret || '',
          paystackPublicKey: g.paystackPublicKey || '',
          paystackSecretKey: g.paystackSecretKey || '',
          flutterwavePublicKey: g.flutterwavePublicKey || '',
          flutterwaveSecretKey: g.flutterwaveSecretKey || '',
          mtnMomoApiKey: g.mtnMomoApiKey || '',
          mtnMomoApiSecret: g.mtnMomoApiSecret || '',
          mtnMomoSubscriptionKey: g.mtnMomoSubscriptionKey || '',
          mtnMomoEnvironment: g.mtnMomoEnvironment || 'sandbox',
          telecelCashApiKey: g.telecelCashApiKey || '',
          telecelCashApiSecret: g.telecelCashApiSecret || '',
          telecelCashMerchantId: g.telecelCashMerchantId || '',
          airteltigoCashApiKey: g.airteltigoCashApiKey || '',
          airteltigoCashApiSecret: g.airteltigoCashApiSecret || '',
          airteltigoCashMerchantId: g.airteltigoCashMerchantId || '',
          customGatewayName: g.customGatewayName || '',
          customGatewayApiUrl: g.customGatewayApiUrl || '',
          customGatewayApiKey: g.customGatewayApiKey || '',
          customGatewayApiSecret: g.customGatewayApiSecret || '',
          customGatewayConfig: g.customGatewayConfig || '',
          successUrl: g.successUrl || '',
          cancelUrl: g.cancelUrl || '',
        });
      }
    } catch (error) {
      toast.error('Failed to load payment gateway');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data: any = {
        gateway: formData.gateway,
        isLive: formData.isLive,
        currency: formData.currency,
        successUrl: formData.successUrl || undefined,
        cancelUrl: formData.cancelUrl || undefined,
      };

      if (formData.gateway === 'stripe') {
        data.stripePublicKey = formData.stripePublicKey || undefined;
        if (formData.stripeSecretKey && !formData.stripeSecretKey.startsWith('****')) {
          data.stripeSecretKey = formData.stripeSecretKey;
        }
        if (formData.stripeWebhookSecret && formData.stripeWebhookSecret !== '****') {
          data.stripeWebhookSecret = formData.stripeWebhookSecret;
        }
      } else if (formData.gateway === 'paystack') {
        data.paystackPublicKey = formData.paystackPublicKey || undefined;
        if (formData.paystackSecretKey && !formData.paystackSecretKey.startsWith('****')) {
          data.paystackSecretKey = formData.paystackSecretKey;
        }
      } else if (formData.gateway === 'flutterwave') {
        data.flutterwavePublicKey = formData.flutterwavePublicKey || undefined;
        if (formData.flutterwaveSecretKey && !formData.flutterwaveSecretKey.startsWith('****')) {
          data.flutterwaveSecretKey = formData.flutterwaveSecretKey;
        }
      } else if (formData.gateway === 'mtn_momo') {
        data.mtnMomoApiKey = formData.mtnMomoApiKey || undefined;
        if (formData.mtnMomoApiSecret && !formData.mtnMomoApiSecret.startsWith('****')) {
          data.mtnMomoApiSecret = formData.mtnMomoApiSecret;
        }
        data.mtnMomoSubscriptionKey = formData.mtnMomoSubscriptionKey || undefined;
        data.mtnMomoEnvironment = formData.mtnMomoEnvironment;
      } else if (formData.gateway === 'telecel_cash') {
        data.telecelCashApiKey = formData.telecelCashApiKey || undefined;
        if (formData.telecelCashApiSecret && !formData.telecelCashApiSecret.startsWith('****')) {
          data.telecelCashApiSecret = formData.telecelCashApiSecret;
        }
        data.telecelCashMerchantId = formData.telecelCashMerchantId || undefined;
      } else if (formData.gateway === 'airteltigo_cash') {
        data.airteltigoCashApiKey = formData.airteltigoCashApiKey || undefined;
        if (formData.airteltigoCashApiSecret && !formData.airteltigoCashApiSecret.startsWith('****')) {
          data.airteltigoCashApiSecret = formData.airteltigoCashApiSecret;
        }
        data.airteltigoCashMerchantId = formData.airteltigoCashMerchantId || undefined;
      } else if (formData.gateway === 'custom') {
        data.customGatewayName = formData.customGatewayName || undefined;
        data.customGatewayApiUrl = formData.customGatewayApiUrl || undefined;
        data.customGatewayApiKey = formData.customGatewayApiKey || undefined;
        if (formData.customGatewayApiSecret && !formData.customGatewayApiSecret.startsWith('****')) {
          data.customGatewayApiSecret = formData.customGatewayApiSecret;
        }
        data.customGatewayConfig = formData.customGatewayConfig || undefined;
      }

      await ticketingApi.updatePaymentGateway(eventId, data);
      toast.success('Payment gateway updated');
      setShowForm(false);
      fetchGateway();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to update payment gateway'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="panel p-4 sm:p-5">
        <div className="space-y-2">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-10 w-full" />
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="panel p-4 sm:p-5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="panel-title">Payment gateway</h3>
          <button
            onClick={() => setShowForm(false)}
            className="text-surface-500 hover:text-navy-900"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Payment Gateway *</label>
            <select
              required
              className="input"
              value={formData.gateway}
              onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
            >
              <option value="free">Free (No Payment)</option>
              <option value="stripe">Stripe</option>
              <option value="paystack">Paystack</option>
              <option value="flutterwave">Flutterwave</option>
              <option value="paypal">PayPal</option>
              <option value="mtn_momo">MTN MoMo</option>
              <option value="telecel_cash">Telecel Cash</option>
              <option value="airteltigo_cash">Airteltigo Cash</option>
              <option value="custom">Custom Gateway</option>
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Currency *</label>
              <select
                required
                className="input"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center pt-8">
              <input
                type="checkbox"
                id="isLive"
                checked={formData.isLive}
                onChange={(e) => setFormData({ ...formData, isLive: e.target.checked })}
                className="h-4 w-4 text-navy-600 focus:ring-navy-500 border-surface-300 rounded"
              />
              <label htmlFor="isLive" className="ml-2 block text-sm text-surface-900">
                Live Mode (Production)
              </label>
            </div>
          </div>

          {/* Stripe Fields */}
          {formData.gateway === 'stripe' && (
            <div className="space-y-4 p-4 bg-surface-50 rounded-lg">
              <h4 className="font-medium text-brand-900">Stripe Configuration</h4>
              <div>
                <label className="label">Public Key</label>
                <input
                  type="text"
                  className="input"
                  value={formData.stripePublicKey}
                  onChange={(e) => setFormData({ ...formData, stripePublicKey: e.target.value })}
                  placeholder="pk_live_..."
                />
              </div>
              <div>
                <label className="label">Secret Key</label>
                <input
                  type="password"
                  className="input"
                  value={formData.stripeSecretKey}
                  onChange={(e) => setFormData({ ...formData, stripeSecretKey: e.target.value })}
                  placeholder={formData.stripeSecretKey.startsWith('****') ? formData.stripeSecretKey : 'sk_live_...'}
                />
              </div>
              <div>
                <label className="label">Webhook Secret</label>
                <input
                  type="password"
                  className="input"
                  value={formData.stripeWebhookSecret}
                  onChange={(e) => setFormData({ ...formData, stripeWebhookSecret: e.target.value })}
                  placeholder={formData.stripeWebhookSecret === '****' ? '****' : 'whsec_...'}
                />
              </div>
            </div>
          )}

          {/* Paystack Fields */}
          {formData.gateway === 'paystack' && (
            <div className="space-y-4 p-4 bg-surface-50 rounded-lg">
              <h4 className="font-medium text-brand-900">Paystack Configuration</h4>
              <div>
                <label className="label">Public Key</label>
                <input
                  type="text"
                  className="input"
                  value={formData.paystackPublicKey}
                  onChange={(e) => setFormData({ ...formData, paystackPublicKey: e.target.value })}
                  placeholder="pk_live_..."
                />
              </div>
              <div>
                <label className="label">Secret Key</label>
                <input
                  type="password"
                  className="input"
                  value={formData.paystackSecretKey}
                  onChange={(e) => setFormData({ ...formData, paystackSecretKey: e.target.value })}
                  placeholder={formData.paystackSecretKey.startsWith('****') ? formData.paystackSecretKey : 'sk_live_...'}
                />
              </div>
            </div>
          )}

          {/* Flutterwave Fields */}
          {formData.gateway === 'flutterwave' && (
            <div className="space-y-4 p-4 bg-surface-50 rounded-lg">
              <h4 className="font-medium text-brand-900">Flutterwave Configuration</h4>
              <div>
                <label className="label">Public Key</label>
                <input
                  type="text"
                  className="input"
                  value={formData.flutterwavePublicKey}
                  onChange={(e) => setFormData({ ...formData, flutterwavePublicKey: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Secret Key</label>
                <input
                  type="password"
                  className="input"
                  value={formData.flutterwaveSecretKey}
                  onChange={(e) => setFormData({ ...formData, flutterwaveSecretKey: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* MTN MoMo Fields */}
          {formData.gateway === 'mtn_momo' && (
            <div className="space-y-4 p-4 bg-surface-50 rounded-lg">
              <h4 className="font-medium text-brand-900">MTN MoMo Configuration</h4>
              <div>
                <label className="label">API Key</label>
                <input
                  type="text"
                  className="input"
                  value={formData.mtnMomoApiKey}
                  onChange={(e) => setFormData({ ...formData, mtnMomoApiKey: e.target.value })}
                />
              </div>
              <div>
                <label className="label">API Secret</label>
                <input
                  type="password"
                  className="input"
                  value={formData.mtnMomoApiSecret}
                  onChange={(e) => setFormData({ ...formData, mtnMomoApiSecret: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Subscription Key</label>
                <input
                  type="text"
                  className="input"
                  value={formData.mtnMomoSubscriptionKey}
                  onChange={(e) => setFormData({ ...formData, mtnMomoSubscriptionKey: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Environment</label>
                <select
                  className="input"
                  value={formData.mtnMomoEnvironment}
                  onChange={(e) => setFormData({ ...formData, mtnMomoEnvironment: e.target.value })}
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>
          )}

          {/* Telecel Cash Fields */}
          {formData.gateway === 'telecel_cash' && (
            <div className="space-y-4 p-4 bg-surface-50 rounded-lg">
              <h4 className="font-medium text-brand-900">Telecel Cash Configuration</h4>
              <div>
                <label className="label">API Key</label>
                <input
                  type="text"
                  className="input"
                  value={formData.telecelCashApiKey}
                  onChange={(e) => setFormData({ ...formData, telecelCashApiKey: e.target.value })}
                />
              </div>
              <div>
                <label className="label">API Secret</label>
                <input
                  type="password"
                  className="input"
                  value={formData.telecelCashApiSecret}
                  onChange={(e) => setFormData({ ...formData, telecelCashApiSecret: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Merchant ID</label>
                <input
                  type="text"
                  className="input"
                  value={formData.telecelCashMerchantId}
                  onChange={(e) => setFormData({ ...formData, telecelCashMerchantId: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Airteltigo Cash Fields */}
          {formData.gateway === 'airteltigo_cash' && (
            <div className="space-y-4 p-4 bg-surface-50 rounded-lg">
              <h4 className="font-medium text-brand-900">Airteltigo Cash Configuration</h4>
              <div>
                <label className="label">API Key</label>
                <input
                  type="text"
                  className="input"
                  value={formData.airteltigoCashApiKey}
                  onChange={(e) => setFormData({ ...formData, airteltigoCashApiKey: e.target.value })}
                />
              </div>
              <div>
                <label className="label">API Secret</label>
                <input
                  type="password"
                  className="input"
                  value={formData.airteltigoCashApiSecret}
                  onChange={(e) => setFormData({ ...formData, airteltigoCashApiSecret: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Merchant ID</label>
                <input
                  type="text"
                  className="input"
                  value={formData.airteltigoCashMerchantId}
                  onChange={(e) => setFormData({ ...formData, airteltigoCashMerchantId: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Custom Gateway Fields */}
          {formData.gateway === 'custom' && (
            <div className="space-y-4 p-4 bg-surface-50 rounded-lg">
              <h4 className="font-medium text-brand-900">Custom Gateway Configuration</h4>
              <div>
                <label className="label">Gateway Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.customGatewayName}
                  onChange={(e) => setFormData({ ...formData, customGatewayName: e.target.value })}
                  placeholder="My Custom Gateway"
                />
              </div>
              <div>
                <label className="label">API URL</label>
                <input
                  type="url"
                  className="input"
                  value={formData.customGatewayApiUrl}
                  onChange={(e) => setFormData({ ...formData, customGatewayApiUrl: e.target.value })}
                  placeholder="https://api.example.com"
                />
              </div>
              <div>
                <label className="label">API Key</label>
                <input
                  type="text"
                  className="input"
                  value={formData.customGatewayApiKey}
                  onChange={(e) => setFormData({ ...formData, customGatewayApiKey: e.target.value })}
                />
              </div>
              <div>
                <label className="label">API Secret</label>
                <input
                  type="password"
                  className="input"
                  value={formData.customGatewayApiSecret}
                  onChange={(e) => setFormData({ ...formData, customGatewayApiSecret: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Additional Config (JSON)</label>
                <textarea
                  className="input"
                  rows={3}
                  value={formData.customGatewayConfig}
                  onChange={(e) => setFormData({ ...formData, customGatewayConfig: e.target.value })}
                  placeholder='{"key": "value"}'
                />
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Success URL</label>
              <input
                type="url"
                className="input"
                value={formData.successUrl}
                onChange={(e) => setFormData({ ...formData, successUrl: e.target.value })}
                placeholder="https://example.com/success"
              />
            </div>
            <div>
              <label className="label">Cancel URL</label>
              <input
                type="url"
                className="input"
                value={formData.cancelUrl}
                onChange={(e) => setFormData({ ...formData, cancelUrl: e.target.value })}
                placeholder="https://example.com/cancel"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="panel-title">Payment Gateway</h3>
          <p className="text-sm text-surface-500">Configure payment processing for ticket sales</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-outline">
          {gateway ? 'Edit Configuration' : 'Configure Gateway'}
        </button>
      </div>

      {gateway ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
            <div>
              <p className="font-medium text-brand-900 capitalize">{gateway.gateway.replace('_', ' ')}</p>
              <p className="text-sm text-surface-500">
                {gateway.currency} | {gateway.isLive ? 'Live Mode' : 'Test Mode'}
              </p>
            </div>
            <span className={cn(
              'px-2 py-1 text-xs font-medium rounded',
              gateway.isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
            )}>
              {gateway.isLive ? 'Production' : 'Sandbox'}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-surface-600 mb-4">No payment gateway configured</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Configure Payment Gateway
          </button>
        </div>
      )}

    </div>
  );
}
