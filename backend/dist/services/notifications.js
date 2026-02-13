"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailWithProvider = sendEmailWithProvider;
exports.sendSmsWithProvider = sendSmsWithProvider;
exports.checkArkeselBalance = checkArkeselBalance;
exports.sendWhatsappWithProvider = sendWhatsappWithProvider;
exports.sendEmail = sendEmail;
exports.sendSMS = sendSMS;
exports.sendWhatsApp = sendWhatsApp;
exports.sendWhatsAppRsvpInvite = sendWhatsAppRsvpInvite;
exports.sendBroadcast = sendBroadcast;
exports.sendRsvpConfirmation = sendRsvpConfirmation;
exports.sendInvitationEmail = sendInvitationEmail;
exports.sendInvitationWhatsApp = sendInvitationWhatsApp;
exports.sendInvitationSMS = sendInvitationSMS;
exports.sendInvitationNotifications = sendInvitationNotifications;
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
// ============================================
// PROVIDER-BASED EMAIL
// ============================================
async function sendEmailWithProvider(provider, to, subject, html, text, attachments) {
    console.log('[Email] sendEmailWithProvider called - Provider:', provider.name, 'To:', to, 'Subject:', subject);
    try {
        if (provider.provider === 'smtp') {
            const port = provider.smtpPort || 587;
            // Port 465 uses direct SSL/TLS (secure: true)
            // Port 587 uses STARTTLS (secure: false, requiresTLS: true)
            // Port 25 is usually plain text
            // Override database setting if it conflicts with port requirements
            let useSecure;
            let useRequireTLS;
            if (port === 465) {
                // Port 465 requires direct SSL/TLS
                useSecure = true;
                useRequireTLS = false;
            }
            else if (port === 587) {
                // Port 587 requires STARTTLS
                useSecure = false;
                useRequireTLS = true;
            }
            else {
                // For other ports (2525, 8025, etc.), use STARTTLS by default
                // Port 2525 is commonly used for STARTTLS
                useSecure = false;
                useRequireTLS = true;
            }
            const transporter = nodemailer_1.default.createTransport({
                host: provider.smtpHost,
                port: port,
                secure: useSecure, // true for 465, false for other ports
                requireTLS: useRequireTLS, // Use STARTTLS for port 587, 2525, etc.
                auth: {
                    user: provider.smtpUser,
                    pass: provider.smtpPass || '',
                },
                tls: {
                    // Do not fail on invalid certificates (some providers use self-signed certs)
                    rejectUnauthorized: false,
                },
                connectionTimeout: 10000, // 10 seconds
                greetingTimeout: 10000, // 10 seconds
                socketTimeout: 10000, // 10 seconds
            });
            console.log('[Email] Creating transporter with config:', {
                host: provider.smtpHost,
                port: port,
                secure: useSecure,
                requireTLS: useRequireTLS,
                user: provider.smtpUser,
                hasPassword: !!provider.smtpPass,
                note: port === 465 ? 'Direct SSL/TLS' : port === 587 ? 'STARTTLS' : 'STARTTLS (Custom Port)',
            });
            console.log('[Email] Attempting to send mail...');
            const sendPromise = transporter.sendMail({
                from: provider.fromName
                    ? `"${provider.fromName}" <${provider.fromEmail || provider.smtpUser}>`
                    : provider.fromEmail || provider.smtpUser,
                to,
                subject,
                html,
                text: text || html.replace(/<[^>]*>/g, ''),
                attachments: attachments?.map(att => ({
                    filename: att.filename,
                    content: att.content,
                    cid: att.cid,
                })),
            });
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000);
            });
            const result = await Promise.race([sendPromise, timeoutPromise]);
            console.log('[Email] Sent via', provider.name, 'to:', to, 'ID:', result.messageId);
            return { success: true, messageId: result.messageId };
        }
        if (provider.provider === 'sendgrid' && provider.apiKey) {
            // SendGrid via HTTP API
            const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${provider.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    personalizations: [{ to: [{ email: to }] }],
                    from: { email: provider.fromEmail, name: provider.fromName },
                    subject,
                    content: [
                        { type: 'text/html', value: html },
                        { type: 'text/plain', value: text || html.replace(/<[^>]*>/g, '') },
                    ],
                }),
            });
            if (response.ok) {
                console.log('[Email] Sent via SendGrid to:', to);
                return { success: true };
            }
            else {
                const error = await response.text();
                throw new Error(`SendGrid error: ${error}`);
            }
        }
        if (provider.provider === 'mailgun' && provider.apiKey) {
            // Mailgun requires domain in API key format
            const [apiKey, domain] = provider.apiKey.split(':');
            const formData = new URLSearchParams();
            formData.append('from', provider.fromName ? `${provider.fromName} <${provider.fromEmail}>` : provider.fromEmail || '');
            formData.append('to', to);
            formData.append('subject', subject);
            formData.append('html', html);
            const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
                },
                body: formData,
            });
            if (response.ok) {
                const result = await response.json();
                console.log('[Email] Sent via Mailgun to:', to);
                return { success: true, messageId: result.id };
            }
            else {
                const error = await response.text();
                throw new Error(`Mailgun error: ${error}`);
            }
        }
        return { success: false, error: `Unsupported email provider: ${provider.provider}` };
    }
    catch (error) {
        console.error('[Email] Failed to send via', provider.name, ':', error.message);
        console.error('[Email] Error details:', {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode,
            stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        });
        return { success: false, error: error.message };
    }
}
// ============================================
// PROVIDER-BASED SMS
// ============================================
async function sendSmsWithProvider(provider, to, message) {
    try {
        if (provider.provider === 'twilio' && provider.accountSid && provider.authToken) {
            const twilio = await import('twilio');
            const client = twilio.default(provider.accountSid, provider.authToken);
            const result = await client.messages.create({
                body: message,
                from: provider.phoneNumber || undefined,
                to,
            });
            console.log('[SMS] Sent via Twilio to:', to, 'SID:', result.sid);
            return { success: true, sid: result.sid };
        }
        if (provider.provider === 'termii' && provider.apiKey) {
            const response = await fetch('https://api.ng.termii.com/api/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to,
                    from: provider.senderId || 'Event',
                    sms: message,
                    type: 'plain',
                    channel: 'generic',
                    api_key: provider.apiKey,
                }),
            });
            if (response.ok) {
                const result = await response.json();
                console.log('[SMS] Sent via Termii to:', to);
                return { success: true, messageId: result.message_id };
            }
            else {
                const error = await response.text();
                throw new Error(`Termii error: ${error}`);
            }
        }
        if (provider.provider === 'africastalking' && provider.apiKey) {
            const response = await fetch('https://api.africastalking.com/version1/messaging', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'apiKey': provider.apiKey,
                },
                body: new URLSearchParams({
                    username: provider.accountSid || 'sandbox',
                    to,
                    message,
                    from: provider.senderId || '',
                }),
            });
            if (response.ok) {
                const result = await response.json();
                console.log('[SMS] Sent via Africa\'s Talking to:', to);
                return { success: true, messageId: result.SMSMessageData?.Recipients?.[0]?.messageId };
            }
            else {
                const error = await response.text();
                throw new Error(`Africa's Talking error: ${error}`);
            }
        }
        if (provider.provider === 'arkesel' && provider.apiKey) {
            // Arkesel SMS API - Text/Plain SMS
            // Format: https://sms.arkesel.com/sms/api?action=send-sms&api_key=XXX&to=PhoneNumber&from=SenderID&sms=Message
            // Validate sender ID (required for Arkesel)
            if (!provider.senderId) {
                throw new Error('Sender ID is required for Arkesel SMS provider. Please configure senderId in provider settings.');
            }
            const apiUrl = new URL('https://sms.arkesel.com/sms/api');
            apiUrl.searchParams.append('action', 'send-sms');
            apiUrl.searchParams.append('api_key', provider.apiKey);
            apiUrl.searchParams.append('to', to.replace(/^\+/, '')); // Remove leading + if present
            apiUrl.searchParams.append('from', provider.senderId); // Sender ID (required, already validated)
            apiUrl.searchParams.append('sms', message);
            const response = await fetch(apiUrl.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });
            if (response.ok) {
                const result = await response.json();
                // Log raw response for debugging
                console.log('[SMS] Arkesel response:', JSON.stringify(result));
                // Arkesel response format: { status: "success", data: { status: "sent", message_id: "...", balance: ... } }
                // Sometimes response is: { status: "success", message: "SMS sent", data: { ... } }
                // Also handles: { status: "success", message: "Successfully Sent", ... }
                // Or: { message: "Successfully Sent", ... } (without status field)
                // Or: { status: "ok", message: "Successfully Sent", ... } (different status value)
                const statusIsSuccess = result.status?.toLowerCase() === 'success' ||
                    result.status?.toLowerCase() === 'ok' ||
                    !result.status;
                const dataStatusIsSent = result.data?.status?.toLowerCase() === 'sent';
                const messageIndicatesSuccess = result.message?.toLowerCase().includes('sent') ||
                    result.message?.toLowerCase().includes('successfully');
                // Success conditions (prioritize message indication over status if message is clear):
                // 1. If message clearly indicates success, treat as success (most reliable indicator)
                // 2. OR if status is success/ok AND (data.status is "sent" OR message indicates success)
                const isSuccess = messageIndicatesSuccess ||
                    (statusIsSuccess && (dataStatusIsSent || messageIndicatesSuccess));
                if (isSuccess) {
                    console.log('[SMS] Sent via Arkesel to:', to, 'Message ID:', result.data?.message_id, 'Balance:', result.data?.balance);
                    return {
                        success: true,
                        messageId: result.data?.message_id,
                        balance: result.data?.balance, // Return balance if available
                    };
                }
                else {
                    // Handle error response from Arkesel
                    const errorMsg = result.message || result.data?.message || JSON.stringify(result);
                    console.error('[SMS] Arkesel failed - status:', result.status, 'data.status:', result.data?.status, 'message:', result.message);
                    throw new Error(`Arkesel SMS failed: ${errorMsg}`);
                }
            }
            else {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                }
                catch {
                    errorData = { message: errorText };
                }
                throw new Error(`Arkesel API error (${response.status}): ${errorData.message || errorText}`);
            }
        }
        return { success: false, error: `Unsupported SMS provider: ${provider.provider}` };
    }
    catch (error) {
        console.error('[SMS] Failed to send via', provider.name, ':', error.message);
        return { success: false, error: error.message };
    }
}
/**
 * Check Arkesel SMS balance
 */
async function checkArkeselBalance(apiKey) {
    try {
        const apiUrl = new URL('https://sms.arkesel.com/sms/api');
        apiUrl.searchParams.append('action', 'check-balance');
        apiUrl.searchParams.append('api_key', apiKey);
        apiUrl.searchParams.append('response', 'json');
        const response = await fetch(apiUrl.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });
        if (response.ok) {
            const result = await response.json();
            // Arkesel returns balance in different formats:
            // Format 1: { status: "success", balance: 95.50 }
            // Format 2: { status: "success", data: { balance: 95.50 } }
            // Format 3: { balance: 95.50 }
            const balanceValue = result.balance ?? result.data?.balance;
            const balance = typeof balanceValue === 'string' ? parseFloat(balanceValue) : balanceValue;
            if (balance !== undefined && !isNaN(balance)) {
                console.log('[SMS] Arkesel balance checked:', balance);
                return { success: true, balance };
            }
            else {
                const errorMsg = result.message || 'Balance not found in response';
                return { success: false, error: errorMsg };
            }
        }
        else {
            const error = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(error);
            }
            catch {
                errorData = { message: error };
            }
            throw new Error(`Arkesel balance check error (${response.status}): ${errorData.message || error}`);
        }
    }
    catch (error) {
        console.error('[SMS] Failed to check Arkesel balance:', error.message);
        return { success: false, error: error.message };
    }
}
// ============================================
// PROVIDER-BASED WHATSAPP
// ============================================
async function sendWhatsappWithProvider(provider, to, message) {
    try {
        if (provider.provider === 'twilio' && provider.accountSid && provider.authToken) {
            const twilio = await import('twilio');
            const client = twilio.default(provider.accountSid, provider.authToken);
            const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
            const whatsappFrom = provider.phoneNumber?.startsWith('whatsapp:')
                ? provider.phoneNumber
                : `whatsapp:${provider.phoneNumber}`;
            const result = await client.messages.create({
                body: message,
                from: whatsappFrom,
                to: whatsappTo,
            });
            console.log('[WhatsApp] Sent via Twilio to:', to, 'SID:', result.sid);
            return { success: true, sid: result.sid };
        }
        if (provider.provider === 'meta' && provider.accessToken && provider.phoneNumberId) {
            const response = await fetch(`https://graph.facebook.com/v18.0/${provider.phoneNumberId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${provider.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: to.replace(/^\+/, ''),
                    type: 'text',
                    text: { body: message },
                }),
            });
            if (response.ok) {
                const result = await response.json();
                console.log('[WhatsApp] Sent via Meta to:', to);
                return { success: true, messageId: result.messages?.[0]?.id };
            }
            else {
                const error = await response.json();
                throw new Error(`Meta WhatsApp error: ${JSON.stringify(error)}`);
            }
        }
        return { success: false, error: `Unsupported WhatsApp provider: ${provider.provider}` };
    }
    catch (error) {
        console.error('[WhatsApp] Failed to send via', provider.name, ':', error.message);
        return { success: false, error: error.message };
    }
}
// ============================================
// DEFAULT PROVIDER FUNCTIONS (use default active provider)
// ============================================
async function getDefaultEmailProvider() {
    return prisma_js_1.default.emailProvider.findFirst({
        where: { isDefault: true, isActive: true },
    });
}
async function getDefaultSmsProvider() {
    return prisma_js_1.default.smsProvider.findFirst({
        where: { isDefault: true, isActive: true },
    });
}
async function getDefaultWhatsappProvider() {
    return prisma_js_1.default.whatsappProvider.findFirst({
        where: { isDefault: true, isActive: true },
    });
}
async function sendEmail(to, subject, html, text) {
    console.log('[Email] Attempting to send email to:', to, 'Subject:', subject);
    const settings = await prisma_js_1.default.systemSettings.findUnique({ where: { id: 'default' } });
    if (!settings?.emailEnabled) {
        console.log('[Email] Service disabled, skipping email to:', to);
        return { success: false, error: 'Email not enabled' };
    }
    const provider = await getDefaultEmailProvider();
    if (!provider) {
        console.log('[Email] No default provider configured');
        return { success: false, error: 'No email provider configured' };
    }
    console.log('[Email] Using provider:', provider.name, 'Type:', provider.provider);
    const result = await sendEmailWithProvider(provider, to, subject, html, text);
    if (result.success) {
        console.log('[Email] Successfully sent email to:', to);
    }
    else {
        console.error('[Email] Failed to send email to:', to, 'Error:', result.error);
    }
    return result;
}
async function sendSMS(to, message) {
    console.log('[SMS] Attempting to send SMS to:', to);
    const settings = await prisma_js_1.default.systemSettings.findUnique({ where: { id: 'default' } });
    if (!settings?.smsEnabled) {
        console.log('[SMS] Service disabled, skipping SMS to:', to);
        return { success: false, error: 'SMS not enabled' };
    }
    const provider = await getDefaultSmsProvider();
    if (!provider) {
        console.log('[SMS] No default provider configured');
        return { success: false, error: 'No SMS provider configured' };
    }
    console.log('[SMS] Using provider:', provider.name, 'Type:', provider.provider);
    const result = await sendSmsWithProvider(provider, to, message);
    if (result.success) {
        console.log('[SMS] Successfully sent SMS to:', to);
    }
    else {
        console.error('[SMS] Failed to send SMS to:', to, 'Error:', result.error);
    }
    return result;
}
async function sendWhatsApp(to, message) {
    console.log('[WhatsApp] Attempting to send WhatsApp message to:', to);
    const settings = await prisma_js_1.default.systemSettings.findUnique({ where: { id: 'default' } });
    if (!settings?.whatsappEnabled) {
        console.log('[WhatsApp] Service disabled, skipping message to:', to);
        return { success: false, error: 'WhatsApp not enabled' };
    }
    const provider = await getDefaultWhatsappProvider();
    if (!provider) {
        console.log('[WhatsApp] No default provider configured');
        return { success: false, error: 'No WhatsApp provider configured' };
    }
    console.log('[WhatsApp] Using provider:', provider.name, 'Type:', provider.provider);
    const result = await sendWhatsappWithProvider(provider, to, message);
    if (result.success) {
        console.log('[WhatsApp] Successfully sent WhatsApp message to:', to);
    }
    else {
        console.error('[WhatsApp] Failed to send WhatsApp message to:', to, 'Error:', result.error);
    }
    return result;
}
function buildRsvpInviteTextMessage(input) {
    const opener = input.reminder
        ? `Reminder: RSVP for ${input.eventName}.`
        : `You are invited to ${input.eventName}.`;
    return (`${opener}\n` +
        `Open invite card: ${input.inviteUrl}\n` +
        `Quick reply: YES ${input.token} or NO ${input.token}\n` +
        `You can add party size and notes after one tap.`);
}
async function sendMetaInteractiveRsvpInvite(provider, to, input) {
    const response = await fetch(`https://graph.facebook.com/v18.0/${provider.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${provider.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to.replace(/^whatsapp:/, '').replace(/^\+/, ''),
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: 'Event RSVP',
                },
                body: {
                    text: `${input.reminder ? 'Reminder' : 'Invitation'} for ${input.eventName}. Tap Yes or No.`,
                },
                footer: {
                    text: 'Optional details can be added after your response.',
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: `RSVP:YES:${input.token}`,
                                title: 'Yes',
                            },
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: `RSVP:NO:${input.token}`,
                                title: 'No',
                            },
                        },
                    ],
                },
            },
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Meta interactive invite failed (${response.status}): ${errorBody}`);
    }
    const payload = await response.json();
    return {
        success: true,
        mode: 'interactive',
        messageId: payload.messages?.[0]?.id,
    };
}
async function sendWhatsAppRsvpInvite(to, input) {
    console.log('[WhatsApp RSVP Invite] Sending invite to:', to);
    const settings = await prisma_js_1.default.systemSettings.findUnique({ where: { id: 'default' } });
    if (!settings?.whatsappEnabled) {
        return { success: false, mode: 'disabled', error: 'WhatsApp not enabled' };
    }
    const provider = await getDefaultWhatsappProvider();
    if (!provider) {
        return { success: false, mode: 'disabled', error: 'No WhatsApp provider configured' };
    }
    // Hybrid mode: native quick replies where available (Meta), fallback to deep-link + tokenized text.
    if (provider.provider === 'meta' && provider.accessToken && provider.phoneNumberId) {
        try {
            const interactive = await sendMetaInteractiveRsvpInvite(provider, to, input);
            return interactive;
        }
        catch (error) {
            console.warn('[WhatsApp RSVP Invite] Interactive send failed, falling back to text:', error.message);
        }
    }
    const textMessage = buildRsvpInviteTextMessage(input);
    const fallback = await sendWhatsappWithProvider(provider, to, textMessage);
    return {
        ...fallback,
        mode: 'text',
    };
}
// ============================================
// BROADCAST & NOTIFICATION FUNCTIONS
// ============================================
async function sendBroadcast(eventId, broadcastId, message, subject, channels, audience) {
    const settings = await prisma_js_1.default.systemSettings.findUnique({ where: { id: 'default' } });
    const where = { eventId };
    if (audience === 'APPROVED_ONLY') {
        where.status = 'APPROVED';
    }
    const rsvps = await prisma_js_1.default.rSVP.findMany({
        where,
        select: {
            id: true,
            primaryName: true,
            email: true,
            phone: true,
        },
    });
    let delivered = 0;
    let failed = 0;
    for (const rsvp of rsvps) {
        const personalizedMessage = message
            .replace(/\{name\}/g, rsvp.primaryName)
            .replace(/\{guest_name\}/g, rsvp.primaryName);
        const personalizedSubject = subject
            ? subject.replace(/\{name\}/g, rsvp.primaryName)
            : 'Message from Event';
        if (channels.includes('EMAIL') && rsvp.email && settings?.emailEnabled) {
            const result = await sendEmail(rsvp.email, personalizedSubject, `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Dear ${rsvp.primaryName},</p>
          <div style="white-space: pre-line;">${personalizedMessage}</div>
        </div>`);
            if (result.success)
                delivered++;
            else
                failed++;
        }
        if (channels.includes('SMS') && rsvp.phone && settings?.smsEnabled) {
            const result = await sendSMS(rsvp.phone, personalizedMessage);
            if (result.success)
                delivered++;
            else
                failed++;
        }
        if (channels.includes('WHATSAPP') && rsvp.phone && settings?.whatsappEnabled) {
            const result = await sendWhatsApp(rsvp.phone, personalizedMessage);
            if (result.success)
                delivered++;
            else
                failed++;
        }
    }
    await prisma_js_1.default.broadcast.update({
        where: { id: broadcastId },
        data: {
            status: 'SENT',
            sentAt: new Date(),
            totalRecipients: rsvps.length,
            deliveredCount: delivered,
            failedCount: failed,
        },
    });
    return { totalRecipients: rsvps.length, delivered, failed };
}
async function sendRsvpConfirmation(rsvpId) {
    const rsvp = await prisma_js_1.default.rSVP.findUnique({
        where: { id: rsvpId },
        include: {
            event: true,
            invitation: true,
        },
    });
    if (!rsvp || !rsvp.email)
        return { success: false, error: 'No email address' };
    const eventDate = new Date(rsvp.event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    let html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a2e; text-align: center;">${rsvp.event.name}</h1>
      <p>Dear ${rsvp.primaryName},</p>
      <p>Thank you for your RSVP! Your response has been received.</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Event:</strong> ${rsvp.event.name}</p>
        <p><strong>Date:</strong> ${eventDate}</p>
        ${rsvp.event.venue ? `<p><strong>Venue:</strong> ${rsvp.event.venue}</p>` : ''}
        <p><strong>Your Response:</strong> ${rsvp.attendance}</p>
        <p><strong>Party Size:</strong> ${rsvp.guestCount}</p>
      </div>
  `;
    if (rsvp.status === 'APPROVED' && rsvp.invitation) {
        html += `
      <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <h2 style="color: #155724; margin: 0 0 10px 0;">✓ Your invitation is confirmed!</h2>
        <p style="font-size: 24px; font-weight: bold; color: #1a1a2e; margin: 10px 0;">
          Access Code: ${rsvp.invitation.accessCode}
        </p>
        <p style="color: #666;">Use this code at check-in</p>
      </div>
    `;
    }
    else if (rsvp.status === 'PENDING') {
        html += `
      <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #856404; margin: 0;">Your RSVP is pending review. You'll receive another email once confirmed.</p>
      </div>
    `;
    }
    html += `
      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        If you have any questions, please contact the event organizers.
      </p>
    </div>
  `;
    return sendEmail(rsvp.email, `RSVP Confirmation - ${rsvp.event.name}`, html);
}
async function sendInvitationEmail(invitationId) {
    const invitation = await prisma_js_1.default.invitation.findUnique({
        where: { id: invitationId },
        include: {
            event: true,
            rsvp: true,
        },
    });
    if (!invitation || !invitation.rsvp.email) {
        return { success: false, error: 'No email address' };
    }
    if (!invitation.qrCodeData) {
        return { success: false, error: 'QR code not generated' };
    }
    const eventDate = new Date(invitation.event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    // Convert QR code data URL to buffer for email attachment
    const qrCodeBuffer = Buffer.from(invitation.qrCodeData.replace(/^data:image\/png;base64,/, ''), 'base64');
    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a2e; text-align: center;">You're Invited!</h1>
      <h2 style="color: #2d3436; text-align: center;">${invitation.event.name}</h2>
      
      <p>Dear ${invitation.guestName},</p>
      <p>We're delighted to confirm your attendance!</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p><strong>Date:</strong> ${eventDate}</p>
        ${invitation.event.venue ? `<p><strong>Venue:</strong> ${invitation.event.venue}</p>` : ''}
        <p><strong>Guests:</strong> ${invitation.guestCount}</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <img src="cid:qrcode" alt="QR Code" style="width: 200px; height: 200px; display: block; margin: 0 auto;" />
        <p style="font-size: 28px; font-weight: bold; color: #1a1a2e; margin: 15px 0;">
          ${invitation.accessCode}
        </p>
        <p style="color: #666;">Show this QR code or enter the access code at check-in</p>
      </div>
      
      <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">
        We look forward to seeing you!
      </p>
    </div>
  `;
    // Get the default email provider
    const provider = await prisma_js_1.default.emailProvider.findFirst({
        where: { isActive: true, isDefault: true },
    });
    if (!provider) {
        return { success: false, error: 'No email provider configured' };
    }
    // Send email with QR code attachment
    // Use sendEmailWithProvider directly to include attachments
    const result = await sendEmailWithProvider(provider, invitation.rsvp.email, `Your Invitation - ${invitation.event.name}`, html, undefined, // text version
    [{
            filename: 'qrcode.png',
            content: qrCodeBuffer,
            cid: 'qrcode', // Content ID for embedding in HTML
        }]);
    if (result.success) {
        await prisma_js_1.default.invitation.update({
            where: { id: invitationId },
            data: { emailSent: true },
        });
    }
    return result;
}
/**
 * Send invitation via WhatsApp with QR code
 */
async function sendInvitationWhatsApp(invitationId) {
    const invitation = await prisma_js_1.default.invitation.findUnique({
        where: { id: invitationId },
        include: {
            event: true,
            rsvp: true,
        },
    });
    if (!invitation || !invitation.rsvp.phone) {
        return { success: false, error: 'No phone number' };
    }
    const eventDate = new Date(invitation.event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    if (!invitation.qrCodeData) {
        return { success: false, error: 'QR code not generated' };
    }
    // Get the site URL for QR code link
    const { getSiteUrl } = await import('../utils/siteUrl.js');
    const siteUrl = getSiteUrl();
    const checkInUrl = `${siteUrl}/e/${invitation.event.slug}/checkin?code=${invitation.accessCode}`;
    // WhatsApp message with QR code image and access code
    // Convert QR code data URL to buffer for media attachment
    const qrCodeBuffer = Buffer.from(invitation.qrCodeData.replace(/^data:image\/png;base64,/, ''), 'base64');
    const message = `🎉 You're Invited!

${invitation.event.name}

📅 Date: ${eventDate}
${invitation.event.venue ? `📍 Venue: ${invitation.event.venue}\n` : ''}👥 Guests: ${invitation.guestCount}

🔐 Your Access Code: ${invitation.accessCode}

📱 Check-in: ${checkInUrl}

Scan the QR code (attached) or show this code at check-in.

We look forward to seeing you!`;
    // Get WhatsApp provider
    const provider = await prisma_js_1.default.whatsappProvider.findFirst({
        where: { isActive: true, isDefault: true },
    });
    if (!provider) {
        return { success: false, error: 'No WhatsApp provider configured' };
    }
    // Send WhatsApp with QR code image if provider supports media (Twilio)
    let result;
    if (provider.provider === 'twilio' && provider.accountSid && provider.authToken) {
        try {
            const twilio = await import('twilio');
            const client = twilio.default(provider.accountSid, provider.authToken);
            const whatsappTo = invitation.rsvp.phone.startsWith('whatsapp:')
                ? invitation.rsvp.phone
                : `whatsapp:${invitation.rsvp.phone}`;
            const whatsappFrom = provider.phoneNumber?.startsWith('whatsapp:')
                ? provider.phoneNumber
                : `whatsapp:${provider.phoneNumber}`;
            // Send message with media (QR code image)
            // Twilio WhatsApp supports media via mediaUrl with data URI
            const mediaResult = await client.messages.create({
                from: whatsappFrom,
                to: whatsappTo,
                body: message,
                mediaUrl: [`data:image/png;base64,${qrCodeBuffer.toString('base64')}`],
            });
            result = { success: true, messageId: mediaResult.sid };
        }
        catch (error) {
            console.error('[WhatsApp] Failed to send with media, falling back to text:', error.message);
            // Fallback to text-only if media fails
            result = await sendWhatsappWithProvider(provider, invitation.rsvp.phone, message);
        }
    }
    else {
        // For other providers, send text with link to QR code
        result = await sendWhatsappWithProvider(provider, invitation.rsvp.phone, message);
    }
    if (result.success) {
        await prisma_js_1.default.invitation.update({
            where: { id: invitationId },
            data: { whatsappSent: true },
        });
    }
    return result;
}
/**
 * Send invitation via SMS with 6-digit code only
 */
async function sendInvitationSMS(invitationId) {
    const invitation = await prisma_js_1.default.invitation.findUnique({
        where: { id: invitationId },
        include: {
            event: true,
            rsvp: true,
        },
    });
    if (!invitation || !invitation.rsvp.phone) {
        return { success: false, error: 'No phone number' };
    }
    const eventDate = new Date(invitation.event.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    // SMS with 6-digit code only (SMS doesn't support images)
    const message = `You're invited to ${invitation.event.name} on ${eventDate}. Your access code: ${invitation.accessCode}. Show this code at check-in.`;
    const result = await sendSMS(invitation.rsvp.phone, message);
    if (result.success) {
        await prisma_js_1.default.invitation.update({
            where: { id: invitationId },
            data: { smsSent: true },
        });
    }
    return result;
}
/**
 * Send invitation notifications via all enabled channels
 */
async function sendInvitationNotifications(invitationId) {
    const invitation = await prisma_js_1.default.invitation.findUnique({
        where: { id: invitationId },
        include: {
            event: true,
            rsvp: true,
        },
    });
    if (!invitation) {
        return { success: false, error: 'Invitation not found' };
    }
    const settings = await prisma_js_1.default.systemSettings.findUnique({ where: { id: 'default' } });
    const results = {};
    // Send email (always includes QR code and 6-digit code)
    if (invitation.rsvp.email && settings?.emailEnabled) {
        try {
            results.email = await sendInvitationEmail(invitationId);
        }
        catch (err) {
            console.error('[Invitation] Failed to send email:', err.message);
            results.email = { success: false, error: err.message };
        }
    }
    // Send WhatsApp (includes QR code reference and 6-digit code)
    if (invitation.rsvp.phone && settings?.whatsappEnabled) {
        try {
            results.whatsapp = await sendInvitationWhatsApp(invitationId);
        }
        catch (err) {
            console.error('[Invitation] Failed to send WhatsApp:', err.message);
            results.whatsapp = { success: false, error: err.message };
        }
    }
    // Send SMS (6-digit code only)
    if (invitation.rsvp.phone && settings?.smsEnabled) {
        try {
            results.sms = await sendInvitationSMS(invitationId);
        }
        catch (err) {
            console.error('[Invitation] Failed to send SMS:', err.message);
            results.sms = { success: false, error: err.message };
        }
    }
    return results;
}
exports.default = {
    sendEmail,
    sendSMS,
    sendWhatsApp,
    sendWhatsAppRsvpInvite,
    sendEmailWithProvider,
    sendSmsWithProvider,
    sendWhatsappWithProvider,
    checkArkeselBalance,
    sendBroadcast,
    sendRsvpConfirmation,
    sendInvitationEmail,
    sendInvitationWhatsApp,
    sendInvitationSMS,
    sendInvitationNotifications,
};
//# sourceMappingURL=notifications.js.map