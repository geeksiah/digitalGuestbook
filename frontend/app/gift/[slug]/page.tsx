'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE_URL, giftingApi } from '@/lib/api';
import toast from 'react-hot-toast';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');

interface GiftPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  thumbnailPath: string | null;
  thumbnailUrl?: string | null;
}

interface PaymentGatewayOption {
  id: string;
  name: string;
  gateway: string;
  currency: string;
  publicKey?: string | null;
  splitConfig?: {
    subaccount: string;
    bearer: string;
    ownerWalletVerified?: boolean;
  } | null;
}

interface SettlementPolicy {
  cashGift: 'split_to_owner_subaccount' | 'platform_settlement';
  packagePurchase: 'platform_only';
  mixedPaystackCheckoutAllowed: boolean;
}

export default function GiftPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eventName, setEventName] = useState('');
  const [packages, setPackages] = useState<GiftPackage[]>([]);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGatewayOption[]>([]);
  const [settlementPolicy, setSettlementPolicy] = useState<SettlementPolicy | null>(null);
  const [cashGiftAmount, setCashGiftAmount] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [selectedGatewayId, setSelectedGatewayId] = useState('');
  const [note, setNote] = useState('');

  const toAbsoluteAssetUrl = (value: string | null | undefined) => {
    if (!value) return null;
    const raw = value.trim();
    if (!raw) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;
    if (raw.startsWith('/storage/v1/object/public/')) {
      return SUPABASE_URL ? `${SUPABASE_URL}${raw}` : `${API_BASE_URL}${raw}`;
    }
    if (raw.startsWith('/uploads/') || raw.startsWith('/generated/') || raw.startsWith('/api/')) {
      return `${API_BASE_URL}${raw}`;
    }
    const normalized = raw.replace(/^\/+/, '');
    if (normalized.includes('/') && SUPABASE_URL) {
      return `${SUPABASE_URL}/storage/v1/object/public/media-assets/${normalized}`;
    }
    return `${API_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
  };

  const resolveGiftThumbnailUrl = (pkg: GiftPackage) =>
    toAbsoluteAssetUrl(pkg.thumbnailUrl) || toAbsoluteAssetUrl(pkg.thumbnailPath);

  const adjustQuantity = (giftPackageId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[giftPackageId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [giftPackageId]: next };
    });
  };

  useEffect(() => {
    if (!slug) return;

    const run = async () => {
      try {
        const response = await giftingApi.getPublicOptions(slug);
        const gateways = response.data.paymentGateways || [];
        setEventName(response.data.event.name);
        setPackages(response.data.packages || []);
        setPaymentGateways(gateways);
        setSettlementPolicy(response.data.settlementPolicy || null);
        if (gateways.length > 0) {
          setSelectedGatewayId((current) => current || gateways[0].id);
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Unable to load gifting options');
      } finally {
        setLoading(false);
      }
    };
    if (slug) run();
  }, [slug]);

  const selectedPackageItems = useMemo(
    () => Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([giftPackageId, quantity]) => ({ giftPackageId, quantity })),
    [quantities]
  );

  const selectedPackages = useMemo(
    () =>
      selectedPackageItems
        .map((item) => {
          const pkg = packages.find((candidate) => candidate.id === item.giftPackageId);
          if (!pkg) return null;
          return {
            ...item,
            name: pkg.name,
            price: pkg.price,
            currency: pkg.currency,
            lineTotal: pkg.price * item.quantity,
          };
        })
        .filter(Boolean) as Array<{
        giftPackageId: string;
        quantity: number;
        name: string;
        price: number;
        currency: string;
        lineTotal: number;
      }>,
    [packages, selectedPackageItems]
  );

  const totalAmount = useMemo(() => {
    const packageTotal = selectedPackageItems.reduce((sum, item) => {
      const pkg = packages.find((p) => p.id === item.giftPackageId);
      return sum + (pkg ? pkg.price * item.quantity : 0);
    }, 0);
    return packageTotal + cashGiftAmount;
  }, [selectedPackageItems, packages, cashGiftAmount]);

  const selectedGateway = useMemo(() => {
    if (!paymentGateways.length) return null;
    return (
      paymentGateways.find((gateway) => gateway.id === selectedGatewayId) ||
      paymentGateways[0]
    );
  }, [paymentGateways, selectedGatewayId]);
  const paymentMethod = selectedGateway?.gateway || null;
  const hasPackageSelection = selectedPackageItems.length > 0;
  const hasCashSelection = cashGiftAmount > 0;
  const paystackMixedSelection =
    selectedGateway?.gateway === 'paystack' && hasPackageSelection && hasCashSelection;
  const selectedPackageCurrencies = useMemo(() => {
    const currencies = new Set<string>();
    selectedPackageItems.forEach((item) => {
      const pkg = packages.find((candidate) => candidate.id === item.giftPackageId);
      if (pkg?.currency) currencies.add(pkg.currency.toUpperCase());
    });
    return Array.from(currencies);
  }, [packages, selectedPackageItems]);
  const hasGatewayCurrencyMismatch =
    Boolean(selectedGateway?.currency) &&
    selectedPackageCurrencies.length > 0 &&
    selectedPackageCurrencies.some(
      (currency) => currency !== String(selectedGateway?.currency || '').toUpperCase()
    );
  const canSubmitGift =
    Boolean(guestName.trim()) &&
    totalAmount > 0 &&
    (!paymentGateways.length || Boolean(selectedGateway?.id)) &&
    !paystackMixedSelection &&
    !hasGatewayCurrencyMismatch;
  const selectedQuantityTotal = useMemo(
    () => selectedPackageItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedPackageItems]
  );
  const selectedPackageTotal = useMemo(
    () => selectedPackages.reduce((sum, item) => sum + item.lineTotal, 0),
    [selectedPackages]
  );

  const submitCheckout = async () => {
    if (!guestName.trim()) {
      toast.error('Your name is required');
      return;
    }
    if (totalAmount <= 0) {
      toast.error('Please select cash gift or package(s)');
      return;
    }
    if (paystackMixedSelection) {
      toast.error('Use separate payments for cash gift and package purchase when using Paystack');
      return;
    }
    if (hasGatewayCurrencyMismatch) {
      toast.error('Selected gateway currency does not match selected package currency');
      return;
    }

    setSubmitting(true);
    try {
      const response = await giftingApi.checkout(slug, {
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim() || undefined,
        guestPhone: guestPhone.trim() || undefined,
        paymentGatewayId: selectedGateway?.id || undefined,
        paymentMethod: paymentMethod || undefined,
        deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        note: note.trim() || undefined,
        cashGiftAmount: cashGiftAmount > 0 ? cashGiftAmount : undefined,
        packageItems: selectedPackageItems.length ? selectedPackageItems : undefined,
      });
      const nextAction = response.data?.nextAction;
      if (nextAction?.type === 'REDIRECT' && nextAction?.url) {
        window.location.href = String(nextAction.url);
        return;
      }
      toast.success('Checkout initialized. Complete payment to submit your gift.');
      setQuantities({});
      setCashGiftAmount(0);
      setGuestName('');
      setGuestEmail('');
      setGuestPhone('');
      setDeliveryDate('');
      setNote('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit gift');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-emerald-50 to-white pb-32">
      <div className="mx-auto w-full max-w-[430px] px-3 py-5 space-y-4">
        <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_12px_40px_rgba(2,23,20,0.10)]">
          <div className="border-b border-surface-100 bg-gradient-to-br from-white via-emerald-50/55 to-emerald-100/35 px-4 pb-4 pt-5">
            <h1 className="text-xl font-bold tracking-tight text-brand-950">{eventName}</h1>
            <p className="mt-1 text-sm text-surface-600">
              Choose package gifts, add a cash gift, then complete checkout.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="badge badge-info">{packages.length} packages</span>
              <span className="badge badge-success">{selectedQuantityTotal} selected</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3">
            {packages.map((pkg) => {
              const thumbnailUrl = resolveGiftThumbnailUrl(pkg);
              const quantity = quantities[pkg.id] || 0;
              return (
                <article key={pkg.id} className="overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/45">
                  <div className="h-32 bg-gradient-to-br from-emerald-100/75 via-emerald-50/55 to-white flex items-center justify-center">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={pkg.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs font-medium text-surface-500">No image</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-brand-900">{pkg.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-surface-600">{pkg.description || 'Gift package'}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-surface-200 bg-white">
                        <button
                          type="button"
                          className="h-8 w-8 text-base font-semibold text-brand-900"
                          onClick={() => adjustQuantity(pkg.id, -1)}
                          aria-label={`Decrease ${pkg.name}`}
                        >
                          -
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold text-brand-900">{quantity}</span>
                        <button
                          type="button"
                          className="h-8 w-8 text-base font-semibold text-brand-900"
                          onClick={() => adjustQuantity(pkg.id, 1)}
                          aria-label={`Increase ${pkg.name}`}
                        >
                          +
                        </button>
                      </div>
                      <p className="text-sm font-bold text-brand-900">{pkg.currency} {pkg.price.toFixed(0)}</p>
                    </div>
                  </div>
                </article>
              );
            })}
            {packages.length === 0 ? (
              <div className="col-span-2 rounded-xl border border-dashed border-surface-300 bg-surface-50 px-4 py-6 text-center text-sm text-surface-600">
                No gift packages available yet.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-surface-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-brand-900">Gift Summary</h2>
            <p className="text-xs font-medium text-surface-500">Selected items update instantly</p>
          </div>
          <label className="label mb-0 text-brand-900">Cash Gift Amount</label>
          <input
            type="number"
            min={0}
            className="input"
            placeholder="0.00"
            value={cashGiftAmount || ''}
            onChange={(event) => setCashGiftAmount(Math.max(0, Number(event.target.value || 0)))}
          />

          {selectedPackages.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
              {selectedPackages.map((item) => (
                <div key={item.giftPackageId} className="flex items-center justify-between gap-3 text-sm">
                  <p className="min-w-0 truncate text-surface-700">
                    {item.name} <span className="text-surface-500">x{item.quantity}</span>
                  </p>
                  <p className="font-semibold text-brand-900">{item.currency} {item.lineTotal.toFixed(2)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-surface-200 pt-2 text-sm font-semibold">
                <p className="text-surface-700">Packages Subtotal</p>
                <p className="text-brand-900">
                  {(selectedPackageCurrencies[0] || selectedGateway?.currency || 'USD')} {selectedPackageTotal.toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-surface-300 bg-surface-50 p-3 text-sm text-surface-600">
              No package selected yet. Use the plus buttons above to add gifts.
            </p>
          )}
        </section>

        <section id="gift-checkout" className="rounded-2xl border border-surface-200 bg-white p-4 space-y-3">
          <h2 className="text-base font-semibold text-brand-900">Checkout Details</h2>
          <input className="input" placeholder="Your name" value={guestName} onChange={(event) => setGuestName(event.target.value)} />
          <input className="input" placeholder="Email (optional)" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} />
          <input className="input" placeholder="Phone (optional)" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} />
          <input type="date" className="input" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
          <select
            className="input"
            value={selectedGateway?.id || ''}
            onChange={(event) => setSelectedGatewayId(event.target.value)}
            disabled={paymentGateways.length === 0}
          >
            {paymentGateways.length > 0 ? (
              paymentGateways.map((gateway) => (
                <option key={gateway.id} value={gateway.id}>
                  {gateway.name} ({gateway.gateway.toUpperCase()} - {gateway.currency})
                </option>
              ))
            ) : (
              <option value="">No configured gateway</option>
            )}
          </select>
          {paymentGateways.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No payment gateway has been enabled for this event yet.
            </div>
          ) : null}
          {selectedGateway?.splitConfig?.subaccount ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Cash gifts are auto-split to the owner subaccount. Package purchases are settled to platform only.
            </div>
          ) : null}
          {paystackMixedSelection ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              For secure split accounting, submit cash gift and package purchase separately on Paystack.
            </div>
          ) : null}
          {settlementPolicy?.cashGift === 'platform_settlement' ? (
            <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-xs text-surface-700">
              Owner split account is not connected yet. Cash gifts will be handled via platform settlement.
            </div>
          ) : null}
          {hasGatewayCurrencyMismatch ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              Selected gateway currency does not match selected package currency.
            </div>
          ) : null}
          <textarea className="input min-h-[88px]" placeholder="Notes (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
          <button
            className="btn-primary w-full justify-center"
            disabled={submitting || !canSubmitGift}
            onClick={submitCheckout}
          >
            {submitting ? 'Submitting...' : 'Complete Gift'}
          </button>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-emerald-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[430px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-surface-500">Total</p>
            <p className="text-sm font-semibold text-brand-900">
              {(selectedPackageCurrencies[0] || selectedGateway?.currency || 'USD')} {totalAmount.toFixed(2)}
            </p>
            <p className="text-[11px] text-surface-500">{selectedQuantityTotal} package item(s)</p>
          </div>
          <button
            type="button"
            className="btn-primary px-5"
            onClick={() => document.getElementById('gift-checkout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {canSubmitGift ? 'Complete Gift' : 'Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
}

