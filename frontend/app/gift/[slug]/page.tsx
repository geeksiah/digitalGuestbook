'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { giftingApi } from '@/lib/api';
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

export default function GiftPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { loading: templateLoading, available: hasTemplate } = useBackendTemplate(slug, 'gifting');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [eventName, setEventName] = useState('');
  const [packages, setPackages] = useState<GiftPackage[]>([]);
  const [cashGiftAmount, setCashGiftAmount] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [paymentReference, setPaymentReference] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!slug || templateLoading || hasTemplate) return;

    const run = async () => {
      try {
        const response = await giftingApi.getPublicOptions(slug);
        setEventName(response.data.event.name);
        setPackages(response.data.packages || []);
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

  const submitCheckout = async () => {
    if (!guestName.trim()) {
      toast.error('Your name is required');
      return;
    }
    if (totalAmount <= 0) {
      toast.error('Please select cash gift or package(s)');
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
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-brand-900">{pkg.name}</p>
                      {pkg.description && <p className="text-xs text-surface-600 mt-1">{pkg.description}</p>}
                      <p className="text-sm text-surface-700 mt-1">{pkg.currency} {pkg.price.toFixed(2)}</p>
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
                <option value="mtn_momo">MTN MoMo</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
              <input className="input" placeholder="Payment reference (optional)" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
              <textarea className="input min-h-[88px]" placeholder="Notes (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="rounded-lg bg-surface-50 border border-surface-200 px-3 py-2 text-sm text-surface-700">
                Total: <span className="font-semibold text-brand-900">{totalAmount.toFixed(2)}</span>
              </div>
              <button className="btn-primary w-full justify-center" disabled={submitting} onClick={submitCheckout}>
                {submitting ? 'Submitting...' : 'Complete Gift'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

