'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE_URL, giftingApi } from '@/lib/api';
import BackendTemplateFrame, { useBackendTemplate } from '@/components/BackendTemplateFrame';
import toast from 'react-hot-toast';

interface GiftPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  thumbnailPath: string | null;
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
  const { loading: templateLoading, available: hasTemplate } = useBackendTemplate(slug, 'gifting');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState<boolean | null>(null);
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
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [paymentReference, setPaymentReference] = useState('');
  const [note, setNote] = useState('');
  const resolveGiftThumbnailUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
    return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  useEffect(() => {
    if (!slug || templateLoading || hasTemplate) return;

    const run = async () => {
      try {
        const response = await giftingApi.getPublicOptions(slug);
        setEventName(response.data.event.name);
        setPackages(response.data.packages || []);
        setPaymentGateways(response.data.paymentGateways || []);
        setSettlementPolicy(response.data.settlementPolicy || null);
        if (response.data.paymentGateways?.some((g: PaymentGatewayOption) => g.gateway === 'paystack')) {
          setPaymentMethod('paystack');
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Unable to load gifting options');
      } finally {
        setLoading(false);
      }
    };
    if (slug) run();
  }, [slug, templateLoading, hasTemplate]);

  if (templateLoading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  if (hasTemplate) {
    return <BackendTemplateFrame slug={slug} endpoint="gifting" />;
  }

  const selectedPackageItems = useMemo(
    () => Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([giftPackageId, quantity]) => ({ giftPackageId, quantity })),
    [quantities]
  );

  const totalAmount = useMemo(() => {
    const packageTotal = selectedPackageItems.reduce((sum, item) => {
      const pkg = packages.find((p) => p.id === item.giftPackageId);
      return sum + (pkg ? pkg.price * item.quantity : 0);
    }, 0);
    return packageTotal + cashGiftAmount;
  }, [selectedPackageItems, packages, cashGiftAmount]);

  const paystackGateway = useMemo(
    () => paymentGateways.find((g) => g.gateway === 'paystack'),
    [paymentGateways]
  );
  const hasPackageSelection = selectedPackageItems.length > 0;
  const hasCashSelection = cashGiftAmount > 0;
  const paystackMixedSelection = paymentMethod === 'paystack' && hasPackageSelection && hasCashSelection;

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

    setSubmitting(true);
    try {
      await giftingApi.checkout(slug, {
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim() || undefined,
        guestPhone: guestPhone.trim() || undefined,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        note: note.trim() || undefined,
        cashGiftAmount: cashGiftAmount > 0 ? cashGiftAmount : undefined,
        packageItems: selectedPackageItems.length ? selectedPackageItems : undefined,
      });
      toast.success('Thank you. Your gift has been submitted.');
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
    <div className="min-h-screen bg-surface-50 px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <h1 className="text-xl font-bold text-brand-900">{eventName}</h1>
          <p className="text-sm text-surface-600 mt-1">Would you like to gift the couple?</p>
          {accepted === null && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button className="btn-primary justify-center" onClick={() => setAccepted(true)}>Yes</button>
              <button className="btn-outline justify-center" onClick={() => setAccepted(false)}>No</button>
            </div>
          )}
          {accepted === false && (
            <p className="text-sm text-surface-600 mt-3">No problem. You can close this page anytime.</p>
          )}
        </div>

        {accepted && (
          <>
            <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-3">
              <h2 className="font-semibold text-brand-900">Cash Gift (MoMo)</h2>
              <input
                type="number"
                min={0}
                className="input"
                placeholder="Amount"
                value={cashGiftAmount}
                onChange={(e) => setCashGiftAmount(Math.max(0, Number(e.target.value || 0)))}
              />
            </div>

            <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-3">
              <h2 className="font-semibold text-brand-900">Gift Packages</h2>
              {packages.map((pkg) => (
                <div key={pkg.id} className="border border-surface-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {pkg.thumbnailPath ? (
                        <img
                          src={resolveGiftThumbnailUrl(pkg.thumbnailPath) || ''}
                          alt={pkg.name}
                          className="w-14 h-14 rounded-lg border border-surface-200 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg border border-surface-200 bg-surface-100 text-[10px] text-surface-400 font-medium flex items-center justify-center shrink-0">
                          No image
                        </div>
                      )}
                      <div className="min-w-0">
                      <p className="font-medium text-brand-900">{pkg.name}</p>
                      {pkg.description && <p className="text-xs text-surface-600 mt-1">{pkg.description}</p>}
                      <p className="text-sm text-surface-700 mt-1">{pkg.currency} {pkg.price.toFixed(2)}</p>
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      className="w-20 input text-center"
                      value={quantities[pkg.id] || 0}
                      onChange={(e) => setQuantities((prev) => ({ ...prev, [pkg.id]: Math.max(0, Number(e.target.value || 0)) }))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-3">
              <h2 className="font-semibold text-brand-900">Checkout</h2>
              <input className="input" placeholder="Your name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              <input className="input" placeholder="Email (optional)" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
              <input className="input" placeholder="Phone (optional)" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
              <input type="date" className="input" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {paystackGateway ? <option value="paystack">Paystack (Recommended)</option> : null}
                <option value="mtn_momo">MTN MoMo</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
              {paystackGateway?.splitConfig?.subaccount ? (
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
              <input className="input" placeholder="Payment reference (optional)" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
              <textarea className="input min-h-[88px]" placeholder="Notes (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="rounded-lg bg-surface-50 border border-surface-200 px-3 py-2 text-sm text-surface-700">
                Total: <span className="font-semibold text-brand-900">{totalAmount.toFixed(2)}</span>
              </div>
              <button className="btn-primary w-full justify-center" disabled={submitting || paystackMixedSelection} onClick={submitCheckout}>
                {submitting ? 'Submitting...' : 'Complete Gift'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

