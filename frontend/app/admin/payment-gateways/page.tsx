'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { paymentGatewaysApi } from '@/lib/api';
import {
  GATEWAY_OPTIONS,
  GatewayType,
  getCurrencyOption,
  getGatewayCurrencyOptions,
  normalizeCurrencyCode,
} from '@/lib/paymentGatewayConfig';

interface PaymentGateway {
  id: string;
  name: string;
  gateway: GatewayType;
  description?: string;
  isActive: boolean;
  isLive: boolean;
  currency: string;
  stripePublicKey?: string;
  paystackPublicKey?: string;
  flutterwavePublicKey?: string;
  hubtelClientId?: string;
}

export default function PaymentGatewaysPage() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);

  useEffect(() => {
    void fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      const response = await paymentGatewaysApi.list();
      setGateways(response.data.gateways || []);
    } catch (error) {
      console.error('Failed to fetch gateways:', error);
      toast.error('Failed to load payment gateways');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payment gateway?')) return;
    try {
      await paymentGatewaysApi.delete(id);
      toast.success('Gateway deleted');
      await fetchGateways();
    } catch (error: any) {
      console.error('Failed to delete gateway:', error);
      toast.error(error?.response?.data?.error || 'Failed to delete gateway');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-surface-500">Loading payment gateways...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Payment Gateways</h1>
          <p className="text-sm text-surface-600 mt-1">
            Configure system gateways and their currency. Events can then enable gateways per event.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingGateway(null);
            setShowModal(true);
          }}
          className="btn-primary"
        >
          Add Gateway
        </button>
      </div>

      {gateways.length === 0 ? (
        <div className="rounded-xl border border-surface-200 bg-white p-8 text-center">
          <p className="text-surface-700 font-medium">No gateways configured yet.</p>
          <p className="text-sm text-surface-500 mt-1">Create your first gateway to start enabling event payments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {gateways.map((gateway) => (
            <div key={gateway.id} className="rounded-xl border border-surface-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-brand-900 truncate">{gateway.name}</h2>
                  {gateway.description ? (
                    <p className="text-sm text-surface-600 mt-1 line-clamp-2">{gateway.description}</p>
                  ) : null}
                </div>
                <span className="text-xs rounded-full bg-surface-100 border border-surface-200 px-2 py-1 uppercase tracking-wide">
                  {gateway.gateway}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span
                  className={[
                    'rounded-full px-2 py-1 border',
                    gateway.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-surface-100 text-surface-600 border-surface-200',
                  ].join(' ')}
                >
                  {gateway.isActive ? 'Active' : 'Inactive'}
                </span>
                <span
                  className={[
                    'rounded-full px-2 py-1 border',
                    gateway.isLive
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200',
                  ].join(' ')}
                >
                  {gateway.isLive ? 'Live' : 'Test'}
                </span>
                <span className="rounded-full px-2 py-1 border border-surface-200 bg-white text-surface-700">
                  {gateway.currency}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setEditingGateway(gateway);
                    setShowModal(true);
                  }}
                  className="btn-outline"
                >
                  Edit
                </button>
                <button onClick={() => handleDelete(gateway.id)} className="btn-ghost text-rose-600">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PaymentGatewayModal
          gateway={editingGateway}
          onClose={() => {
            setShowModal(false);
            setEditingGateway(null);
          }}
          onSuccess={async () => {
            setShowModal(false);
            setEditingGateway(null);
            await fetchGateways();
          }}
        />
      )}
    </div>
  );
}

function PaymentGatewayModal({
  gateway,
  onClose,
  onSuccess,
}: {
  gateway: PaymentGateway | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: gateway?.name || '',
    gateway: gateway?.gateway || ('stripe' as GatewayType),
    description: gateway?.description || '',
    isActive: gateway?.isActive ?? true,
    isLive: gateway?.isLive ?? false,
    currency: normalizeCurrencyCode(gateway?.currency || 'USD') || 'USD',
    stripePublicKey: gateway?.stripePublicKey || '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    paystackPublicKey: gateway?.paystackPublicKey || '',
    paystackSecretKey: '',
    flutterwavePublicKey: gateway?.flutterwavePublicKey || '',
    flutterwaveSecretKey: '',
    hubtelClientId: gateway?.hubtelClientId || '',
    hubtelClientSecret: '',
    hubtelMerchantId: '',
    hubtelAccountNumber: '',
    hubtelWebhookSecret: '',
    hubtelEnvironment: 'sandbox' as 'sandbox' | 'production',
    hubtelConfigJson: '',
    mtnMomoApiKey: '',
    mtnMomoApiSecret: '',
    mtnMomoSubscriptionKey: '',
    mtnMomoEnvironment: 'sandbox' as 'sandbox' | 'production',
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
  });
  const [saving, setSaving] = useState(false);

  const currencyOptions = useMemo(() => {
    const currentCode = normalizeCurrencyCode(formData.currency);
    const options = getGatewayCurrencyOptions(formData.gateway);
    if (!currentCode) return options;
    if (options.some((option) => option.code === currentCode)) return options;
    return [...options, getCurrencyOption(currentCode)];
  }, [formData.currency, formData.gateway]);

  useEffect(() => {
    const normalized = normalizeCurrencyCode(formData.currency);
    if (!normalized) {
      setFormData((prev) => ({ ...prev, currency: currencyOptions[0]?.code || 'USD' }));
      return;
    }
    if (!currencyOptions.some((option) => option.code === normalized)) {
      setFormData((prev) => ({ ...prev, currency: currencyOptions[0]?.code || 'USD' }));
    }
  }, [currencyOptions, formData.currency]);

  const setField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const credentialPlaceholder = (placeholder: string) =>
    gateway ? 'Leave blank to keep current value' : placeholder;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        currency: normalizeCurrencyCode(formData.currency) || 'USD',
      };

      if (gateway) {
        await paymentGatewaysApi.update(gateway.id, payload);
        toast.success('Gateway updated');
      } else {
        await paymentGatewaysApi.create(payload);
        toast.success('Gateway created');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to save gateway:', error);
      toast.error(error?.response?.data?.error || 'Failed to save gateway');
    } finally {
      setSaving(false);
    }
  };

  const renderGatewayFields = () => {
    switch (formData.gateway) {
      case 'stripe':
        return (
          <>
            <Field label="Public Key">
              <input type="text" className="input" value={formData.stripePublicKey} onChange={(e) => setField('stripePublicKey', e.target.value)} placeholder="pk_live_..." />
            </Field>
            <Field label="Secret Key">
              <input type="password" className="input" value={formData.stripeSecretKey} onChange={(e) => setField('stripeSecretKey', e.target.value)} placeholder={credentialPlaceholder('sk_live_...')} />
            </Field>
            <Field label="Webhook Secret">
              <input type="password" className="input" value={formData.stripeWebhookSecret} onChange={(e) => setField('stripeWebhookSecret', e.target.value)} placeholder={credentialPlaceholder('whsec_...')} />
            </Field>
          </>
        );
      case 'paystack':
        return (
          <>
            <Field label="Public Key">
              <input type="text" className="input" value={formData.paystackPublicKey} onChange={(e) => setField('paystackPublicKey', e.target.value)} placeholder="pk_live_..." />
            </Field>
            <Field label="Secret Key">
              <input type="password" className="input" value={formData.paystackSecretKey} onChange={(e) => setField('paystackSecretKey', e.target.value)} placeholder={credentialPlaceholder('sk_live_...')} />
            </Field>
          </>
        );
      case 'flutterwave':
        return (
          <>
            <Field label="Public Key">
              <input type="text" className="input" value={formData.flutterwavePublicKey} onChange={(e) => setField('flutterwavePublicKey', e.target.value)} placeholder="FLWPUBK_..." />
            </Field>
            <Field label="Secret Key">
              <input type="password" className="input" value={formData.flutterwaveSecretKey} onChange={(e) => setField('flutterwaveSecretKey', e.target.value)} placeholder={credentialPlaceholder('FLWSECK_...')} />
            </Field>
          </>
        );
      case 'hubtel':
        return (
          <>
            <Field label="Client ID">
              <input type="text" className="input" value={formData.hubtelClientId} onChange={(e) => setField('hubtelClientId', e.target.value)} />
            </Field>
            <Field label="Client Secret">
              <input type="password" className="input" value={formData.hubtelClientSecret} onChange={(e) => setField('hubtelClientSecret', e.target.value)} placeholder={credentialPlaceholder('')} />
            </Field>
            <Field label="Merchant ID">
              <input type="text" className="input" value={formData.hubtelMerchantId} onChange={(e) => setField('hubtelMerchantId', e.target.value)} />
            </Field>
            <Field label="Account Number">
              <input type="text" className="input" value={formData.hubtelAccountNumber} onChange={(e) => setField('hubtelAccountNumber', e.target.value)} />
            </Field>
            <Field label="Webhook Secret">
              <input type="password" className="input" value={formData.hubtelWebhookSecret} onChange={(e) => setField('hubtelWebhookSecret', e.target.value)} placeholder={credentialPlaceholder('')} />
            </Field>
            <Field label="Environment">
              <select className="input" value={formData.hubtelEnvironment} onChange={(e) => setField('hubtelEnvironment', e.target.value as 'sandbox' | 'production')}>
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </Field>
            <Field label="Config JSON">
              <textarea className="input min-h-[96px]" value={formData.hubtelConfigJson} onChange={(e) => setField('hubtelConfigJson', e.target.value)} placeholder='{"initializeUrl":"...","verifyUrl":"..."}' />
            </Field>
          </>
        );
      case 'mtn_momo':
        return (
          <>
            <Field label="API Key">
              <input type="text" className="input" value={formData.mtnMomoApiKey} onChange={(e) => setField('mtnMomoApiKey', e.target.value)} />
            </Field>
            <Field label="API Secret">
              <input type="password" className="input" value={formData.mtnMomoApiSecret} onChange={(e) => setField('mtnMomoApiSecret', e.target.value)} placeholder={credentialPlaceholder('')} />
            </Field>
            <Field label="Subscription Key">
              <input type="text" className="input" value={formData.mtnMomoSubscriptionKey} onChange={(e) => setField('mtnMomoSubscriptionKey', e.target.value)} />
            </Field>
            <Field label="Environment">
              <select className="input" value={formData.mtnMomoEnvironment} onChange={(e) => setField('mtnMomoEnvironment', e.target.value as 'sandbox' | 'production')}>
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </Field>
          </>
        );
      case 'telecel_cash':
        return (
          <>
            <Field label="API Key">
              <input type="text" className="input" value={formData.telecelCashApiKey} onChange={(e) => setField('telecelCashApiKey', e.target.value)} />
            </Field>
            <Field label="API Secret">
              <input type="password" className="input" value={formData.telecelCashApiSecret} onChange={(e) => setField('telecelCashApiSecret', e.target.value)} placeholder={credentialPlaceholder('')} />
            </Field>
            <Field label="Merchant ID">
              <input type="text" className="input" value={formData.telecelCashMerchantId} onChange={(e) => setField('telecelCashMerchantId', e.target.value)} />
            </Field>
          </>
        );
      case 'airteltigo_cash':
        return (
          <>
            <Field label="API Key">
              <input type="text" className="input" value={formData.airteltigoCashApiKey} onChange={(e) => setField('airteltigoCashApiKey', e.target.value)} />
            </Field>
            <Field label="API Secret">
              <input type="password" className="input" value={formData.airteltigoCashApiSecret} onChange={(e) => setField('airteltigoCashApiSecret', e.target.value)} placeholder={credentialPlaceholder('')} />
            </Field>
            <Field label="Merchant ID">
              <input type="text" className="input" value={formData.airteltigoCashMerchantId} onChange={(e) => setField('airteltigoCashMerchantId', e.target.value)} />
            </Field>
          </>
        );
      case 'custom':
        return (
          <>
            <Field label="Gateway Name">
              <input type="text" className="input" value={formData.customGatewayName} onChange={(e) => setField('customGatewayName', e.target.value)} placeholder="Custom Gateway" />
            </Field>
            <Field label="API URL">
              <input type="url" className="input" value={formData.customGatewayApiUrl} onChange={(e) => setField('customGatewayApiUrl', e.target.value)} placeholder="https://api.example.com" />
            </Field>
            <Field label="API Key">
              <input type="text" className="input" value={formData.customGatewayApiKey} onChange={(e) => setField('customGatewayApiKey', e.target.value)} />
            </Field>
            <Field label="API Secret">
              <input type="password" className="input" value={formData.customGatewayApiSecret} onChange={(e) => setField('customGatewayApiSecret', e.target.value)} placeholder={credentialPlaceholder('')} />
            </Field>
            <Field label="Additional Config (JSON)">
              <textarea className="input min-h-[96px]" value={formData.customGatewayConfig} onChange={(e) => setField('customGatewayConfig', e.target.value)} placeholder='{"key":"value"}' />
            </Field>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-3 sm:p-6 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-surface-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200">
          <h2 className="text-lg font-semibold text-brand-900">
            {gateway ? 'Edit Gateway' : 'Create Gateway'}
          </h2>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Gateway Name *">
              <input required type="text" className="input" value={formData.name} onChange={(e) => setField('name', e.target.value)} placeholder="Primary Paystack" />
            </Field>
            <Field label="Gateway Type *">
              <select
                required
                className="input"
                value={formData.gateway}
                onChange={(e) => setField('gateway', e.target.value as GatewayType)}
              >
                {GATEWAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea className="input min-h-[78px]" value={formData.description} onChange={(e) => setField('description', e.target.value)} placeholder="Where and how this gateway is used." />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Currency *">
              <select
                className="input"
                value={normalizeCurrencyCode(formData.currency)}
                onChange={(e) => setField('currency', e.target.value)}
              >
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} - {option.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-surface-500 mt-1">
                Currency list adjusts to the selected gateway.
              </p>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <label className="rounded-lg border border-surface-200 px-3 py-2 text-sm flex items-center gap-2">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setField('isActive', e.target.checked)} />
                Active
              </label>
              <label className="rounded-lg border border-surface-200 px-3 py-2 text-sm flex items-center gap-2">
                <input type="checkbox" checked={formData.isLive} onChange={(e) => setField('isLive', e.target.checked)} />
                Live mode
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-surface-200 p-4 bg-surface-50">
            <p className="text-sm font-semibold text-brand-900 mb-3">Gateway Credentials</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{renderGatewayFields()}</div>
          </div>

          {gateway ? (
            <p className="text-xs text-surface-500">
              Existing secret values are masked. Leave secret fields empty to keep current values.
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : gateway ? 'Update Gateway' : 'Create Gateway'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-surface-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
