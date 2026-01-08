import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import prisma from '../utils/prisma.js';

// Ensure generated directory exists
const generatedDir = path.join(__dirname, '../../generated/invitations');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

/**
 * Generate a unique 6-digit access code
 */
function generateAccessCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

/**
 * Generate QR code as data URL
 */
async function generateQRCode(data: string): Promise<string> {
  return await QRCode.toDataURL(data, {
    width: 300,
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  });
}

/**
 * Generate invitation pass for an approved RSVP
 * Per SRS Section 6
 */
export async function generateInvitationPass(rsvpId: string) {
  const rsvp = await prisma.rSVP.findUnique({
    where: { id: rsvpId },
    include: { event: true },
  });

  if (!rsvp) {
    throw new Error('RSVP not found');
  }

  // Check if invitation already exists
  const existing = await prisma.invitation.findUnique({
    where: { rsvpId },
  });

  if (existing) {
    return existing;
  }

  // Generate unique access code (ensure uniqueness)
  let accessCode = generateAccessCode();
  let attempts = 0;
  while (attempts < 10) {
    const codeExists = await prisma.invitation.findUnique({
      where: { accessCode },
    });
    if (!codeExists) break;
    accessCode = generateAccessCode();
    attempts++;
  }

  // Generate QR code data URL
  const qrData = JSON.stringify({
    type: 'event-invitation',
    eventId: rsvp.eventId,
    token: rsvpId,
    code: accessCode,
  });
  const qrCodeData = await generateQRCode(qrData);

  // Create invitation record
  const invitation = await prisma.invitation.create({
    data: {
      eventId: rsvp.eventId,
      rsvpId: rsvp.id,
      qrCodeData,
      accessCode,
      guestName: rsvp.secondaryName
        ? `${rsvp.primaryName} & ${rsvp.secondaryName}`
        : rsvp.primaryName,
      guestCount: rsvp.guestCount,
    },
  });

  return invitation;
}

/**
 * Generate PDF invitation card
 * Per SRS Section 6.2
 */
export async function generateInvitationPDF(invitationId: string): Promise<string> {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { event: true },
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  const pdfPath = path.join(generatedDir, `${invitation.id}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A5',
      layout: 'landscape',
      margin: 40,
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#fefefe');

    // Border
    doc
      .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
      .stroke('#d4af37');

    // Header
    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor('#1a1a2e')
      .text('You Are Invited', 40, 50, { align: 'center' });

    // Event Name
    doc
      .fontSize(32)
      .fillColor('#2d3436')
      .text(invitation.event.name, 40, 90, { align: 'center' });

    // Date
    const eventDate = new Date(invitation.event.date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor('#636e72')
      .text(formattedDate, 40, 140, { align: 'center' });

    // Venue
    if (invitation.event.venue) {
      doc
        .fontSize(12)
        .text(invitation.event.venue, 40, 160, { align: 'center' });
    }

    // Guest Name
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#1a1a2e')
      .text(invitation.guestName, 40, 200, { align: 'center' });

    if (invitation.guestCount > 1) {
      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor('#636e72')
        .text(`Party of ${invitation.guestCount}`, 40, 225, { align: 'center' });
    }

    // QR Code
    const qrBuffer = Buffer.from(
      invitation.qrCodeData.replace(/^data:image\/png;base64,/, ''),
      'base64'
    );
    doc.image(qrBuffer, doc.page.width / 2 - 60, 250, { width: 120, height: 120 });

    // Access Code
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#1a1a2e')
      .text(`Access Code: ${invitation.accessCode}`, 40, 385, { align: 'center' });

    // Footer
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#b2bec3')
      .text('Present this invitation at check-in', 40, 415, { align: 'center' });

    doc.end();

    stream.on('finish', async () => {
      await prisma.invitation.update({
        where: { id: invitationId },
        data: {
          pdfGenerated: true,
          pdfPath: `/generated/invitations/${invitation.id}.pdf`,
        },
      });
      resolve(pdfPath);
    });

    stream.on('error', reject);
  });
}

/**
 * Get or generate invitation PDF
 */
export async function getInvitationPDF(invitationId: string): Promise<string> {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.pdfGenerated && invitation.pdfPath) {
    const fullPath = path.join(__dirname, '../..', invitation.pdfPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return await generateInvitationPDF(invitationId);
}
