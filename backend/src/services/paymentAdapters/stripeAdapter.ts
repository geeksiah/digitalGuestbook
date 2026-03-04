import { AppError } from '../../middleware/errorHandler.js';
import type {
  AdapterGatewayConfig,
  AdapterIntent,
  AdapterInitializeResult,
  AdapterVerifyResult,
  AdapterWebhookResult,
  PaymentAdapter,
} from './types.js';

const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

const resolveSecret = (gatewayConfig: AdapterGatewayConfig) => {
  const secret = String(gatewayConfig.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secret) throw new AppError('Stripe gateway is missing secret key', 400);
  return secret;
};

const toFormBody = (pairs: Record<string, string | number | undefined | null>) => {
  const params = new URLSearchParams();
  Object.entries(pairs).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      params.set(key, String(value));
    }
  });
  return params;
};

const initializeStripe = async (
  intent: AdapterIntent,
  gatewayConfig: AdapterGatewayConfig
): Promise<AdapterInitializeResult> => {
  const secret = resolveSecret(gatewayConfig);
  const successUrl = String(gatewayConfig.successUrl || process.env.FRONTEND_URL || '').trim() || 'https://eventpeepo.com';
  const cancelUrl = String(gatewayConfig.cancelUrl || successUrl).trim();
  const amountMinor = Math.round(intent.amount * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new AppError('Invalid amount for Stripe initialization', 400);
  }

  const body = toFormBody({
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: intent.id,
    'line_items[0][price_data][currency]': intent.currency.toLowerCase(),
    'line_items[0][price_data][product_data][name]': `EventPeepo ${intent.purpose} payment`,
    'line_items[0][price_data][unit_amount]': amountMinor,
    'line_items[0][quantity]': 1,
    'metadata[paymentIntentId]': intent.id,
    'metadata[eventId]': intent.eventId,
    'metadata[purpose]': intent.purpose,
  });

  const response = await fetch(`${STRIPE_BASE_URL}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const payload = (await response.json()) as {
    id?: string;
    url?: string;
    payment_intent?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload?.id || !payload?.url) {
    throw new AppError(payload?.error?.message || 'Failed to initialize Stripe checkout', 400);
  }

  return {
    gatewayReference: payload.id,
    nextAction: {
      type: 'REDIRECT',
      url: payload.url,
      reference: payload.id,
      payload: {
        checkoutSessionId: payload.id,
        paymentIntentId: payload.payment_intent || null,
      },
    },
    raw: payload,
  };
};

const verifyStripe = async (
  reference: string,
  gatewayConfig: AdapterGatewayConfig
): Promise<AdapterVerifyResult> => {
  const secret = resolveSecret(gatewayConfig);

  const response = await fetch(`${STRIPE_BASE_URL}/checkout/sessions/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });

  const payload = (await response.json()) as {
    id?: string;
    payment_status?: string;
    payment_intent?: string;
    amount_total?: number;
    currency?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload?.id) {
    throw new AppError(payload?.error?.message || 'Failed to verify Stripe checkout session', 400);
  }

  const normalizedStatus = String(payload.payment_status || '').toLowerCase();
  const status =
    normalizedStatus === 'paid'
      ? 'SUCCEEDED'
      : normalizedStatus === 'unpaid'
      ? 'FAILED'
      : 'PENDING';

  return {
    status,
    gatewayReference: payload.id,
    providerTransactionId: String(payload.payment_intent || payload.id),
    amount: typeof payload.amount_total === 'number' ? payload.amount_total / 100 : undefined,
    currency: payload.currency ? payload.currency.toUpperCase() : undefined,
    raw: payload,
  };
};

const handleStripeWebhook = async (
  payload: unknown,
  _gatewayConfig: AdapterGatewayConfig
): Promise<AdapterWebhookResult> => {
  const body = payload as {
    id?: string;
    type?: string;
    data?: {
      object?: {
        id?: string;
        payment_intent?: string;
        payment_status?: string;
        amount_total?: number;
        amount_received?: number;
        currency?: string;
      };
    };
  };

  const eventType = String(body?.type || 'unknown');
  const object = body?.data?.object || {};
  const gatewayReference = object.id ? String(object.id) : undefined;
  const providerTransactionId = object.payment_intent
    ? String(object.payment_intent)
    : gatewayReference;

  const status: AdapterWebhookResult['status'] =
    eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded'
      ? 'SUCCEEDED'
      : eventType === 'checkout.session.expired' || eventType === 'payment_intent.payment_failed'
      ? 'FAILED'
      : 'IGNORED';

  const amount =
    typeof object.amount_total === 'number'
      ? object.amount_total / 100
      : typeof object.amount_received === 'number'
      ? object.amount_received / 100
      : undefined;

  return {
    eventType,
    eventKey: `${eventType}:${body?.id || providerTransactionId || gatewayReference || 'unknown'}`,
    status,
    gatewayReference,
    providerTransactionId,
    amount,
    currency: object.currency ? String(object.currency).toUpperCase() : undefined,
    raw: payload,
  };
};

export const stripeAdapter: PaymentAdapter = {
  gateway: 'stripe',
  initializePayment: initializeStripe,
  verifyTransaction: verifyStripe,
  handleWebhook: handleStripeWebhook,
};

