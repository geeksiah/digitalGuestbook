/**
 * Paystack's v2 inline overlay.
 *
 * Checkout is always initialised server-side, which returns an `access_code`.
 * On a wide screen we resume that same transaction in an overlay so the guest
 * never leaves the gift page; narrow screens keep the redirect, where a
 * full-page handoff is the better experience anyway.
 *
 * Every failure path here is recoverable: the caller still holds the redirect
 * URL, so a blocked script or an offline CDN falls back rather than dead-ends.
 */

const SCRIPT_SRC = 'https://js.paystack.co/v2/inline.js';

type PaystackTransaction = {
  reference?: string;
  status?: string;
  trans?: string;
  transaction?: string;
};

type OverlayHandlers = {
  onSuccess: (transaction: PaystackTransaction) => void;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
};

declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction: (accessCode: string, handlers?: Record<string, unknown>) => void;
    };
  }
}

let loader: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Paystack inline needs a browser'));
  }
  if (window.PaystackPop) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const fail = () => {
      // Let a later attempt retry rather than caching the failure forever.
      loader = null;
      reject(new Error('Could not load the Paystack checkout'));
    };

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', fail, { once: true });
    document.head.appendChild(script);
  });

  return loader;
}

/** True when the overlay is worth trying: a real browser on a wide viewport. */
export function canUsePaystackOverlay(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 1024px)').matches;
}

/**
 * Opens the overlay for an already-initialised transaction. Rejects if the
 * script cannot load or the global is missing, so the caller can redirect.
 */
export async function openPaystackOverlay(
  accessCode: string,
  handlers: OverlayHandlers
): Promise<void> {
  if (!accessCode) throw new Error('Missing Paystack access code');

  await loadScript();
  const PaystackPop = window.PaystackPop;
  if (!PaystackPop) throw new Error('Paystack checkout is unavailable');

  const popup = new PaystackPop();
  popup.resumeTransaction(accessCode, {
    onSuccess: (transaction: PaystackTransaction) => handlers.onSuccess(transaction || {}),
    onCancel: () => handlers.onCancel?.(),
    onError: (error: unknown) => handlers.onError?.(error),
  });
}
