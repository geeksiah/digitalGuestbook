"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
// Mask sensitive fields
const maskSecret = (value) => {
    return value ? '••••••••' : null;
};
// ============================================
// SYSTEM SETTINGS
// ============================================
router.get('/', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    let settings = await prisma_js_1.default.systemSettings.findUnique({
        where: { id: 'default' },
    });
    if (!settings) {
        settings = await prisma_js_1.default.systemSettings.create({
            data: { id: 'default' },
        });
    }
    res.json({ settings });
}));
router.patch('/', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = req.body;
    // Remove system fields
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    const settings = await prisma_js_1.default.systemSettings.upsert({
        where: { id: 'default' },
        create: { id: 'default', ...data },
        update: data,
    });
    // Log the change
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin?.adminId,
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
router.get('/email-providers', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const providers = await prisma_js_1.default.emailProvider.findMany({
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
router.post('/email-providers', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = req.body;
    // If this is set as default, unset others
    if (data.isDefault) {
        await prisma_js_1.default.emailProvider.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
        });
    }
    const provider = await prisma_js_1.default.emailProvider.create({
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
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin?.adminId,
            action: 'EMAIL_PROVIDER_CREATED',
            entityType: 'EMAIL_PROVIDER',
            entityId: provider.id,
            details: JSON.stringify({ name: data.name, provider: data.provider }),
        },
    });
    res.status(201).json({ provider: { ...provider, smtpPass: maskSecret(provider.smtpPass), apiKey: maskSecret(provider.apiKey) } });
}));
router.patch('/email-providers/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    // Don't overwrite secrets with masked values
    if (data.smtpPass === '••••••••')
        delete data.smtpPass;
    if (data.apiKey === '••••••••')
        delete data.apiKey;
    // If this is set as default, unset others
    if (data.isDefault) {
        await prisma_js_1.default.emailProvider.updateMany({
            where: { isDefault: true, id: { not: id } },
            data: { isDefault: false },
        });
    }
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    const provider = await prisma_js_1.default.emailProvider.update({
        where: { id },
        data,
    });
    res.json({ provider: { ...provider, smtpPass: maskSecret(provider.smtpPass), apiKey: maskSecret(provider.apiKey) } });
}));
router.delete('/email-providers/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await prisma_js_1.default.emailProvider.delete({
        where: { id },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin?.adminId,
            action: 'EMAIL_PROVIDER_DELETED',
            entityType: 'EMAIL_PROVIDER',
            entityId: id,
            details: '{}',
        },
    });
    res.json({ message: 'Provider deleted' });
}));
router.post('/email-providers/:id/test', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email address required' });
    }
    const provider = await prisma_js_1.default.emailProvider.findUnique({
        where: { id },
    });
    if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
    }
    const { sendEmailWithProvider } = await import('../services/notifications.js');
    const result = await sendEmailWithProvider(provider, email, 'Test Email - Digital Event Platform', `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a2e;">Email Configuration Test</h1>
        <p>This is a test email from your Digital Event Platform using <strong>${provider.name}</strong>.</p>
        <p>If you received this email, your email provider is working correctly!</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Provider: ${provider.provider} | Sent at: ${new Date().toISOString()}
        </p>
      </div>
    `);
    if (result.success) {
        res.json({ success: true, message: 'Test email sent successfully' });
    }
    else {
        res.status(500).json({ success: false, error: result.error });
    }
}));
// ============================================
// SMS PROVIDERS
// ============================================
router.get('/sms-providers', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const providers = await prisma_js_1.default.smsProvider.findMany({
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
router.post('/sms-providers', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = req.body;
    if (data.isDefault) {
        await prisma_js_1.default.smsProvider.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
        });
    }
    const provider = await prisma_js_1.default.smsProvider.create({
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
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin?.adminId,
            action: 'SMS_PROVIDER_CREATED',
            entityType: 'SMS_PROVIDER',
            entityId: provider.id,
            details: JSON.stringify({ name: data.name, provider: data.provider }),
        },
    });
    res.status(201).json({ provider: { ...provider, authToken: maskSecret(provider.authToken), apiKey: maskSecret(provider.apiKey), apiSecret: maskSecret(provider.apiSecret) } });
}));
router.patch('/sms-providers/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    if (data.authToken === '••••••••')
        delete data.authToken;
    if (data.apiKey === '••••••••')
        delete data.apiKey;
    if (data.apiSecret === '••••••••')
        delete data.apiSecret;
    if (data.isDefault) {
        await prisma_js_1.default.smsProvider.updateMany({
            where: { isDefault: true, id: { not: id } },
            data: { isDefault: false },
        });
    }
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    const provider = await prisma_js_1.default.smsProvider.update({
        where: { id },
        data,
    });
    res.json({ provider: { ...provider, authToken: maskSecret(provider.authToken), apiKey: maskSecret(provider.apiKey), apiSecret: maskSecret(provider.apiSecret) } });
}));
router.delete('/sms-providers/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await prisma_js_1.default.smsProvider.delete({
        where: { id },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin?.adminId,
            action: 'SMS_PROVIDER_DELETED',
            entityType: 'SMS_PROVIDER',
            entityId: id,
            details: '{}',
        },
    });
    res.json({ message: 'Provider deleted' });
}));
router.post('/sms-providers/:id/test', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ error: 'Phone number required' });
    }
    const provider = await prisma_js_1.default.smsProvider.findUnique({
        where: { id },
    });
    if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
    }
    const { sendSmsWithProvider } = await import('../services/notifications.js');
    const result = await sendSmsWithProvider(provider, phone, `Test SMS from Digital Event Platform using ${provider.name}. Your configuration is working!`);
    if (result.success) {
        const response = { success: true, message: 'Test SMS sent successfully' };
        // Include balance for Arkesel if available
        if (provider.provider === 'arkesel' && result.balance !== undefined) {
            response.balance = result.balance;
        }
        res.json(response);
    }
    else {
        res.status(500).json({ success: false, error: result.error });
    }
}));
/**
 * GET /api/settings/sms-providers/:id/balance
 * Check SMS provider balance (for supported providers like Arkesel)
 */
router.get('/sms-providers/:id/balance', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const provider = await prisma_js_1.default.smsProvider.findUnique({
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
        }
        else {
            res.status(500).json({ success: false, error: result.error });
        }
    }
    else {
        res.status(400).json({ error: 'Balance check is only supported for Arkesel provider' });
    }
}));
// ============================================
// WHATSAPP PROVIDERS
// ============================================
router.get('/whatsapp-providers', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const providers = await prisma_js_1.default.whatsappProvider.findMany({
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
router.post('/whatsapp-providers', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = req.body;
    if (data.isDefault) {
        await prisma_js_1.default.whatsappProvider.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
        });
    }
    const provider = await prisma_js_1.default.whatsappProvider.create({
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
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin?.adminId,
            action: 'WHATSAPP_PROVIDER_CREATED',
            entityType: 'WHATSAPP_PROVIDER',
            entityId: provider.id,
            details: JSON.stringify({ name: data.name, provider: data.provider }),
        },
    });
    res.status(201).json({ provider: { ...provider, authToken: maskSecret(provider.authToken), apiKey: maskSecret(provider.apiKey), accessToken: maskSecret(provider.accessToken) } });
}));
router.patch('/whatsapp-providers/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    if (data.authToken === '••••••••')
        delete data.authToken;
    if (data.apiKey === '••••••••')
        delete data.apiKey;
    if (data.accessToken === '••••••••')
        delete data.accessToken;
    if (data.isDefault) {
        await prisma_js_1.default.whatsappProvider.updateMany({
            where: { isDefault: true, id: { not: id } },
            data: { isDefault: false },
        });
    }
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    const provider = await prisma_js_1.default.whatsappProvider.update({
        where: { id },
        data,
    });
    res.json({ provider: { ...provider, authToken: maskSecret(provider.authToken), apiKey: maskSecret(provider.apiKey), accessToken: maskSecret(provider.accessToken) } });
}));
router.delete('/whatsapp-providers/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await prisma_js_1.default.whatsappProvider.delete({
        where: { id },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin?.adminId,
            action: 'WHATSAPP_PROVIDER_DELETED',
            entityType: 'WHATSAPP_PROVIDER',
            entityId: id,
            details: '{}',
        },
    });
    res.json({ message: 'Provider deleted' });
}));
router.post('/whatsapp-providers/:id/test', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ error: 'Phone number required' });
    }
    const provider = await prisma_js_1.default.whatsappProvider.findUnique({
        where: { id },
    });
    if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
    }
    const { sendWhatsappWithProvider } = await import('../services/notifications.js');
    const result = await sendWhatsappWithProvider(provider, phone, `Test WhatsApp from Digital Event Platform using ${provider.name}. Your configuration is working!`);
    if (result.success) {
        res.json({ success: true, message: 'Test WhatsApp sent successfully' });
    }
    else {
        res.status(500).json({ success: false, error: result.error });
    }
}));
exports.default = router;
//# sourceMappingURL=settings.js.map