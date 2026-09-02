'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { paymentGatewaysApi } from '@/lib/api';
import { getErrorMessage, humanizeEnum } from '@/lib/utils';
import {
  EmptyState,
  PageHeader,
  PageSkeleton,
  StatusBadge,
  SubmitButton,
  Switch,
} from '@/components/ui/Primitives';
import { ConfirmDialog, Menu, MenuItem, Modal } from '@/components/ui/Overlay';
import { Plus } from '@/components/ui/icons';
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
  const [deletingGateway, setDeletingGateway] = useState<PaymentGateway | null>(null);

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
    try {
      await paymentGatewaysApi.delete(id);
      toast.success('Gateway deleted');
      await fetchGateways();
    } catch (error: any) {
      console.error('Failed to delete gateway:', error);
      toast.error(getErrorMessage(error, 'Could not delete this gateway.'));
    }
  };

  if (loading) {
    return <PageSkeleton stats={0} rows={4} />;
  }

  return (
    <div className="page">
      <PageHeader
        title="Payment gateways"
        actions={
          <button
            onClick={() => {
              setEditingGateway(null);
              setShowModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Add gateway
          </button>
        }
        mobileActions={
          <button
            onClick={() => {
              setEditingGateway(null);
              setShowModal(true);
            }}
            className="icon-btn"
            aria-label="Add gateway"
          >
            <Plus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        }
      />

      {gateways.length === 0 ? (
        <EmptyState
          title="No gateways yet"
          hint="Add a gateway here, then enable it on the events that should use it."
          action={
            <button
              className="btn-primary btn-sm"
              onClick={() => {
                setEditingGateway(null);
                setShowModal(true);
              }}
            >
              Add gateway
            </button>
          }
        />
      ) : (
        <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white">
          {gateways.map((gateway) => (
            <div key={gateway.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-brand-900">{gateway.name}</span>
                  <StatusBadge tone={gateway.isActive ? 'success' : 'neutral'} dot>
                    {gateway.isActive ? 'Active' : 'Inactive'}
                  </StatusBadge>
                  <StatusBadge tone={gateway.isLive ? 'warning' : 'info'}>
                    {gateway.isLive ? 'Live keys' : 'Test keys'}
                  </StatusBadge>
                </div>
                <p className="mt-0.5 meta truncate">
                  {humanizeEnum(gateway.gateway)} &middot; {gateway.currency}
                  {gateway.description ? ` · ${gateway.description}` : ''}
                </p>
              </div>
              <button
                className="btn-outline btn-sm hidden shrink-0 sm:inline-flex"
                onClick={() => {
                  setEditingGateway(gateway);
                  setShowModal(true);
                }}
              >
                Edit
              </button>
              <Menu label={`Actions for ${gateway.name}`} sheetTitle={gateway.name}>
                <MenuItem
                  onClick={() => {
                    setEditingGateway(gateway);
                    setShowModal(true);
                  }}
                >
                  Edit gateway
                </MenuItem>
                <MenuItem danger onClick={() => setDeletingGateway(gateway)}>
                  Delete gateway
                </MenuItem>
              </Menu>
            </div>
          ))}
        </div>
      )}

      {showModal ? (
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
      ) : null}

      <ConfirmDialog
        open={Boolean(deletingGateway)}
        onClose={() => setDeletingGateway(null)}
        onConfirm={() => {
          if (deletingGateway) void handleDelete(deletingGateway.id);
          setDeletingGateway(null);
        }}
        title={`Delete ${deletingGateway?.name || 'gateway'}?`}
        body="Events using this gateway will stop accepting payments through it."
        confirmLabel="Delete gateway"
      />
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
      toast.error(getErrorMessage(error, 'Failed to save gateway'));
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
    <Modal
      open
      onClose={onClose}
      title={gateway ? gateway.name : 'New gateway'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <SubmitButton
            loading={saving}
            onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
            disabled={!formData.name.trim()}
          >
            {gateway ? 'Save' : 'Add gateway'}
          </SubmitButton>
        </>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        onKeyDown={(event) => {
          // Enter inside a text field should not submit past the footer button.
          if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'TEXTAREA') {
            event.preventDefault();
          }
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" htmlFor="gw-name">
            <input
              id="gw-name"
              data-autofocus
              required
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Primary Paystack"
            />
          </Field>
          <Field label="Provider" htmlFor="gw-type">
            <select
              id="gw-type"
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

        <Field label="Description" htmlFor="gw-description" optional>
          <textarea
            id="gw-description"
            className="input"
            rows={2}
            value={formData.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Where this gateway is used."
          />
        </Field>

        <Field label="Currency" htmlFor="gw-currency">
          <select
            id="gw-currency"
            className="input md:max-w-xs"
            value={normalizeCurrencyCode(formData.currency)}
            onChange={(e) => setField('currency', e.target.value)}
          >
            {currencyOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.code} - {option.name}
              </option>
            ))}
          </select>
          <p className="field-hint">The list follows the selected provider.</p>
        </Field>

        <div className="space-y-1 border-t border-surface-200 pt-3">
          <Switch
            label="Active"
            description="Events can only enable gateways that are active."
            checked={formData.isActive}
            onChange={(checked) => setField('isActive', checked)}
          />
          <Switch
            label="Live mode"
            description="Off means test keys and no real money moves."
            checked={formData.isLive}
            onChange={(checked) => setField('isLive', checked)}
          />
        </div>

        <div className="border-t border-surface-200 pt-4">
          <p className="label">Credentials</p>
          <div className="grid gap-4 md:grid-cols-2">{renderGatewayFields()}</div>
          {gateway ? (
            <p className="field-hint">Saved secrets stay hidden. Leave a secret field empty to keep it.</p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const text = (
    <>
      {label}
      {optional ? <span className="font-normal text-surface-600"> (optional)</span> : null}
    </>
  );

  // Without an explicit id, wrap the control so the label is still associated.
  if (!htmlFor) {
    return (
      <label className="block">
        <span className="label">{text}</span>
        {children}
      </label>
    );
  }

  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {text}
      </label>
      {children}
    </div>
  );
}
