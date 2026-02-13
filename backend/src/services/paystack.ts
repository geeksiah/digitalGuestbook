import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { createHmac } from 'crypto';

const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';

type PaystackEnvelope<T> = {
  status: boolean;
  message: string;
  data: T;
};

type PaystackBank = {
  id?: number;
  code: string;
  name: string;
  currency?: string;
  country?: string;
  active?: boolean;
};

type PaystackResolvedAccount = {
  account_number: string;
  account_name: string;
  bank_name?: string;
  bank_id?: number;
};

type PaystackSubaccount = {
  id?: number;
  subaccount_code: string;
  business_name: string;
  account_number?: string;
  settlement_bank?: string;
  active?: boolean;
};

type PaystackTransferRecipient = {
  id?: number;
  type?: string;
  name?: string;
  recipient_code: string;
  currency?: string;
  active?: boolean;
  details?: Record<string, unknown>;
};

type PaystackTransfer = {
  id?: number;
  transfer_code: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string;
  recipient?: {
    recipient_code?: string;
  } | string | null;
  transferred_at?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type PaystackVerifiedTransaction = {
  id: number;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  paid_at?: string;
  customer?: {
    email?: string;
  };
  metadata?: Record<string, unknown> | null;
  subaccount?: {
    subaccount_code?: string;
  } | string | null;
  split?: {
    subaccount?: string;
  } | null;
};

const getConfiguredPaystackSecret = async (): Promise<string> => {
  const envSecret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (envSecret) return envSecret;

  const gateway = await prisma.paymentGateway.findFirst({
    where: {
      gateway: 'paystack',
      isActive: true,
      paystackSecretKey: { not: null },
    },
    orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
    select: { paystackSecretKey: true },
  });

  const gatewaySecret = gateway?.paystackSecretKey?.trim();
  if (gatewaySecret) return gatewaySecret;

  throw new AppError('Paystack is not configured yet. Ask admin to set Paystack keys first.', 400);
};

const getConfiguredPaystackWebhookSecret = async (): Promise<string> => {
  const configured = (process.env.PAYSTACK_WEBHOOK_SECRET || '').trim();
  if (configured) return configured;
  return getConfiguredPaystackSecret();
};

const paystackRequest = async <T>(
  path: string,
  options: RequestInit = {},
  secretKey?: string
): Promise<T> => {
  const resolvedSecret = secretKey || (await getConfiguredPaystackSecret());

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${resolvedSecret}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = (await response.json()) as PaystackEnvelope<T> & { data?: T };

  if (!response.ok || !payload?.status) {
    const message = payload?.message || `Paystack request failed (${response.status})`;
    throw new AppError(message, 400);
  }

  return payload.data as T;
};

export const getPaystackBanks = async (params?: { country?: string; currency?: string }) => {
  const query = new URLSearchParams();
  if (params?.country) query.set('country', params.country);
  if (params?.currency) query.set('currency', params.currency);
  query.set('enabled_for_verification', 'true');
  query.set('perPage', '200');

  const banks = await paystackRequest<PaystackBank[]>(`/bank?${query.toString()}`);
  return banks
    .filter((bank) => bank.active !== false)
    .map((bank) => ({
      code: bank.code,
      name: bank.name,
      currency: bank.currency,
      country: bank.country,
    }));
};

export const resolvePaystackAccount = async (accountNumber: string, bankCode: string) => {
  const query = new URLSearchParams({
    account_number: accountNumber,
    bank_code: bankCode,
  });

  return paystackRequest<PaystackResolvedAccount>(`/bank/resolve?${query.toString()}`);
};

export const createPaystackSubaccount = async (payload: {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  percentageCharge?: number;
  primaryContactName?: string;
  primaryContactEmail?: string;
  description?: string;
}) => {
  return paystackRequest<PaystackSubaccount>('/subaccount', {
    method: 'POST',
    body: JSON.stringify({
      business_name: payload.businessName,
      settlement_bank: payload.bankCode,
      account_number: payload.accountNumber,
      percentage_charge: payload.percentageCharge ?? 0,
      primary_contact_name: payload.primaryContactName,
      primary_contact_email: payload.primaryContactEmail,
      description: payload.description,
    }),
  });
};

export const updatePaystackSubaccount = async (
  subaccountCode: string,
  payload: {
    businessName: string;
    bankCode: string;
    accountNumber: string;
    percentageCharge?: number;
    primaryContactName?: string;
    primaryContactEmail?: string;
    description?: string;
  }
) => {
  return paystackRequest<PaystackSubaccount>(`/subaccount/${encodeURIComponent(subaccountCode)}`, {
    method: 'PUT',
    body: JSON.stringify({
      business_name: payload.businessName,
      settlement_bank: payload.bankCode,
      account_number: payload.accountNumber,
      percentage_charge: payload.percentageCharge ?? 0,
      primary_contact_name: payload.primaryContactName,
      primary_contact_email: payload.primaryContactEmail,
      description: payload.description,
    }),
  });
};

export const verifyPaystackTransaction = async (reference: string) => {
  const data = await paystackRequest<PaystackVerifiedTransaction>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
  return data;
};

export const createPaystackTransferRecipient = async (payload: {
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
  type?: 'nuban' | 'mobile_money';
  description?: string;
}) => {
  return paystackRequest<PaystackTransferRecipient>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: payload.type || 'nuban',
      name: payload.name,
      account_number: payload.accountNumber,
      bank_code: payload.bankCode,
      currency: payload.currency,
      description: payload.description,
    }),
  });
};

export const initiatePaystackTransfer = async (payload: {
  amount: number;
  recipientCode: string;
  reason?: string;
  reference: string;
  source?: 'balance';
  currency?: string;
}) => {
  const amountMinor = Math.round(payload.amount * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new AppError('Transfer amount must be greater than zero', 400);
  }

  return paystackRequest<PaystackTransfer>('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: payload.source || 'balance',
      amount: amountMinor,
      recipient: payload.recipientCode,
      reason: payload.reason,
      reference: payload.reference,
      currency: payload.currency,
    }),
  });
};

export const fetchPaystackTransfer = async (codeOrId: string) => {
  return paystackRequest<PaystackTransfer>(`/transfer/${encodeURIComponent(codeOrId)}`);
};

export const verifyPaystackWebhookSignature = async (
  rawBody: Buffer | string,
  signature: string | undefined | null
) => {
  const provided = (signature || '').trim();
  if (!provided) return false;

  const secret = await getConfiguredPaystackWebhookSecret();
  const digest = createHmac('sha512', secret)
    .update(typeof rawBody === 'string' ? rawBody : rawBody)
    .digest('hex');

  return digest === provided;
};
