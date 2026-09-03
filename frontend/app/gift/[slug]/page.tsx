'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { giftingApi } from '@/lib/api';
import { cn, formatCurrencyAmount, getErrorMessage, resolvePublicAssetUrl } from '@/lib/utils';
import { Modal } from '@/components/ui/Overlay';
import { canUsePaystackOverlay, openPaystackOverlay } from '@/lib/paystackInline';
import toast from 'react-hot-toast';

interface GiftPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  thumbnailPath: string | null;
  thumbnailUrl?: string | null;
  /** Null means unlimited. */
  remainingStock?: number | null;
  inStock?: boolean;
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
  cashGift: string;
  packagePurchase: string;
  mixedPaystackCheckoutAllowed: boolean;
}

interface GiftEvent {
  name: string;
  slug: string;
  coverImagePath?: string | null;
  coverImageAlt?: string | null;
  socialDescription?: string | null;
  giftItemsEnabled?: boolean;
  cashGiftsEnabled?: boolean;
}

/** Round starting points so most guests never have to type an amount. */
const CASH_PRESETS = [20, 50, 100, 200];

type GiftKind = 'items' | 'cash';

// ============================================================ building blocks

/**
 * Quantity control. Targets stay at 44px on touch and tighten on pointer
 * devices, so a card grid never becomes a row of unhittable buttons.
 */
function Stepper({
  value,
  onDecrease,
  onIncrease,
  label,
  max,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  label: string;
  /** Null or undefined means no ceiling. */
  max?: number | null;
}) {
  const atCeiling = typeof max === 'number' && value >= max;
  const button =
    'grid h-10 w-10 place-items-center rounded-full text-lg font-semibold leading-none text-brand-900 transition-colors hover:bg-surface-100 disabled:pointer-events-none disabled:text-surface-400 sm:h-9 sm:w-9';

  return (
    <div className="inline-flex shrink-0 items-center rounded-full border border-surface-200 bg-white">
      <button
        type="button"
        className={button}
        onClick={onDecrease}
        disabled={value <= 0}
        aria-label={`Remove one ${label}`}
      >
        &minus;
      </button>
      <span
        className="min-w-[2ch] text-center text-sm font-semibold tabular-nums text-brand-900"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={button}
        onClick={onIncrease}
        disabled={atCeiling}
        aria-label={`Add one ${label}`}
      >
        +
      </button>
    </div>
  );
}

/**
 * Horizontal on phones, where a tall grid card wastes width and squashes the
 * photo; a vertical card only from `sm:` up, where the grid has room.
 */
function PackageCard({
  pkg,
  quantity,
  onDecrease,
  onIncrease,
}: {
  pkg: GiftPackage;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const thumbnailUrl =
    resolvePublicAssetUrl(pkg.thumbnailUrl) || resolvePublicAssetUrl(pkg.thumbnailPath);
  // inStock is computed server-side; remainingStock null means unlimited.
  const soldOut = pkg.inStock === false;
  const lowStock =
    typeof pkg.remainingStock === 'number' && pkg.remainingStock > 0 && pkg.remainingStock <= 5;

  return (
    <article
      className={cn(
        'flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-white p-2.5 transition-colors',
        'sm:flex-col sm:gap-0 sm:p-0',
        soldOut
          ? 'border-surface-200 opacity-60'
          : quantity > 0
          ? 'border-brand-500'
          : 'border-surface-200'
      )}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-100 sm:h-auto sm:w-full sm:rounded-none sm:pb-[75%]">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={pkg.name}
            className="h-full w-full object-cover sm:absolute sm:inset-0"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[11px] font-medium text-surface-500 sm:absolute sm:inset-0">
            No photo
          </div>
        )}
        {soldOut ? (
          <span className="absolute inset-x-0 bottom-0 bg-surface-900/75 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white sm:text-[11px]">
            Out of stock
          </span>
        ) : quantity > 0 ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-900 px-1.5 py-0.5 text-[10px] font-semibold text-white sm:left-2 sm:top-2 sm:px-2 sm:text-[11px]">
            {quantity}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between sm:p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-5 text-brand-900 sm:whitespace-normal">
            {pkg.name}
          </h3>
          {pkg.description ? (
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-surface-600">
              {pkg.description}
            </p>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 sm:mt-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-brand-900">
              {formatCurrencyAmount(pkg.price, pkg.currency)}
            </p>
            {lowStock ? (
              <p className="text-[11px] font-medium text-amber-700">
                Only {pkg.remainingStock} left
              </p>
            ) : null}
          </div>
          {soldOut ? (
            <span className="shrink-0 text-[13px] font-medium text-surface-500">Unavailable</span>
          ) : (
            <Stepper
              value={quantity}
              onDecrease={onDecrease}
              onIncrease={onIncrease}
              label={pkg.name}
              max={pkg.remainingStock ?? null}
            />
          )}
        </div>
      </div>
    </article>
  );
}

/** Cash entry led by presets, so the keyboard is the fallback not the default. */
function CashGiftField({
  value,
  onChange,
  currency,
}: {
  value: number;
  onChange: (next: number) => void;
  currency: string;
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5 sm:p-6">
      <p className="text-[13px] font-medium text-surface-600">Cash gift</p>
      <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums text-brand-900">
        {formatCurrencyAmount(value, currency)}
      </p>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {CASH_PRESETS.map((preset) => {
          const active = value === preset;
          return (
            <button
              key={preset}
              type="button"
              className={cn(
                'min-h-[44px] rounded-xl border text-sm font-semibold transition-colors',
                active
                  ? 'border-brand-900 bg-brand-900 text-white'
                  : 'border-surface-200 bg-white text-brand-900 hover:bg-surface-50'
              )}
              onClick={() => onChange(active ? 0 : preset)}
            >
              {preset}
            </button>
          );
        })}
      </div>

      <label className="label mt-5" htmlFor="cash-gift-amount">
        Or enter an amount
      </label>
      <input
        id="cash-gift-amount"
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        className="input"
        placeholder="0.00"
        value={value || ''}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value || 0)))}
      />
      {value > 0 ? (
        <button type="button" className="btn-ghost btn-sm mt-2 w-full sm:w-auto" onClick={() => onChange(0)}>
          Clear cash gift
        </button>
      ) : null}
    </div>
  );
}

type CartLine = {
  giftPackageId: string;
  quantity: number;
  name: string;
  price: number;
  currency: string;
  lineTotal: number;
  remainingStock?: number | null;
};

function CartLines({
  lines,
  cashGiftAmount,
  currency,
  onAdjust,
  onClearCash,
}: {
  lines: CartLine[];
  cashGiftAmount: number;
  currency: string;
  onAdjust: (giftPackageId: string, delta: number) => void;
  onClearCash: () => void;
}) {
  if (!lines.length && cashGiftAmount <= 0) {
    return (
      <p className="rounded-xl border border-dashed border-surface-300 bg-surface-50 px-4 py-6 text-center text-sm text-surface-600">
        Nothing added yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-surface-200">
      {lines.map((line) => (
        <li key={line.giftPackageId} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-brand-900">{line.name}</p>
            <p className="meta mt-0.5">{formatCurrencyAmount(line.price, line.currency)} each</p>
          </div>
          <Stepper
            value={line.quantity}
            onDecrease={() => onAdjust(line.giftPackageId, -1)}
            onIncrease={() => onAdjust(line.giftPackageId, 1)}
            label={line.name}
            max={line.remainingStock ?? null}
          />
          <p className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-brand-900">
            {formatCurrencyAmount(line.lineTotal, line.currency)}
          </p>
        </li>
      ))}

      {cashGiftAmount > 0 ? (
        <li className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-brand-900">Cash gift</p>
            <button
              type="button"
              className="meta mt-0.5 underline underline-offset-2 hover:text-brand-900"
              onClick={onClearCash}
            >
              Remove
            </button>
          </div>
          <p className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-brand-900">
            {formatCurrencyAmount(cashGiftAmount, currency)}
          </p>
        </li>
      ) : null}
    </ul>
  );
}

function Totals({
  packageTotal,
  cashGiftAmount,
  totalAmount,
  currency,
}: {
  packageTotal: number;
  cashGiftAmount: number;
  totalAmount: number;
  currency: string;
}) {
  return (
    <dl className="space-y-1.5 text-sm">
      {packageTotal > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <dt className="text-surface-600">Gift items</dt>
          <dd className="font-medium tabular-nums text-brand-900">
            {formatCurrencyAmount(packageTotal, currency)}
          </dd>
        </div>
      ) : null}
      {cashGiftAmount > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <dt className="text-surface-600">Cash gift</dt>
          <dd className="font-medium tabular-nums text-brand-900">
            {formatCurrencyAmount(cashGiftAmount, currency)}
          </dd>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 border-t border-surface-200 pt-2">
        <dt className="font-semibold text-brand-900">Total</dt>
        <dd className="text-base font-bold tabular-nums text-brand-900">
          {formatCurrencyAmount(totalAmount, currency)}
        </dd>
      </div>
    </dl>
  );
}

/** Two-stop progress. The third stop lives on the status page after payment. */
function ProgressSteps({ current }: { current: 1 | 2 }) {
  const steps = [
    { number: 1 as const, label: 'Choose gift' },
    { number: 2 as const, label: 'Checkout' },
    { number: 3 as const, label: 'Done' },
  ];

  return (
    <ol className="flex items-center gap-2" aria-label="Checkout progress">
      {steps.map((step, index) => {
        const done = step.number < current;
        const active = step.number === current;
        return (
          <li key={step.number} className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                done
                  ? 'bg-brand-600 text-white'
                  : active
                  ? 'bg-brand-900 text-white'
                  : 'bg-surface-200 text-surface-600'
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? '✓' : step.number}
            </span>
            <span
              className={cn(
                'truncate text-[13px] font-medium',
                active ? 'text-brand-900' : 'text-surface-500'
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span
                className={cn('h-px w-4 shrink-0 sm:w-8', done ? 'bg-brand-500' : 'bg-surface-300')}
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ============================================================ page

export default function GiftPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<GiftEvent | null>(null);
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

  const [giftKind, setGiftKind] = useState<GiftKind>('items');
  // The flow has one position, shared by both breakpoints: browsing the
  // gift, or filling in checkout. Desktop renders it in the page, mobile
  // renders it in the one sheet.
  const [step, setStep] = useState<'choose' | 'checkout'>('choose');
  const [sheetOpen, setSheetOpen] = useState(false);

  const itemsEnabled = event?.giftItemsEnabled !== false;
  const cashEnabled = event?.cashGiftsEnabled !== false;
  const bothKinds = itemsEnabled && cashEnabled;

  const adjustQuantity = useCallback(
    (giftPackageId: string, delta: number) => {
      setQuantities((prev) => {
        const pkg = packages.find((candidate) => candidate.id === giftPackageId);
        const ceiling =
          typeof pkg?.remainingStock === 'number' ? pkg.remainingStock : Number.POSITIVE_INFINITY;
        const next = Math.min(ceiling, Math.max(0, (prev[giftPackageId] || 0) + delta));
        return { ...prev, [giftPackageId]: next };
      });
    },
    [packages]
  );

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await giftingApi.getPublicOptions(slug);
      const gateways = response.data.paymentGateways || [];
      const loadedEvent = response.data.event as GiftEvent;
      setEvent(loadedEvent);
      setPackages(response.data.packages || []);
      setPaymentGateways(gateways);
      setSettlementPolicy(response.data.settlementPolicy || null);
      // Open on whichever kind this event actually accepts.
      setGiftKind(loadedEvent?.giftItemsEnabled === false ? 'cash' : 'items');
      if (gateways.length > 0) {
        setSelectedGatewayId((current) => current || gateways[0].id);
      }
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Unable to load gifting options'));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Desktop runs the flow inline, so a sheet opened on a phone must not
  // survive a resize and leave a backdrop sitting over the page.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      if (query.matches) setSheetOpen(false);
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const selectedPackageItems = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([giftPackageId, quantity]) => ({ giftPackageId, quantity })),
    [quantities]
  );

  const cartLines = useMemo<CartLine[]>(
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
            remainingStock: pkg.remainingStock ?? null,
          };
        })
        .filter(Boolean) as CartLine[],
    [packages, selectedPackageItems]
  );

  const packageTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.lineTotal, 0),
    [cartLines]
  );
  const totalAmount = packageTotal + cashGiftAmount;
  const selectedQuantityTotal = useMemo(
    () => selectedPackageItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedPackageItems]
  );
  const cartCount = selectedQuantityTotal + (cashGiftAmount > 0 ? 1 : 0);

  const selectedGateway = useMemo(() => {
    if (!paymentGateways.length) return null;
    return paymentGateways.find((gateway) => gateway.id === selectedGatewayId) || paymentGateways[0];
  }, [paymentGateways, selectedGatewayId]);
  const paymentMethod = selectedGateway?.gateway || null;

  const selectedPackageCurrencies = useMemo(() => {
    const currencies = new Set<string>();
    cartLines.forEach((line) => {
      if (line.currency) currencies.add(line.currency.toUpperCase());
    });
    return Array.from(currencies);
  }, [cartLines]);

  const displayCurrency =
    selectedPackageCurrencies[0] || selectedGateway?.currency || packages[0]?.currency || 'USD';

  const hasPackageSelection = selectedPackageItems.length > 0;
  const hasCashSelection = cashGiftAmount > 0;
  // The backend settles a mixed cart correctly, but it still owns the rule: if
  // it ever says a gateway cannot mix, the page respects that.
  const mixedNotAllowed =
    selectedGateway?.gateway === 'paystack' &&
    settlementPolicy?.mixedPaystackCheckoutAllowed === false &&
    hasPackageSelection &&
    hasCashSelection;

  const hasGatewayCurrencyMismatch =
    Boolean(selectedGateway?.currency) &&
    selectedPackageCurrencies.length > 0 &&
    selectedPackageCurrencies.some(
      (currency) => currency !== String(selectedGateway?.currency || '').toUpperCase()
    );

  const blockingMessage = mixedNotAllowed
    ? 'On this gateway, send the cash gift and the gift items as two separate payments.'
    : hasGatewayCurrencyMismatch
    ? 'The selected payment method does not match the currency of the gift items.'
    : !paymentGateways.length
    ? 'This event has not enabled a payment method yet.'
    : null;

  const canSubmitGift =
    Boolean(guestName.trim()) &&
    totalAmount > 0 &&
    Boolean(selectedGateway?.id) &&
    !mixedNotAllowed &&
    !hasGatewayCurrencyMismatch;

  const statusUrl = (reference?: string) => {
    const base = `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}/status`;
    return reference ? `${base}?reference=${encodeURIComponent(reference)}` : base;
  };

  const submitCheckout = async () => {
    if (!guestName.trim()) {
      toast.error('Your name is required');
      return;
    }
    if (totalAmount <= 0) {
      toast.error('Add a gift item or a cash amount first');
      return;
    }
    if (blockingMessage) {
      toast.error(blockingMessage);
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
        // Tells the gateway where to return the guest, on whatever host they
        // started from. The backend accepts it only for this event's domains.
        returnUrl: statusUrl(),
      });

      const nextAction = response.data?.nextAction;
      const accessCode = nextAction?.payload?.accessCode as string | undefined;
      const redirectUrl = nextAction?.url ? String(nextAction.url) : null;

      // Wide screens stay on the page via the overlay; anything else, or any
      // failure to open it, falls back to the redirect we already hold.
      if (paymentMethod === 'paystack' && accessCode && canUsePaystackOverlay()) {
        try {
          await openPaystackOverlay(accessCode, {
            onSuccess: (transaction) => {
              window.location.href = statusUrl(transaction?.reference || nextAction?.reference);
            },
            onCancel: () => {
              setSubmitting(false);
              toast('Payment cancelled. Your gift is still here when you are ready.');
            },
            onError: () => {
              setSubmitting(false);
              toast.error('That payment could not be completed. Please try again.');
            },
          });
          return;
        } catch {
          if (redirectUrl) {
            window.location.href = redirectUrl;
            return;
          }
        }
      }

      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      toast.success('Checkout started. Complete payment to send your gift.');
      setSubmitting(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to submit gift'));
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------- states

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-200" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex gap-3 rounded-2xl border border-surface-200 bg-white p-2.5 sm:block sm:p-0"
              >
                <div className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-surface-200 sm:h-32 sm:w-full sm:rounded-none" />
                <div className="flex-1 space-y-2 sm:p-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-surface-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-surface-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-surface-200 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-brand-900">Gifting unavailable</h1>
          <p className="mt-2 text-sm text-surface-600">{loadError}</p>
          <button type="button" className="btn-primary mt-5 w-full justify-center" onClick={loadOptions}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const coverUrl = resolvePublicAssetUrl(event?.coverImagePath);
  const showItems = itemsEnabled && (!bothKinds || giftKind === 'items');
  const showCash = cashEnabled && (!bothKinds || giftKind === 'cash');

  const catalogue =
    packages.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-surface-300 bg-white px-4 py-10 text-center">
        <p className="text-sm font-medium text-brand-900">No gift items yet</p>
        {cashEnabled ? (
          <p className="mt-1 text-[13px] text-surface-600">You can still send a cash gift to the host.</p>
        ) : null}
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            quantity={quantities[pkg.id] || 0}
            onDecrease={() => adjustQuantity(pkg.id, -1)}
            onIncrease={() => adjustQuantity(pkg.id, 1)}
          />
        ))}
      </div>
    );

  const kindTabs = bothKinds ? (
    <div className="flex gap-1 rounded-xl bg-surface-100 p-1">
      {(['items', 'cash'] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          className={cn(
            'min-h-[40px] flex-1 rounded-lg text-sm font-semibold transition-colors',
            giftKind === kind ? 'bg-white text-brand-900 shadow-sm' : 'text-surface-600'
          )}
          onClick={() => setGiftKind(kind)}
          aria-pressed={giftKind === kind}
        >
          {kind === 'items' ? 'Gift items' : 'Cash gift'}
        </button>
      ))}
    </div>
  ) : null;

  const checkoutFields = (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="guest-name">
          Your name
        </label>
        <input
          id="guest-name"
          className="input"
          placeholder="Ama Serwaa"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="guest-email">
            Email <span className="font-normal text-surface-500">(optional)</span>
          </label>
          <input
            id="guest-email"
            type="email"
            className="input"
            placeholder="you@email.com"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="guest-phone">
            Phone <span className="font-normal text-surface-500">(optional)</span>
          </label>
          <input
            id="guest-phone"
            type="tel"
            className="input"
            placeholder="+233..."
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="gift-gateway">
          Pay with
        </label>
        <select
          id="gift-gateway"
          className="input"
          value={selectedGateway?.id || ''}
          onChange={(e) => setSelectedGatewayId(e.target.value)}
          disabled={paymentGateways.length === 0}
        >
          {paymentGateways.length > 0 ? (
            paymentGateways.map((gateway) => (
              <option key={gateway.id} value={gateway.id}>
                {gateway.name} ({gateway.currency})
              </option>
            ))
          ) : (
            <option value="">No payment method available</option>
          )}
        </select>
      </div>
      {itemsEnabled && hasPackageSelection ? (
        <div>
          <label className="label" htmlFor="delivery-date">
            Deliver on <span className="font-normal text-surface-500">(optional)</span>
          </label>
          <input
            id="delivery-date"
            type="date"
            className="input"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </div>
      ) : null}
      <div>
        <label className="label" htmlFor="gift-note">
          Message to the host <span className="font-normal text-surface-500">(optional)</span>
        </label>
        <textarea
          id="gift-note"
          className="input min-h-[88px]"
          placeholder="Congratulations!"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {blockingMessage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          {blockingMessage}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Mobile app bar */}
      <header className="sticky top-0 z-30 border-b border-surface-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex min-h-[56px] items-center gap-3 px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-5 text-brand-900">
              {event?.name || 'Send a gift'}
            </p>
            <p className="meta">Send a gift</p>
          </div>
          <button
            type="button"
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-surface-200 bg-white"
            onClick={() => {
              setStep('choose');
              setSheetOpen(true);
            }}
            aria-label={`Open gift summary, ${cartCount} item(s)`}
          >
            <CartIcon />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-900 px-1 text-[11px] font-semibold text-white">
                {cartCount}
              </span>
            ) : null}
          </button>
        </div>
        {bothKinds ? <div className="px-4 pb-3">{kindTabs}</div> : null}
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 lg:pb-12 lg:pt-8">
        {/* Desktop header + progress */}
        <div className="hidden lg:mb-6 lg:block">
          <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt={event?.coverImageAlt || ''} className="h-40 w-full object-cover" />
            ) : null}
            <div className="flex items-end justify-between gap-6 px-6 py-5">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-brand-950">{event?.name}</h1>
                <p className="mt-1 text-sm text-surface-600">
                  {bothKinds
                    ? 'Choose gift items or send a cash gift.'
                    : itemsEnabled
                    ? 'Choose a gift for the host.'
                    : 'Send a cash gift to the host.'}
                </p>
              </div>
              <ProgressSteps current={step === 'checkout' ? 2 : 1} />
            </div>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-7 xl:col-span-8">
            {/* Desktop puts checkout in place of the browse column, so the
                flow moves forward on one surface instead of stacking a
                dialog over the page. */}
            {step === 'checkout' ? (
              <section className="hidden rounded-2xl border border-surface-200 bg-white p-5 lg:block">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-brand-900">Checkout</h2>
                    <p className="mt-0.5 text-sm text-surface-600">
                      Sending {formatCurrencyAmount(totalAmount, displayCurrency)} to{' '}
                      {event?.name || 'the host'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost btn-sm shrink-0"
                    disabled={submitting}
                    onClick={() => setStep('choose')}
                  >
                    &larr; Back to gifts
                  </button>
                </div>
                <div className="mt-5">{checkoutFields}</div>
              </section>
            ) : null}

            {/* Browsing stays mounted on mobile, where the sheet covers it,
                and hides on desktop once checkout takes the column. */}
            <div className={cn(step === 'checkout' && 'lg:hidden')}>
              {bothKinds ? <div className="mb-4 hidden lg:block">{kindTabs}</div> : null}
              {showItems ? catalogue : null}
              {showCash ? (
                <CashGiftField
                  value={cashGiftAmount}
                  onChange={setCashGiftAmount}
                  currency={displayCurrency}
                />
              ) : null}
            </div>
          </div>

          {/* Desktop rail: the gift, with checkout one click away. */}
          <aside className="hidden lg:col-span-5 lg:block xl:col-span-4">
            <div className="sticky top-6 rounded-2xl border border-surface-200 bg-white p-4">
              <h2 className="text-base font-semibold text-brand-900">Your gift</h2>
              <div className="mt-2">
                <CartLines
                  lines={cartLines}
                  cashGiftAmount={cashGiftAmount}
                  currency={displayCurrency}
                  onAdjust={adjustQuantity}
                  onClearCash={() => setCashGiftAmount(0)}
                />
              </div>
              {totalAmount > 0 ? (
                <div className="mt-3 border-t border-surface-200 pt-3">
                  <Totals
                    packageTotal={packageTotal}
                    cashGiftAmount={cashGiftAmount}
                    totalAmount={totalAmount}
                    currency={displayCurrency}
                  />
                </div>
              ) : null}
              {step === 'checkout' ? (
                <button
                  type="button"
                  className="btn-primary mt-4 w-full justify-center"
                  disabled={submitting || !canSubmitGift}
                  onClick={submitCheckout}
                >
                  {submitting ? 'Starting...' : `Pay ${formatCurrencyAmount(totalAmount, displayCurrency)}`}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary mt-4 w-full justify-center"
                  disabled={totalAmount <= 0}
                  onClick={() => setStep('checkout')}
                >
                  Continue to checkout
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile action bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="meta">Total</p>
            <p className="text-base font-bold leading-5 tabular-nums text-brand-900">
              {formatCurrencyAmount(totalAmount, displayCurrency)}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary min-w-[9.5rem] justify-center"
            disabled={totalAmount <= 0}
            onClick={() => {
              setStep('choose');
              setSheetOpen(true);
            }}
          >
            Review gift
          </button>
        </div>
      </div>

      {/*
        One sheet, two steps. Checkout swaps this body rather than opening a
        second overlay on top of the first.
      */}
      <Modal
        open={sheetOpen}
        onClose={() => (submitting ? undefined : setSheetOpen(false))}
        title={step === 'checkout' ? 'Checkout' : 'Your gift'}
        description={
          step === 'checkout'
            ? `Sending ${formatCurrencyAmount(totalAmount, displayCurrency)} to ${
                event?.name || 'the host'
              }`
            : undefined
        }
        size="md"
        footer={
          step === 'checkout' ? (
            <>
              <button
                type="button"
                className="btn-outline justify-center"
                disabled={submitting}
                onClick={() => setStep('choose')}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary justify-center"
                disabled={submitting || !canSubmitGift}
                onClick={submitCheckout}
              >
                {submitting ? 'Starting...' : 'Pay now'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary justify-center"
              disabled={totalAmount <= 0}
              onClick={() => setStep('checkout')}
            >
              Continue
            </button>
          )
        }
      >
        <div className="mb-4">
          <ProgressSteps current={step === 'checkout' ? 2 : 1} />
        </div>

        {step === 'checkout' ? (
          checkoutFields
        ) : (
          <div className="space-y-4">
            <CartLines
              lines={cartLines}
              cashGiftAmount={cashGiftAmount}
              currency={displayCurrency}
              onAdjust={adjustQuantity}
              onClearCash={() => setCashGiftAmount(0)}
            />
            {totalAmount > 0 ? (
              <div className="border-t border-surface-200 pt-3">
                <Totals
                  packageTotal={packageTotal}
                  cashGiftAmount={cashGiftAmount}
                  totalAmount={totalAmount}
                  currency={displayCurrency}
                />
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}

function CartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-brand-900"
      aria-hidden="true"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
