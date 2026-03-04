import { AppError } from '../../middleware/errorHandler.js';
import { verifyPaystackTransaction } from '../paystack.js';
import type {
  AdapterGatewayConfig,
  AdapterIntent,
  AdapterInitializeResult,
  AdapterVerifyResult,
  AdapterWebhookResult,
  PaymentAdapter,
} from './types.js';

const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';

const buildCallbackUrl = (gatewayConfig: AdapterGatewayConfig) => {
  const explicit = String(gatewayConfig.successUrl || '').trim();
  if (explicit) return explicit;
  const base = String(process.env.FRONTEND_URL || process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  return base || undefined;
};

const resolveSecret = (gatewayConfig: AdapterGatewayConfig) => {
  const secret = String(gatewayConfig.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (!secret) {
    throw new AppError('Paystack gateway is missing secret key', 400);
  }
  return secret;
};

const initializePaystack = async (
  intent: AdapterIntent,
  gatewayConfig: AdapterGatewayConfig
): Promise<AdapterInitializeResult> => {
  const secret = resolveSecret(gatewayConfig);
  const callbackUrl = buildCallbackUrl(gatewayConfig);
  const metadata = intent.metadata || {};
  const email =
    String(metadata.email || metadata.guestEmail || metadata.customerEmail || '').trim() ||
    'guest@eventpeepo.com';
  const reference = `pi_${intent.id}`;

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(intent.amount * 100),
      currency: intent.currency,
      reference,
      callback_url: callbackUrl,
      metadata: {
        paymentIntentId: intent.id,
        eventId: intent.eventId,
        purpose: intent.purpose,
        ...metadata,
      },
    }),
  });

  const payload = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      reference?: string;
      authorization_url?: string;
      access_code?: string;
    };
  };

  if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
    throw new AppError(payload?.message || 'Failed to initialize Paystack transaction', 400);
  }

  return {
    gatewayReference: String(payload.data.reference || reference),
    nextAction: {
      type: 'REDIRECT',
      url: payload.data.authorization_url,
      reference: String(payload.data.reference || reference),
      payload: {
        accessCode: payload.data.access_code || null,
      },
    },
    raw: payload,
  };
};

const verifyPaystack = async (
  reference: string,
  _gatewayConfig: AdapterGatewayConfig
): Promise<AdapterVerifyResult> => {
  const verified = await verifyPaystackTransaction(reference);
  const status = String(verified.status || '').toLowerCase() === 'success' ? 'SUCCEEDED' : 'FAILED';
  const providerId = String(verified.id || verified.reference || reference);

  return {
    status,
    gatewayReference: String(verified.reference || reference),
    providerTransactionId: providerId,
    amount: Number(verified.amount || 0) / 100,
    currency: String(verified.currency || '').toUpperCase() || undefined,
    raw: verified,
  };
};

const paystackStatusFromEvent = (eventType: string) => {
  const normalized = eventType.toLowerCase();
  if (normalized === 'charge.success') return 'SUCCEEDED' as const;
  if (normalized === 'charge.failed') return 'FAILED' as const;
  return 'IGNORED' as const;
};

const handlePaystackWebhook = async (
  payload: unknown,
  _gatewayConfig: AdapterGatewayConfig
): Promise<AdapterWebhookResult> => {
  const body = payload as {
    event?: string;
    data?: {
      id?: string | number;
      reference?: string;
      amount?: number;
      currency?: string;
    };
  };

  const eventType = String(body?.event || 'unknown');
  const gatewayReference = body?.data?.reference ? String(body.data.reference) : undefined;
  const providerTransactionId = body?.data?.id
    ? String(body.data.id)
    : gatewayReference;

  return {
    eventType,
    eventKey: `${eventType}:${providerTransactionId || gatewayReference || 'unknown'}`,
    status: paystackStatusFromEvent(eventType),
    gatewayReference,
    providerTransactionId,
    amount: typeof body?.data?.amount === 'number' ? body.data.amount / 100 : undefined,
    currency: body?.data?.currency ? String(body.data.currency).toUpperCase() : undefined,
    raw: payload,
  };
};

export const paystackAdapter: PaymentAdapter = {
  gateway: 'paystack',
  initializePayment: initializePaystack,
  verifyTransaction: verifyPaystack,
  handleWebhook: handlePaystackWebhook,
};

