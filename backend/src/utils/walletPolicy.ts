type CoverageRule = 'GLOBAL' | string[];

export type OwnerWalletMode = 'MANUAL_FALLBACK' | 'MANUAL_EXPLICIT' | 'AUTOMATED';

export type OwnerPayoutWalletRecord = {
  id: string;
  walletType: string;
  isActive: boolean;
  isVerified: boolean;
  currency: string;
  paystackSubaccount?: string | null;
  paystackRecipientCode?: string | null;
};

const MANUAL_TYPES = new Set(['manual', 'offline']);

const GATEWAY_TO_WALLET_TYPE: Record<string, string> = {
  stripe: 'stripe',
  paystack: 'paystack',
  paypal: 'paypal',
  flutterwave: 'flutterwave',
  hubtel: 'hubtel',
};

const GATEWAY_COVERAGE_RULES: Record<string, CoverageRule> = {
  stripe: 'GLOBAL',
  paypal: [
    'US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'SE', 'NO', 'DK',
    'PL', 'PT', 'AT', 'CH', 'CZ', 'HU', 'RO', 'SG', 'JP', 'HK', 'AE', 'IL', 'MX', 'BR',
  ],
  paystack: ['NG', 'GH', 'ZA', 'KE', 'CI', 'EG'],
  flutterwave: ['NG', 'GH', 'KE', 'UG', 'RW', 'TZ', 'ZA'],
  hubtel: ['GH'],
  mtn_momo: ['GH', 'UG', 'CM', 'CI', 'RW', 'ZM', 'BJ', 'GN'],
  telecel_cash: ['GH'],
  airteltigo_cash: ['GH'],
};

const normalizeCountry = (countryCode?: string | null) =>
  String(countryCode || '').trim().toUpperCase() || null;

export const normalizeWalletType = (walletType?: string | null) =>
  String(walletType || '').trim().toLowerCase();

export const walletTypeForGateway = (gateway: string) =>
  GATEWAY_TO_WALLET_TYPE[String(gateway || '').trim().toLowerCase()] || null;

export const isManualWalletType = (walletType?: string | null) =>
  MANUAL_TYPES.has(normalizeWalletType(walletType));

export const isGatewayConfigured = (gateway: any) => {
  const type = String(gateway?.gateway || '').toLowerCase();
  if (type === 'stripe') return Boolean(gateway?.stripePublicKey && gateway?.stripeSecretKey);
  if (type === 'paystack') return Boolean(gateway?.paystackPublicKey && gateway?.paystackSecretKey);
  if (type === 'flutterwave') return Boolean(gateway?.flutterwavePublicKey && gateway?.flutterwaveSecretKey);
  if (type === 'hubtel') return Boolean(gateway?.hubtelClientId && gateway?.hubtelClientSecret);
  if (type === 'paypal') return Boolean(gateway?.customGatewayApiKey || gateway?.customGatewayApiSecret || gateway?.customGatewayApiUrl);
  if (type === 'mtn_momo') return Boolean(gateway?.mtnMomoApiKey && gateway?.mtnMomoApiSecret && gateway?.mtnMomoSubscriptionKey);
  if (type === 'telecel_cash') return Boolean(gateway?.telecelCashApiKey && gateway?.telecelCashApiSecret && gateway?.telecelCashMerchantId);
  if (type === 'airteltigo_cash') return Boolean(gateway?.airteltigoCashApiKey && gateway?.airteltigoCashApiSecret && gateway?.airteltigoCashMerchantId);
  if (type === 'custom') return Boolean(gateway?.customGatewayApiUrl && (gateway?.customGatewayApiKey || gateway?.customGatewayApiSecret));
  return false;
};

export const isGatewaySupportedInCountry = (gatewayType: string, countryCode?: string | null) => {
  const normalizedType = String(gatewayType || '').toLowerCase();
  const rule = GATEWAY_COVERAGE_RULES[normalizedType];
  if (!rule) return true;
  if (rule === 'GLOBAL') return true;
  const normalizedCountry = normalizeCountry(countryCode);
  if (!normalizedCountry) return false;
  return rule.includes(normalizedCountry);
};

export const getAvailableWalletTypes = (params: {
  paymentGateways: Array<any>;
  countryCode?: string | null;
}) => {
  const result = new Set<string>(['manual', 'offline']);
  for (const gateway of params.paymentGateways) {
    const gatewayType = String(gateway?.gateway || '').toLowerCase();
    const walletType = walletTypeForGateway(gatewayType);
    if (!walletType) continue;
    if (!isGatewayConfigured(gateway)) continue;
    if (!isGatewaySupportedInCountry(gatewayType, params.countryCode)) continue;
    result.add(walletType);
  }
  return Array.from(result);
};

export const resolveOwnerWalletState = (
  wallets: OwnerPayoutWalletRecord[] = []
) => {
  const activeWallets = wallets.filter((wallet) => wallet.isActive);
  const manualWallet = activeWallets.find((wallet) => isManualWalletType(wallet.walletType)) || null;
  const automatedWallets = activeWallets.filter((wallet) => !isManualWalletType(wallet.walletType));
  const verifiedAutomatedWallets = automatedWallets.filter((wallet) => wallet.isVerified);
  const byType = new Map<string, OwnerPayoutWalletRecord>();
  for (const wallet of verifiedAutomatedWallets) {
    const walletType = normalizeWalletType(wallet.walletType);
    if (!byType.has(walletType)) byType.set(walletType, wallet);
  }

  const mode: OwnerWalletMode = manualWallet
    ? 'MANUAL_EXPLICIT'
    : verifiedAutomatedWallets.length > 0
    ? 'AUTOMATED'
    : 'MANUAL_FALLBACK';

  return {
    mode,
    activeWallets,
    manualWallet,
    automatedWallets,
    verifiedAutomatedWallets,
    walletByType: byType,
  };
};

export const filterEventGatewaysForOwner = (params: {
  eventGateways: Array<any>;
  walletState: ReturnType<typeof resolveOwnerWalletState>;
}) => {
  if (params.walletState.mode !== 'AUTOMATED') {
    return params.eventGateways;
  }
  return params.eventGateways.filter((eventGateway) => {
    const gatewayType = String(eventGateway?.paymentGateway?.gateway || eventGateway?.gateway || '').toLowerCase();
    const walletType = walletTypeForGateway(gatewayType);
    if (!walletType) return false;
    return params.walletState.walletByType.has(walletType);
  });
};

export const resolveRoutingForMethod = (params: {
  paymentMethod?: string | null;
  walletState: ReturnType<typeof resolveOwnerWalletState>;
}) => {
  const method = String(params.paymentMethod || '').trim().toLowerCase();
  const walletType = walletTypeForGateway(method);
  if (params.walletState.mode === 'AUTOMATED' && walletType) {
    const matchedWallet = params.walletState.walletByType.get(walletType) || null;
    if (matchedWallet) {
      return {
        payoutRouting: 'OWNER_AUTOMATED' as const,
        wallet: matchedWallet,
      };
    }
  }
  return {
    payoutRouting: 'ADMIN_MANUAL' as const,
    wallet: null,
  };
};
