export type GatewayType =
  | 'stripe'
  | 'paystack'
  | 'flutterwave'
  | 'hubtel'
  | 'paypal'
  | 'mtn_momo'
  | 'telecel_cash'
  | 'airteltigo_cash'
  | 'custom';

export interface CurrencyOption {
  code: string;
  name: string;
}

export interface GatewayMeta {
  value: GatewayType;
  label: string;
  description: string;
}

export const GATEWAY_OPTIONS: GatewayMeta[] = [
  { value: 'stripe', label: 'Stripe', description: 'Cards and digital wallets' },
  { value: 'paystack', label: 'Paystack', description: 'Cards and bank transfer' },
  { value: 'flutterwave', label: 'Flutterwave', description: 'Cards and local payments' },
  { value: 'hubtel', label: 'Hubtel', description: 'Hubtel mobile and card checkout' },
  { value: 'paypal', label: 'PayPal', description: 'PayPal checkout' },
  { value: 'mtn_momo', label: 'MTN MoMo', description: 'Mobile money collection' },
  { value: 'telecel_cash', label: 'Telecel Cash', description: 'Telecel mobile money' },
  { value: 'airteltigo_cash', label: 'AirtelTigo Cash', description: 'AirtelTigo mobile money' },
  { value: 'custom', label: 'Custom Gateway', description: 'Custom processor integration' },
];

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'RWF', name: 'Rwandan Franc' },
  { code: 'ZAR', name: 'South African Rand' },
];

const GATEWAY_SUPPORTED_CURRENCIES: Record<GatewayType, 'ALL' | string[]> = {
  stripe: 'ALL',
  paystack: ['NGN', 'GHS', 'USD', 'ZAR', 'KES'],
  flutterwave: ['NGN', 'GHS', 'USD', 'KES', 'UGX', 'TZS', 'RWF', 'ZAR'],
  hubtel: ['GHS'],
  paypal: ['USD', 'EUR', 'GBP'],
  mtn_momo: ['GHS', 'UGX'],
  telecel_cash: ['GHS'],
  airteltigo_cash: ['GHS'],
  custom: 'ALL',
};

export const normalizeCurrencyCode = (value: string | null | undefined): string => {
  if (!value) return '';
  return String(value).trim().toUpperCase();
};

export const getCurrencyOption = (code: string): CurrencyOption => {
  const normalized = normalizeCurrencyCode(code);
  return (
    CURRENCY_OPTIONS.find((currency) => currency.code === normalized) || {
      code: normalized || 'USD',
      name: normalized || 'US Dollar',
    }
  );
};

export const getGatewayCurrencyOptions = (gateway: GatewayType | string): CurrencyOption[] => {
  const key = gateway as GatewayType;
  const supported = GATEWAY_SUPPORTED_CURRENCIES[key];
  if (!supported || supported === 'ALL') return CURRENCY_OPTIONS;
  return CURRENCY_OPTIONS.filter((currency) => supported.includes(currency.code));
};

export const uniqueCurrencyCodes = (codes: Array<string | null | undefined>): string[] => {
  const normalized = codes
    .map((code) => normalizeCurrencyCode(code))
    .filter(Boolean);
  return Array.from(new Set(normalized));
};
