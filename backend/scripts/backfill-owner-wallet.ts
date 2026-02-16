import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const getValueIfEmpty = <T>(current: T | null | undefined, incoming: T | null | undefined) => {
  if (incoming === null || incoming === undefined) return undefined;
  if (typeof current === 'string') {
    return current.trim().length === 0 ? incoming : undefined;
  }
  return current === null || current === undefined ? incoming : undefined;
};

async function run() {
  const payoutWallets = await prisma.payoutWallet.findMany({
    include: {
      event: {
        select: {
          id: true,
          ownerId: true,
        },
      },
    },
  });

  let skippedNoOwner = 0;
  let created = 0;
  let updated = 0;

  for (const payoutWallet of payoutWallets) {
    const ownerId = payoutWallet.event.ownerId;
    if (!ownerId) {
      skippedNoOwner += 1;
      continue;
    }

    const ownerWallet = await prisma.ownerWallet.findUnique({
      where: { ownerId },
    });

    if (!ownerWallet) {
      await prisma.ownerWallet.create({
        data: {
          ownerId,
          bankName: payoutWallet.bankName,
          accountName: payoutWallet.accountName,
          accountNumber: payoutWallet.accountNumber,
          routingNumber: payoutWallet.routingNumber,
          swiftCode: payoutWallet.swiftCode,
          mobileProvider: payoutWallet.mobileProvider,
          mobileNumber: payoutWallet.mobileNumber,
          paypalEmail: payoutWallet.paypalEmail,
          stripeAccountId: payoutWallet.stripeAccountId,
          paystackSubaccount: payoutWallet.paystackSubaccount,
          preferredMethod: payoutWallet.preferredMethod,
          currency: payoutWallet.currency,
          autoPayoutEnabled: payoutWallet.autoPayoutEnabled,
          autoPayoutThreshold: payoutWallet.autoPayoutThreshold,
          isVerified: payoutWallet.isVerified,
          verifiedAt: payoutWallet.verifiedAt,
        },
      });
      created += 1;
      continue;
    }

    const patch = {
      bankName: getValueIfEmpty(ownerWallet.bankName, payoutWallet.bankName),
      accountName: getValueIfEmpty(ownerWallet.accountName, payoutWallet.accountName),
      accountNumber: getValueIfEmpty(ownerWallet.accountNumber, payoutWallet.accountNumber),
      routingNumber: getValueIfEmpty(ownerWallet.routingNumber, payoutWallet.routingNumber),
      swiftCode: getValueIfEmpty(ownerWallet.swiftCode, payoutWallet.swiftCode),
      mobileProvider: getValueIfEmpty(ownerWallet.mobileProvider, payoutWallet.mobileProvider),
      mobileNumber: getValueIfEmpty(ownerWallet.mobileNumber, payoutWallet.mobileNumber),
      paypalEmail: getValueIfEmpty(ownerWallet.paypalEmail, payoutWallet.paypalEmail),
      stripeAccountId: getValueIfEmpty(ownerWallet.stripeAccountId, payoutWallet.stripeAccountId),
      paystackSubaccount: getValueIfEmpty(ownerWallet.paystackSubaccount, payoutWallet.paystackSubaccount),
      preferredMethod: getValueIfEmpty(ownerWallet.preferredMethod, payoutWallet.preferredMethod) || undefined,
      currency: getValueIfEmpty(ownerWallet.currency, payoutWallet.currency) || undefined,
      autoPayoutEnabled: ownerWallet.autoPayoutEnabled ? undefined : payoutWallet.autoPayoutEnabled,
      autoPayoutThreshold:
        ownerWallet.autoPayoutThreshold && ownerWallet.autoPayoutThreshold > 0
          ? undefined
          : payoutWallet.autoPayoutThreshold,
      isVerified: ownerWallet.isVerified ? undefined : payoutWallet.isVerified,
      verifiedAt: getValueIfEmpty(ownerWallet.verifiedAt, payoutWallet.verifiedAt),
    };

    const hasPatch = Object.values(patch).some((value) => value !== undefined);
    if (!hasPatch) continue;

    await prisma.ownerWallet.update({
      where: { ownerId },
      data: patch,
    });
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        totalLegacyWallets: payoutWallets.length,
        created,
        updated,
        skippedNoOwner,
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error('[backfill-owner-wallet] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
