import { createHash } from 'crypto';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  AdapterGatewayConfig,
  AdapterIntent,
  AdapterInitializeResult,
  AdapterVerifyResult,
  AdapterWebhookResult,
  PaymentAdapter,
} from './types.js';

type HubtelConfig = {
  initializeUrl?: string;
  verifyUrl?: string;
  verifyMethod?: 'GET' | 'POST';
  verifyReferenceParam?: string;
  referencePath?: string;
  providerTransactionIdPath?: string;
  redirectUrlPath?: string;
  statusPath?: string;
  amountPath?: string;
  currencyPath?: string;
  eventTypePath?: string;
  eventIdPath?: string;
  webhookReferencePath?: string;
  webhookProviderTransactionIdPath?: string;
  signatureHeader?: string;
  statusSuccessValues?: string[];
  statusPendingValues?: string[];
  initializePayloadDefaults?: Record<string, unknown>;
};

const DEFAULT_CONFIG: Required<
  Pick<
    HubtelConfig,
    | 'verifyMethod'
    | 'verifyReferenceParam'
    | 'referencePath'
    | 'providerTransactionIdPath'
    | 'redirectUrlPath'
    | 'statusPath'
    | 'amountPath'
    | 'currencyPath'
    | 'eventTypePath'
    | 'eventIdPath'
    | 'webhookReferencePath'
    | 'webhookProviderTransactionIdPath'
    | 'signatureHeader'
    | 'statusSuccessValues'
    | 'statusPendingValues'
  >
> = {
  verifyMethod: 'GET',
  verifyReferenceParam: 'reference',
  referencePath: 'data.reference',
  providerTransactionIdPath: 'data.transactionId',
  redirectUrlPath: 'data.checkoutUrl',
  statusPath: 'data.status',
  amountPath: 'data.amount',
  currencyPath: 'data.currency',
  eventTypePath: 'event',
  eventIdPath: 'id',
  webhookReferencePath: 'data.reference',
  webhookProviderTransactionIdPath: 'data.transactionId',
  signatureHeader: 'x-hubtel-signature',
  statusSuccessValues: ['SUCCESS', 'PAID', 'COMPLETED'],
  statusPendingValues: ['PENDING', 'PROCESSING', 'INITIATED'],
};

const parseConfig = (gatewayConfig: AdapterGatewayConfig): HubtelConfig => {
  try {
    const parsed = gatewayConfig.hubtelConfigJson
      ? (JSON.parse(gatewayConfig.hubtelConfigJson) as HubtelConfig)
      : {};
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
};

const deepGet = (obj: unknown, path: string): unknown => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
};

const normalizeStatus = (
  raw: unknown,
  config: HubtelConfig
): AdapterVerifyResult['status'] => {
  const value = String(raw || '').toUpperCase();
  const success = new Set((config.statusSuccessValues || DEFAULT_CONFIG.statusSuccessValues).map((item) => item.toUpperCase()));
  const pending = new Set((config.statusPendingValues || DEFAULT_CONFIG.statusPendingValues).map((item) => item.toUpperCase()));
  if (success.has(value)) return 'SUCCEEDED';
  if (pending.has(value)) return 'PENDING';
  return 'FAILED';
};

const baseAuthHeader = (gatewayConfig: AdapterGatewayConfig) => {
  const clientId = String(gatewayConfig.hubtelClientId || '').trim();
  const clientSecret = String(gatewayConfig.hubtelClientSecret || '').trim();
  if (!clientId || !clientSecret) {
    throw new AppError('Hubtel gateway is missing client credentials', 400);
  }
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
};

const initializeHubtel = async (
  intent: AdapterIntent,
  gatewayConfig: AdapterGatewayConfig
): Promise<AdapterInitializeResult> => {
  const config = parseConfig(gatewayConfig);
  if (!config.initializeUrl) {
    throw new AppError('Hubtel initialize URL is not configured', 400);
  }

  const reference = `pi_${intent.id}`;
  const body = {
    amount: intent.amount,
    currency: intent.currency,
    purpose: intent.purpose,
    paymentIntentId: intent.id,
    eventId: intent.eventId,
    reference,
    ...(config.initializePayloadDefaults || {}),
  };

  const response = await fetch(config.initializeUrl, {
    method: 'POST',
    headers: {
      Authorization: baseAuthHeader(gatewayConfig),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new AppError(String(deepGet(payload, 'message') || 'Hubtel initialization failed'), 400);
  }

  const gatewayReference =
    String(deepGet(payload, config.referencePath || DEFAULT_CONFIG.referencePath) || reference);
  const redirectUrl = String(deepGet(payload, config.redirectUrlPath || DEFAULT_CONFIG.redirectUrlPath) || '').trim();

  return {
    gatewayReference,
    nextAction: {
      type: redirectUrl ? 'REDIRECT' : 'NONE',
      url: redirectUrl || undefined,
      reference: gatewayReference,
      payload: payload,
    },
    raw: payload,
  };
};

const verifyHubtel = async (
  reference: string,
  gatewayConfig: AdapterGatewayConfig
): Promise<AdapterVerifyResult> => {
  const config = parseConfig(gatewayConfig);
  if (!config.verifyUrl) {
    throw new AppError('Hubtel verify URL is not configured', 400);
  }

  const method = (config.verifyMethod || DEFAULT_CONFIG.verifyMethod).toUpperCase();
  const verifyReferenceParam = config.verifyReferenceParam || DEFAULT_CONFIG.verifyReferenceParam;
  const url =
    method === 'GET'
      ? `${config.verifyUrl}${config.verifyUrl.includes('?') ? '&' : '?'}${encodeURIComponent(verifyReferenceParam)}=${encodeURIComponent(reference)}`
      : config.verifyUrl;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: baseAuthHeader(gatewayConfig),
      'Content-Type': 'application/json',
    },
    body: method === 'POST' ? JSON.stringify({ [verifyReferenceParam]: reference }) : undefined,
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new AppError(String(deepGet(payload, 'message') || 'Hubtel verification failed'), 400);
  }

  const status = normalizeStatus(deepGet(payload, config.statusPath || DEFAULT_CONFIG.statusPath), config);
  const gatewayReference = String(
    deepGet(payload, config.referencePath || DEFAULT_CONFIG.referencePath) || reference
  );
  const providerTransactionId = String(
    deepGet(payload, config.providerTransactionIdPath || DEFAULT_CONFIG.providerTransactionIdPath) || gatewayReference
  );

  return {
    status,
    gatewayReference,
    providerTransactionId,
    amount: Number(deepGet(payload, config.amountPath || DEFAULT_CONFIG.amountPath) || 0) || undefined,
    currency: String(deepGet(payload, config.currencyPath || DEFAULT_CONFIG.currencyPath) || '').toUpperCase() || undefined,
    raw: payload,
  };
};

const handleHubtelWebhook = async (
  payload: unknown,
  gatewayConfig: AdapterGatewayConfig
): Promise<AdapterWebhookResult> => {
  const config = parseConfig(gatewayConfig);
  const eventType = String(deepGet(payload, config.eventTypePath || DEFAULT_CONFIG.eventTypePath) || 'hubtel.event');
  const eventId = String(deepGet(payload, config.eventIdPath || DEFAULT_CONFIG.eventIdPath) || '');
  const gatewayReference = String(
    deepGet(payload, config.webhookReferencePath || DEFAULT_CONFIG.webhookReferencePath) || ''
  );
  const providerTransactionId = String(
    deepGet(payload, config.webhookProviderTransactionIdPath || DEFAULT_CONFIG.webhookProviderTransactionIdPath) ||
      gatewayReference
  );
  const status = normalizeStatus(deepGet(payload, config.statusPath || DEFAULT_CONFIG.statusPath), config);

  const rawKey = JSON.stringify(payload || {});
  const fallbackEventId = createHash('sha256').update(rawKey).digest('hex');

  return {
    eventType,
    eventKey: `${eventType}:${eventId || providerTransactionId || gatewayReference || fallbackEventId}`,
    status: status === 'PENDING' ? 'PENDING' : status,
    gatewayReference: gatewayReference || undefined,
    providerTransactionId: providerTransactionId || undefined,
    amount: Number(deepGet(payload, config.amountPath || DEFAULT_CONFIG.amountPath) || 0) || undefined,
    currency: String(deepGet(payload, config.currencyPath || DEFAULT_CONFIG.currencyPath) || '').toUpperCase() || undefined,
    raw: payload,
  };
};

export const hubtelAdapter: PaymentAdapter = {
  gateway: 'hubtel',
  initializePayment: initializeHubtel,
  verifyTransaction: verifyHubtel,
  handleWebhook: handleHubtelWebhook,
};

