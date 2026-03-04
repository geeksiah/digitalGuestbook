import { AppError } from '../../middleware/errorHandler.js';
import prisma from '../../utils/prisma.js';
import { hubtelAdapter } from './hubtelAdapter.js';
import { paystackAdapter } from './paystackAdapter.js';
import { stripeAdapter } from './stripeAdapter.js';
import type { AdapterGatewayConfig, GatewayType, PaymentAdapter } from './types.js';

const ADAPTERS: Record<GatewayType, PaymentAdapter> = {
  paystack: paystackAdapter,
  stripe: stripeAdapter,
  hubtel: hubtelAdapter,
};

export const getPaymentAdapter = (gateway: string): PaymentAdapter => {
  const normalized = String(gateway || '').trim().toLowerCase() as GatewayType;
  const adapter = ADAPTERS[normalized];
  if (!adapter) {
    throw new AppError(`Unsupported gateway adapter: ${gateway}`, 400);
  }
  return adapter;
};

export const resolveGatewayConfigForIntent = async (
  paymentIntentId: string
): Promise<AdapterGatewayConfig> => {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
    select: { id: true, gateway: true, metadataJson: true },
  });
  if (!intent) throw new AppError('Payment intent not found', 404);

  const metadata = intent.metadataJson ? (JSON.parse(intent.metadataJson) as Record<string, unknown>) : {};
  const configuredGatewayId =
    typeof metadata.paymentGatewayId === 'string' ? metadata.paymentGatewayId : null;

  let gatewayConfig = configuredGatewayId
    ? await prisma.paymentGateway.findFirst({
        where: { id: configuredGatewayId, isActive: true },
      })
    : null;

  if (!gatewayConfig) {
    gatewayConfig = await prisma.paymentGateway.findFirst({
      where: {
        gateway: intent.gateway,
        isActive: true,
      },
      orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  if (!gatewayConfig) {
    throw new AppError(`No active ${intent.gateway} gateway config found`, 400);
  }

  return gatewayConfig as AdapterGatewayConfig;
};

