"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvitationPass = generateInvitationPass;
exports.generateInvitationPDF = generateInvitationPDF;
exports.getInvitationPDF = getInvitationPDF;
const qrcode_1 = __importDefault(require("qrcode"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
// Ensure generated directory exists
const generatedDir = path_1.default.join(process.cwd(), 'generated/invitations');
if (!fs_1.default.existsSync(generatedDir)) {
    fs_1.default.mkdirSync(generatedDir, { recursive: true });
}
/**
 * Generate a unique 6-digit access code
 */
function generateAccessCode() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return code;
}
/**
 * Generate QR code as data URL
 */
async function generateQRCode(data) {
    return await qrcode_1.default.toDataURL(data, {
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
async function generateInvitationPass(rsvpId) {
    const rsvp = await prisma_js_1.default.rSVP.findUnique({
        where: { id: rsvpId },
        include: { event: true },
    });
    if (!rsvp) {
        throw new Error('RSVP not found');
    }
    // Check if invitation already exists
    const existing = await prisma_js_1.default.invitation.findUnique({
        where: { rsvpId },
    });
    if (existing) {
        return existing;
    }
    // Generate unique access code (ensure uniqueness)
    let accessCode = generateAccessCode();
    let attempts = 0;
    while (attempts < 10) {
        const codeExists = await prisma_js_1.default.invitation.findUnique({
            where: { accessCode },
        });
        if (!codeExists)
            break;
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
    const invitation = await prisma_js_1.default.invitation.create({
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
async function generateInvitationPDF(invitationId) {
    const invitation = await prisma_js_1.default.invitation.findUnique({
        where: { id: invitationId },
        include: { event: true },
    });
    if (!invitation) {
        throw new Error('Invitation not found');
    }
    const pdfPath = path_1.default.join(generatedDir, `${invitation.id}.pdf`);
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({
            size: 'A5',
            layout: 'landscape',
            margin: 40,
        });
        const stream = fs_1.default.createWriteStream(pdfPath);
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
        const qrBuffer = Buffer.from(invitation.qrCodeData.replace(/^data:image\/png;base64,/, ''), 'base64');
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
            await prisma_js_1.default.invitation.update({
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
async function getInvitationPDF(invitationId) {
    const invitation = await prisma_js_1.default.invitation.findUnique({
        where: { id: invitationId },
    });
    if (!invitation) {
        throw new Error('Invitation not found');
    }
    if (invitation.pdfGenerated && invitation.pdfPath) {
        const fullPath = path_1.default.join(process.cwd(), invitation.pdfPath);
        if (fs_1.default.existsSync(fullPath)) {
            return fullPath;
        }
    }
    return await generateInvitationPDF(invitationId);
}
//# sourceMappingURL=invitation.js.map