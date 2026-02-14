import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

const normalizeFeeMode = (value: unknown) =>
  String(value || 'PERCENTAGE').toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENTAGE';

const toNonNegativeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

// Mask sensitive fields
const maskSecret = (value: string | null | undefined): string | null => {
  return value ? '••••••••' : null;
};

// ============================================
// SYSTEM SETTINGS
// ============================================

router.get('/', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  let settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
  });
  
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: { id: 'default' },
    });
  }
  
  res.json({ settings });
}));

router.patch('/', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const data: Record<string, unknown> = {
    siteName: body.siteName,
    siteUrl: body.siteUrl,
    logoUrl: body.logoUrl,
    emailEnabled: body.emailEnabled,
    smsEnabled: body.smsEnabled,
    whatsappEnabled: body.whatsappEnabled,
    defaultEmailProviderId: body.defaultEmailProviderId,
    defaultSmsProviderId: body.defaultSmsProviderId,
    defaultWhatsappProviderId: body.defaultWhatsappProviderId,
    platformFeeMode: normalizeFeeMode(body.platformFeeMode),
    platformFeePercent: toNonNegativeNumber(body.platformFeePercent, 5),
    platformFeeFixed: body.platformFeeFixed === null || body.platformFeeFixed === undefined
      ? null
      : toNonNegativeNumber(body.platformFeeFixed, 0),
    processingFeePercent: toNonNegativeNumber(body.processingFeePercent, 2.9),
    processingFeeFixed: toNonNegativeNumber(body.processingFeeFixed, 0.3),
  };
  
  // Remove system fields
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  
  const settings = await prisma.systemSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data } as any,
    update: data as any,
  });
  
  // Log the change
  await prisma.auditLog.create({
    data: {
      adminId: (req as any).admin?.adminId,
      action: 'SETTINGS_UPDATED',
      entityType: 'SYSTEM_SETTINGS',
      entityId: 'default',
      details: JSON.stringify({ updatedFields: Object.keys(data) }),
    },
  });
  
  res.json({ settings, message: 'Settings updated' });
}));

// ============================================
// EMAIL PROVIDERS
// ============================================

router.get('/email-providers', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const providers = await prisma.emailProvider.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  
  // Mask secrets
  const safeProviders = providers.map(p => ({
    ...p,
    smtpPass: maskSecret(p.smtpPass),
    apiKey: maskSecret(p.apiKey),
  }));
  
  res.json({ providers: safeProviders });
}));

router.post('/email-providers', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = req.body;
  
  // If this is set as default, unset others
  if (data.isDefault) {
    await prisma.emailProvider.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }
  
  const provider = await prisma.emailProvider.create({
    data: {
      name: data.name,
      provider: data.provider,
      isActive: data.isActive ?? true,
      isDefault: data.isDefault ?? false,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpUser: data.smtpUser,
      smtpPass: data.smtpPass,
      smtpSecure: data.smtpSecure ?? true,
      apiKey: data.apiKey,
      fromEmail: data.fromEmail,
      fromName: data.fromName,
    },
  });
  
  await prisma.auditLog.create({
    data: {
      adminId: (req as any).admin?.adminId,
      action: 'EMAIL_PROVIDER_CREATED',
      entityType: 'EMAIL_PROVIDER',
      entityId: provider.id,
      details: JSON.stringify({ name: data.name, provider: data.provider }),
    },
  });
  
  res.status(201).json({ provider: { ...provider, smtpPass: maskSecret(provider.smtpPass), apiKey: maskSecret(provider.apiKey) } });
}));

router.patch('/email-providers/:id', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  
  // Don't overwrite secrets with masked values
  if (data.smtpPass === '••••••••') delete data.smtpPass;
  if (data.apiKey === '••••••••') delete data.apiKey;
  
  // If this is set as default, unset others
  if (data.isDefault) {
    await prisma.emailProvider.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }
  
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  
  const provider = await prisma.emailProvider.update({
    where: { id },
    data,
  });
  
  res.json({ provider: { ...provider, smtpPass: maskSecret(provider.smtpPass), apiKey: maskSecret(provider.apiKey) } });
}));

router.delete('/email-providers/:id', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  await prisma.emailProvider.delete({
    where: { id },
  });
  
  await prisma.auditLog.create({
    data: {
      adminId: (req as any).admin?.adminId,
      action: 'EMAIL_PROVIDER_DELETED',
      entityType: 'EMAIL_PROVIDER',
      entityId: id,
      details: '{}',
    },
  });
  
  res.json({ message: 'Provider deleted' });
}));

router.post('/email-providers/:id/test', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email } = req.body;
  
  console.log('[Test Email] Request received for provider:', id, 'to:', email);
  
  if (!email) {
    return res.status(400).json({ error: 'Email address required' });
  }
  
  const provider = await prisma.emailProvider.findUnique({
    where: { id },
  });
  
  if (!provider) {
    console.error('[Test Email] Provider not found:', id);
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  if (!provider.isActive) {
    console.error('[Test Email] Provider is not active:', id);
    return res.status(400).json({ error: 'Provider is not active' });
  }
  
  console.log('[Test Email] Using provider:', provider.name, 'Type:', provider.provider);
  const { sendEmailWithProvider } = await import('../services/notifications.js');
  
  const result = await sendEmailWithProvider(
    provider,
    email,
    'Test Email - Digital Event Platform',
    `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a2e;">Email Configuration Test</h1>
        <p>This is a test email from your Digital Event Platform using <strong>${provider.name}</strong>.</p>
        <p>If you received this email, your email provider is working correctly!</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Provider: ${provider.provider} | Sent at: ${new Date().toISOString()}
        </p>
      </div>
    `
  );
  
  if (result.success) {
    console.log('[Test Email] Successfully sent test email to:', email);
    res.json({ success: true, message: 'Test email sent successfully' });
  } else {
    console.error('[Test Email] Failed to send test email to:', email, 'Error:', result.error);
    res.status(500).json({ success: false, error: result.error });
  }
}));

// ============================================
// SMS PROVIDERS
// ============================================

router.get('/sms-providers', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const providers = await prisma.smsProvider.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  
  const safeProviders = providers.map(p => ({
    ...p,
    authToken: maskSecret(p.authToken),
    apiKey: maskSecret(p.apiKey),
    apiSecret: maskSecret(p.apiSecret),
  }));
  
  res.json({ providers: safeProviders });
}));

router.post('/sms-providers', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = req.body;
  
  if (data.isDefault) {
    await prisma.smsProvider.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }
  
  const provider = await prisma.smsProvider.create({
    data: {
      name: data.name,
      provider: data.provider,
      isActive: data.isActive ?? true,
      isDefault: data.isDefault ?? false,
      accountSid: data.accountSid,
      authToken: data.authToken,
      phoneNumber: data.phoneNumber,
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      senderId: data.senderId,
    },
  });
  
  await prisma.auditLog.create({
    data: {
      adminId: (req as any).admin?.adminId,
      action: 'SMS_PROVIDER_CREATED',
      entityType: 'SMS_PROVIDER',
      entityId: provider.id,
      details: JSON.stringify({ name: data.name, provider: data.provider }),
    },
  });
  
  res.status(201).json({ provider: { ...provider, authToken: maskSecret(provider.authToken), apiKey: maskSecret(provider.apiKey), apiSecret: maskSecret(provider.apiSecret) } });
}));

router.patch('/sms-providers/:id', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  
  if (data.authToken === '••••••••') delete data.authToken;
  if (data.apiKey === '••••••••') delete data.apiKey;
  if (data.apiSecret === '••••••••') delete data.apiSecret;
  
  if (data.isDefault) {
    await prisma.smsProvider.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }
  
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  
  const provider = await prisma.smsProvider.update({
    where: { id },
    data,
  });
  
  res.json({ provider: { ...provider, authToken: maskSecret(provider.authToken), apiKey: maskSecret(provider.apiKey), apiSecret: maskSecret(provider.apiSecret) } });
}));

router.delete('/sms-providers/:id', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  await prisma.smsProvider.delete({
    where: { id },
  });
  
  await prisma.auditLog.create({
    data: {
      adminId: (req as any).admin?.adminId,
      action: 'SMS_PROVIDER_DELETED',
      entityType: 'SMS_PROVIDER',
      entityId: id,
      details: '{}',
    },
  });
  
  res.json({ message: 'Provider deleted' });
}));

router.post('/sms-providers/:id/test', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  const provider = await prisma.smsProvider.findUnique({
    where: { id },
  });

  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  const { sendSmsWithProvider } = await import('../services/notifications.js');

  const result = await sendSmsWithProvider(
    provider,
    phone,
    `Test SMS from Digital Event Platform using ${provider.name}. Your configuration is working!`
  );

  if (result.success) {
    const response: any = { success: true, message: 'Test SMS sent successfully' };
    // Include balance for Arkesel if available
    if (provider.provider === 'arkesel' && (result as any).balance !== undefined) {
      response.balance = (result as any).balance;
    }
    res.json(response);
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
}));

/**
 * GET /api/settings/sms-providers/:id/balance
 * Check SMS provider balance (for supported providers like Arkesel)
 */
router.get('/sms-providers/:id/balance', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const provider = await prisma.smsProvider.findUnique({
    where: { id },
  });

  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  if (provider.provider === 'arkesel' && provider.apiKey) {
    const { checkArkeselBalance } = await import('../services/notifications.js');
    const result = await checkArkeselBalance(provider.apiKey);

    if (result.success) {
      res.json({ success: true, balance: result.balance, currency: 'GHS' }); // Arkesel uses Ghana Cedis
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } else {
    res.status(400).json({ error: 'Balance check is only supported for Arkesel provider' });
  }
}));

// ============================================
// WHATSAPP PROVIDERS
// ============================================

router.get('/whatsapp-providers', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const providers = await prisma.whatsappProvider.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  
  const safeProviders = providers.map(p => ({
    ...p,
    authToken: maskSecret(p.authToken),
    apiKey: maskSecret(p.apiKey),
    accessToken: maskSecret(p.accessToken),
  }));
  
  res.json({ providers: safeProviders });
}));

router.post('/whatsapp-providers', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = req.body;
  
  if (data.isDefault) {
    await prisma.whatsappProvider.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }
  
  const provider = await prisma.whatsappProvider.create({
    data: {
      name: data.name,
      provider: data.provider,
      isActive: data.isActive ?? true,
      isDefault: data.isDefault ?? false,
      accountSid: data.accountSid,
      authToken: data.authToken,
      phoneNumber: data.phoneNumber,
      apiKey: data.apiKey,
      phoneNumberId: data.phoneNumberId,
      businessId: data.businessId,
      accessToken: data.accessToken,
    },
  });
  
  await prisma.auditLog.create({
    data: {
      adminId: (req as any).admin?.adminId,
      action: 'WHATSAPP_PROVIDER_CREATED',
      entityType: 'WHATSAPP_PROVIDER',
      entityId: provider.id,
      details: JSON.stringify({ name: data.name, provider: data.provider }),
    },
  });
  
  res.status(201).json({ provider: { ...provider, authToken: maskSecret(provider.authToken), apiKey: maskSecret(provider.apiKey), accessToken: maskSecret(provider.accessToken) } });
}));

router.patch('/whatsapp-providers/:id', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  
  if (data.authToken === '••••••••') delete data.authToken;
  if (data.apiKey === '••••••••') delete data.apiKey;
  if (data.accessToken === '••••••••') delete data.accessToken;
  
  if (data.isDefault) {
    await prisma.whatsappProvider.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }
  
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  
  const provider = await prisma.whatsappProvider.update({
    where: { id },
    data,
  });
  
  res.json({ provider: { ...provider, authToken: maskSecret(provider.authToken), apiKey: maskSecret(provider.apiKey), accessToken: maskSecret(provider.accessToken) } });
}));

router.delete('/whatsapp-providers/:id', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  await prisma.whatsappProvider.delete({
    where: { id },
  });
  
  await prisma.auditLog.create({
    data: {
      adminId: (req as any).admin?.adminId,
      action: 'WHATSAPP_PROVIDER_DELETED',
      entityType: 'WHATSAPP_PROVIDER',
      entityId: id,
      details: '{}',
    },
  });
  
  res.json({ message: 'Provider deleted' });
}));

router.post('/whatsapp-providers/:id/test', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }
  
  const provider = await prisma.whatsappProvider.findUnique({
    where: { id },
  });
  
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  const { sendWhatsappWithProvider } = await import('../services/notifications.js');
  
  const result = await sendWhatsappWithProvider(
    provider,
    phone,
    `Test WhatsApp from Digital Event Platform using ${provider.name}. Your configuration is working!`
  );
  
  if (result.success) {
    res.json({ success: true, message: 'Test WhatsApp sent successfully' });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
}));

export default router;
