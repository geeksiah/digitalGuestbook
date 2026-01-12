import nodemailer from 'nodemailer';
import prisma from '../utils/prisma.js';
import type { EmailProvider, SmsProvider, WhatsappProvider } from '@prisma/client';

// ============================================
// PROVIDER-BASED EMAIL
// ============================================

export async function sendEmailWithProvider(
  provider: EmailProvider,
  to: string,
  subject: string,
  html: string,
  text?: string
) {
  console.log('[Email] sendEmailWithProvider called - Provider:', provider.name, 'To:', to, 'Subject:', subject);
  try {
    if (provider.provider === 'smtp') {
      const port = provider.smtpPort || 587;
      // Port 465 uses direct SSL/TLS (secure: true)
      // Port 587 uses STARTTLS (secure: false, requiresTLS: true)
      // Port 25 is usually plain text
      const isSecurePort = port === 465;
      const useSecure = provider.smtpSecure !== undefined ? provider.smtpSecure : isSecurePort;
      
      const transporter = nodemailer.createTransport({
        host: provider.smtpHost!,
        port: port,
        secure: useSecure, // true for 465, false for other ports
        requireTLS: !useSecure && port === 587, // Use STARTTLS for port 587
        auth: {
          user: provider.smtpUser!,
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
        requireTLS: !useSecure && port === 587,
        user: provider.smtpUser,
        hasPassword: !!provider.smtpPass,
      });
      
      console.log('[Email] Attempting to send mail...');
      const sendPromise = transporter.sendMail({
        from: provider.fromName 
          ? `"${provider.fromName}" <${provider.fromEmail || provider.smtpUser}>`
          : provider.fromEmail || provider.smtpUser!,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000);
      });
      
      const result = await Promise.race([sendPromise, timeoutPromise]) as any;
      
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
      } else {
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
        const result = await response.json() as { id?: string };
        console.log('[Email] Sent via Mailgun to:', to);
        return { success: true, messageId: result.id };
      } else {
        const error = await response.text();
        throw new Error(`Mailgun error: ${error}`);
      }
    }
    
    return { success: false, error: `Unsupported email provider: ${provider.provider}` };
  } catch (error: any) {
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

export async function sendSmsWithProvider(
  provider: SmsProvider,
  to: string,
  message: string
): Promise<{ success: boolean; sid?: string; messageId?: string; balance?: number; error?: string }> {
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
        const result = await response.json() as { message_id?: string };
        console.log('[SMS] Sent via Termii to:', to);
        return { success: true, messageId: result.message_id };
      } else {
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
        const result = await response.json() as { SMSMessageData?: { Recipients?: { messageId?: string }[] } };
        console.log('[SMS] Sent via Africa\'s Talking to:', to);
        return { success: true, messageId: result.SMSMessageData?.Recipients?.[0]?.messageId };
      } else {
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
        const result = await response.json() as { 
          status?: string;
          message?: string;
          data?: { 
            status?: string;
            message?: string;
            message_id?: string;
            balance?: number;
          };
        };
        
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
        } else {
          // Handle error response from Arkesel
          const errorMsg = result.message || result.data?.message || JSON.stringify(result);
          console.error('[SMS] Arkesel failed - status:', result.status, 'data.status:', result.data?.status, 'message:', result.message);
          throw new Error(`Arkesel SMS failed: ${errorMsg}`);
        }
      } else {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        throw new Error(`Arkesel API error (${response.status}): ${errorData.message || errorText}`);
      }
    }
    
    return { success: false, error: `Unsupported SMS provider: ${provider.provider}` };
  } catch (error: any) {
    console.error('[SMS] Failed to send via', provider.name, ':', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check Arkesel SMS balance
 */
export async function checkArkeselBalance(apiKey: string): Promise<{ success: boolean; balance?: number; error?: string }> {
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
      const result = await response.json() as { 
        status?: string;
        balance?: number | string;
        data?: { balance?: number | string };
        message?: string;
      };
      
      // Arkesel returns balance in different formats:
      // Format 1: { status: "success", balance: 95.50 }
      // Format 2: { status: "success", data: { balance: 95.50 } }
      // Format 3: { balance: 95.50 }
      const balanceValue = result.balance ?? result.data?.balance;
      const balance = typeof balanceValue === 'string' ? parseFloat(balanceValue) : balanceValue;
      
      if (balance !== undefined && !isNaN(balance)) {
        console.log('[SMS] Arkesel balance checked:', balance);
        return { success: true, balance };
      } else {
        const errorMsg = result.message || 'Balance not found in response';
        return { success: false, error: errorMsg };
      }
    } else {
      const error = await response.text();
      let errorData: any;
      try {
        errorData = JSON.parse(error);
      } catch {
        errorData = { message: error };
      }
      throw new Error(`Arkesel balance check error (${response.status}): ${errorData.message || error}`);
    }
  } catch (error: any) {
    console.error('[SMS] Failed to check Arkesel balance:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// PROVIDER-BASED WHATSAPP
// ============================================

export async function sendWhatsappWithProvider(
  provider: WhatsappProvider,
  to: string,
  message: string
) {
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
        const result = await response.json() as { messages?: { id?: string }[] };
        console.log('[WhatsApp] Sent via Meta to:', to);
        return { success: true, messageId: result.messages?.[0]?.id };
      } else {
        const error = await response.json();
        throw new Error(`Meta WhatsApp error: ${JSON.stringify(error)}`);
      }
    }
    
    return { success: false, error: `Unsupported WhatsApp provider: ${provider.provider}` };
  } catch (error: any) {
    console.error('[WhatsApp] Failed to send via', provider.name, ':', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// DEFAULT PROVIDER FUNCTIONS (use default active provider)
// ============================================

async function getDefaultEmailProvider(): Promise<EmailProvider | null> {
  return prisma.emailProvider.findFirst({
    where: { isDefault: true, isActive: true },
  });
}

async function getDefaultSmsProvider(): Promise<SmsProvider | null> {
  return prisma.smsProvider.findFirst({
    where: { isDefault: true, isActive: true },
  });
}

async function getDefaultWhatsappProvider(): Promise<WhatsappProvider | null> {
  return prisma.whatsappProvider.findFirst({
    where: { isDefault: true, isActive: true },
  });
}

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  console.log('[Email] Attempting to send email to:', to, 'Subject:', subject);
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
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
  } else {
    console.error('[Email] Failed to send email to:', to, 'Error:', result.error);
  }
  return result;
}

export async function sendSMS(to: string, message: string) {
  console.log('[SMS] Attempting to send SMS to:', to);
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
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
  } else {
    console.error('[SMS] Failed to send SMS to:', to, 'Error:', result.error);
  }
  return result;
}

export async function sendWhatsApp(to: string, message: string) {
  console.log('[WhatsApp] Attempting to send WhatsApp message to:', to);
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
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
  } else {
    console.error('[WhatsApp] Failed to send WhatsApp message to:', to, 'Error:', result.error);
  }
  return result;
}

// ============================================
// BROADCAST & NOTIFICATION FUNCTIONS
// ============================================

export async function sendBroadcast(
  eventId: string,
  broadcastId: string,
  message: string,
  subject: string | null,
  channels: string[],
  audience: 'ALL_RSVPS' | 'APPROVED_ONLY'
) {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
  
  const where: any = { eventId };
  if (audience === 'APPROVED_ONLY') {
    where.status = 'APPROVED';
  }
  
  const rsvps = await prisma.rSVP.findMany({
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
      const result = await sendEmail(
        rsvp.email,
        personalizedSubject,
        `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Dear ${rsvp.primaryName},</p>
          <div style="white-space: pre-line;">${personalizedMessage}</div>
        </div>`
      );
      if (result.success) delivered++;
      else failed++;
    }
    
    if (channels.includes('SMS') && rsvp.phone && settings?.smsEnabled) {
      const result = await sendSMS(rsvp.phone, personalizedMessage);
      if (result.success) delivered++;
      else failed++;
    }
    
    if (channels.includes('WHATSAPP') && rsvp.phone && settings?.whatsappEnabled) {
      const result = await sendWhatsApp(rsvp.phone, personalizedMessage);
      if (result.success) delivered++;
      else failed++;
    }
  }
  
  await prisma.broadcast.update({
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

export async function sendRsvpConfirmation(rsvpId: string) {
  const rsvp = await prisma.rSVP.findUnique({
    where: { id: rsvpId },
    include: { 
      event: true,
      invitation: true,
    },
  });
  
  if (!rsvp || !rsvp.email) return { success: false, error: 'No email address' };
  
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
  } else if (rsvp.status === 'PENDING') {
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

export async function sendInvitationEmail(invitationId: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { 
      event: true,
      rsvp: true,
    },
  });
  
  if (!invitation || !invitation.rsvp.email) {
    return { success: false, error: 'No email address' };
  }
  
  const eventDate = new Date(invitation.event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
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
        <img src="${invitation.qrCodeData}" alt="QR Code" style="width: 200px; height: 200px;" />
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
  
  const result = await sendEmail(
    invitation.rsvp.email,
    `Your Invitation - ${invitation.event.name}`,
    html
  );
  
  if (result.success) {
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { emailSent: true },
    });
  }
  
  return result;
}

export default {
  sendEmail,
  sendSMS,
  sendWhatsApp,
  sendEmailWithProvider,
  sendSmsWithProvider,
  sendWhatsappWithProvider,
  checkArkeselBalance,
  sendBroadcast,
  sendRsvpConfirmation,
  sendInvitationEmail,
};
