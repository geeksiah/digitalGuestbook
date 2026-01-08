import nodemailer from 'nodemailer';
import prisma from '../utils/prisma.js';

// Get system settings
async function getSettings() {
  let settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
  });
  
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: { id: 'default' },
    });
  }
  
  return settings;
}

// Email Service
export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const settings = await getSettings();
  
  if (!settings.emailEnabled || !settings.smtpHost || !settings.smtpUser) {
    console.log('[Email] Service not configured, skipping email to:', to);
    return { success: false, error: 'Email not configured' };
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass || '',
      },
    });
    
    const result = await transporter.sendMail({
      from: settings.smtpFromName 
        ? `"${settings.smtpFromName}" <${settings.smtpFrom || settings.smtpUser}>`
        : settings.smtpFrom || settings.smtpUser,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    
    console.log('[Email] Sent to:', to, 'Message ID:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error('[Email] Failed to send:', error.message);
    return { success: false, error: error.message };
  }
}

// SMS Service (Twilio)
export async function sendSMS(to: string, message: string) {
  const settings = await getSettings();
  
  if (!settings.smsEnabled || !settings.twilioAccountSid || !settings.twilioAuthToken) {
    console.log('[SMS] Service not configured, skipping SMS to:', to);
    return { success: false, error: 'SMS not configured' };
  }
  
  try {
    // Dynamic import of Twilio
    const twilio = await import('twilio');
    const client = twilio.default(settings.twilioAccountSid, settings.twilioAuthToken);
    
    const result = await client.messages.create({
      body: message,
      from: settings.twilioPhoneNumber,
      to,
    });
    
    console.log('[SMS] Sent to:', to, 'SID:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error: any) {
    console.error('[SMS] Failed to send:', error.message);
    return { success: false, error: error.message };
  }
}

// WhatsApp Service (via Twilio)
export async function sendWhatsApp(to: string, message: string) {
  const settings = await getSettings();
  
  if (!settings.whatsappEnabled || !settings.twilioAccountSid || !settings.twilioAuthToken) {
    console.log('[WhatsApp] Service not configured, skipping message to:', to);
    return { success: false, error: 'WhatsApp not configured' };
  }
  
  try {
    const twilio = await import('twilio');
    const client = twilio.default(settings.twilioAccountSid, settings.twilioAuthToken);
    
    // Format phone number for WhatsApp
    const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const whatsappFrom = settings.twilioPhoneNumber?.startsWith('whatsapp:') 
      ? settings.twilioPhoneNumber 
      : `whatsapp:${settings.twilioPhoneNumber}`;
    
    const result = await client.messages.create({
      body: message,
      from: whatsappFrom,
      to: whatsappTo,
    });
    
    console.log('[WhatsApp] Sent to:', to, 'SID:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error: any) {
    console.error('[WhatsApp] Failed to send:', error.message);
    return { success: false, error: error.message };
  }
}

// Broadcast message to multiple recipients
export async function sendBroadcast(
  eventId: string,
  broadcastId: string,
  message: string,
  subject: string | null,
  channels: string[],
  audience: 'ALL_RSVPS' | 'APPROVED_ONLY'
) {
  const settings = await getSettings();
  
  // Get recipients
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
    
    // Send via each enabled channel
    if (channels.includes('EMAIL') && rsvp.email && settings.emailEnabled) {
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
    
    if (channels.includes('SMS') && rsvp.phone && settings.smsEnabled) {
      const result = await sendSMS(rsvp.phone, personalizedMessage);
      if (result.success) delivered++;
      else failed++;
    }
    
    if (channels.includes('WHATSAPP') && rsvp.phone && settings.whatsappEnabled) {
      const result = await sendWhatsApp(rsvp.phone, personalizedMessage);
      if (result.success) delivered++;
      else failed++;
    }
  }
  
  // Update broadcast status
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

// Send RSVP confirmation email
export async function sendRsvpConfirmation(rsvpId: string) {
  const rsvp = await prisma.rSVP.findUnique({
    where: { id: rsvpId },
    include: { 
      event: true,
      invitation: true,
    },
  });
  
  if (!rsvp || !rsvp.email) return { success: false, error: 'No email address' };
  
  const settings = await getSettings();
  if (!settings.emailEnabled) return { success: false, error: 'Email not enabled' };
  
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

// Send invitation with QR code
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
  
  const settings = await getSettings();
  if (!settings.emailEnabled) return { success: false, error: 'Email not enabled' };
  
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
  sendBroadcast,
  sendRsvpConfirmation,
  sendInvitationEmail,
};

