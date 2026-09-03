import { AppError } from '../middleware/errorHandler.js';
import { getPaystackBanks, resolvePaystackAccount } from './paystack.js';

/**
 * Confirming an owner's payout destination before it is saved is gateway
 * specific: Paystack resolves an account number against a bank code, Stripe
 * hands the owner an onboarding session instead. This registry keeps the shape
 * of that question the same for callers, so the wallet form does not need a
 * branch per provider and a new gateway is one entry here.
 */

export type PayoutBank = {
  code: string;
  name: string;
  currency?: string;
  country?: string;
};

export type ResolvedPayoutAccount = {
  accountName: string;
  accountNumber: string;
  bankName?: string | null;
};

export type PayoutAccountProvider = {
  gateway: string;
  /**
   * True when the provider can name the account holder before anything is
   * saved. Providers without it need a hosted onboarding flow instead, and the
   * form should say so rather than pretending a check happened.
   */
  supportsAccountLookup: boolean;
  /** Human explanation used when lookup is not available. */
  unsupportedReason?: string;
  listBanks(params: { country?: string; currency?: string }): Promise<PayoutBank[]>;
  resolveAccount(params: {
    accountNumber: string;
    bankCode: string;
    currency?: string;
  }): Promise<ResolvedPayoutAccount>;
};

const paystackProvider: PayoutAccountProvider = {
  gateway: 'paystack',
  supportsAccountLookup: true,
  // Ghana has always been the default market for this form.
  listBanks: ({ country, currency }) => getPaystackBanks({ country: country || 'ghana', currency }),
  resolveAccount: async ({ accountNumber, bankCode }) => {
    const resolved = await resolvePaystackAccount(accountNumber, bankCode);
    return {
      accountName: resolved.account_name,
      accountNumber: resolved.account_number || accountNumber,
      bankName: resolved.bank_name || null,
    };
  },
};

/**
 * Stripe verifies payout accounts through Connect onboarding rather than a
 * lookup call, so it advertises no account lookup. Wiring Connect later means
 * filling these in; nothing else in the wallet form has to change.
 */
const stripeProvider: PayoutAccountProvider = {
  gateway: 'stripe',
  supportsAccountLookup: false,
  unsupportedReason:
    'Stripe confirms payout accounts during Connect onboarding, not from a bank lookup.',
  listBanks: async () => [],
  resolveAccount: async () => {
    throw new AppError(
      'Stripe payout accounts are confirmed through Connect onboarding, not a bank lookup.',
      400
    );
  },
};

const PROVIDERS: Record<string, PayoutAccountProvider> = {
  paystack: paystackProvider,
  stripe: stripeProvider,
};

export const getPayoutAccountProvider = (gateway: string): PayoutAccountProvider => {
  const normalized = String(gateway || '').trim().toLowerCase();
  const provider = PROVIDERS[normalized];
  if (!provider) {
    throw new AppError(`${gateway} does not support automatic payout accounts yet`, 400);
  }
  return provider;
};

export const listPayoutAccountGateways = () =>
  Object.values(PROVIDERS).map((provider) => ({
    gateway: provider.gateway,
    supportsAccountLookup: provider.supportsAccountLookup,
    unsupportedReason: provider.unsupportedReason || null,
  }));
