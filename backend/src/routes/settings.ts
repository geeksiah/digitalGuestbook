import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateAdmin, requireRole } from '../middleware/auth.js';

const router = Router();

// Get system settings
router.get('/', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  let settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
  });
  
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: { id: 'default' },
    });
  }
  
  // Mask sensitive fields
  const safeSettings = {
    ...settings,
    smtpPass: settings.smtpPass ? '••••••••' : null,
    twilioAuthToken: settings.twilioAuthToken ? '••••••••' : null,
    whatsappApiKey: settings.whatsappApiKey ? '••••••••' : null,
  };
  
  res.json({ settings: safeSettings });
}));

// Update system settings
router.patch('/', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = req.body;
  
  // Don't overwrite secrets with masked values
  if (data.smtpPass === '••••••••') delete data.smtpPass;
  if (data.twilioAuthToken === '••••••••') delete data.twilioAuthToken;
  if (data.whatsappApiKey === '••••••••') delete data.whatsappApiKey;
  
  // Remove id from update data
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  
  const settings = await prisma.systemSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data },
    update: data,
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
  
  // Mask sensitive fields in response
  const safeSettings = {
    ...settings,
    smtpPass: settings.smtpPass ? '••••••••' : null,
    twilioAuthToken: settings.twilioAuthToken ? '••••••••' : null,
    whatsappApiKey: settings.whatsappApiKey ? '••••••••' : null,
  };
  
  res.json({ settings: safeSettings, message: 'Settings updated' });
}));

// Test email configuration
router.post('/test-email', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email address required' });
  }
  
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
  });
  
  if (!settings?.emailEnabled || !settings?.smtpHost) {
    return res.status(400).json({ error: 'Email not configured' });
  }
  
  const { sendEmail } = await import('../services/notifications.js');
  
  const result = await sendEmail(
    email,
    'Test Email - Digital Event Platform',
    `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a2e;">Email Configuration Test</h1>
        <p>This is a test email from your Digital Event Platform.</p>
        <p>If you received this email, your SMTP configuration is working correctly!</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Sent at: ${new Date().toISOString()}
        </p>
      </div>
    `
  );
  
  if (result.success) {
    res.json({ success: true, message: 'Test email sent successfully' });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
}));

// Test SMS configuration
router.post('/test-sms', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }
  
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
  });
  
  if (!settings?.smsEnabled || !settings?.twilioAccountSid) {
    return res.status(400).json({ error: 'SMS not configured' });
  }
  
  const { sendSMS } = await import('../services/notifications.js');
  
  const result = await sendSMS(
    phone,
    'Test SMS from Digital Event Platform. Your configuration is working!'
  );
  
  if (result.success) {
    res.json({ success: true, message: 'Test SMS sent successfully' });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
}));

// Test WhatsApp configuration
router.post('/test-whatsapp', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }
  
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
  });
  
  if (!settings?.whatsappEnabled || !settings?.twilioAccountSid) {
    return res.status(400).json({ error: 'WhatsApp not configured' });
  }
  
  const { sendWhatsApp } = await import('../services/notifications.js');
  
  const result = await sendWhatsApp(
    phone,
    'Test WhatsApp message from Digital Event Platform. Your configuration is working!'
  );
  
  if (result.success) {
    res.json({ success: true, message: 'Test WhatsApp sent successfully' });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
}));

export default router;

