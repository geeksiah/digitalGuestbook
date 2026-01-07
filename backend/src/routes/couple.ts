import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateEventPhase } from '../utils/phase';

const router = Router();
const prisma = new PrismaClient();

// Middleware to validate couple access token from URL
const validateCoupleToken = async (req: Request, res: Response, next: Function) => {
  const { token } = req.params;
  
  if (!token) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    const event = await prisma.event.findFirst({
      where: { coupleAccessToken: token },
      select: { id: true, name: true, slug: true },
    });

    if (!event) {
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }

    // Attach event to request
    (req as any).event = event;
    (req as any).eventId = event.id;
    next();
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({ error: 'Failed to validate token' });
  }
};

// GET /api/couple/:token - Get event details
router.get('/:token', validateCoupleToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        slug: true,
        date: true,
        endDate: true,
        venue: true,
        timezone: true,
        phase: true,
        invitationOnly: true,
        _count: {
          select: {
            rsvps: true,
            invitations: true,
            checkIns: true,
            mediaAssets: true,
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Calculate current phase using utility function
    const currentPhase = calculateEventPhase(event);

    res.json({ event: { ...event, currentPhase } });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// GET /api/couple/:token/rsvps - Get RSVPs for event
router.get('/:token/rsvps', validateCoupleToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;
    const { status } = req.query;

    const where: any = { eventId };
    if (status && typeof status === 'string') {
      where.status = status;
    }

    const rsvps = await prisma.rSVP.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: {
        invitation: {
          select: {
            id: true,
            accessCode: true,
            qrCodeData: true,
            isCheckedIn: true,
            checkedInAt: true,
          },
        },
      },
    });

    res.json({ rsvps });
  } catch (error) {
    console.error('Error fetching RSVPs:', error);
    res.status(500).json({ error: 'Failed to fetch RSVPs' });
  }
});

// POST /api/couple/:token/rsvps/:rsvpId/review - Review an RSVP
router.post('/:token/rsvps/:rsvpId/review', validateCoupleToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;
    const { rsvpId } = req.params;
    const { status } = req.body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be APPROVED or REJECTED' });
    }

    // Verify RSVP belongs to this event
    const rsvp = await prisma.rSVP.findFirst({
      where: { id: rsvpId, eventId },
    });

    if (!rsvp) {
      return res.status(404).json({ error: 'RSVP not found' });
    }

    if (rsvp.status !== 'PENDING') {
      return res.status(400).json({ error: 'RSVP has already been reviewed' });
    }

    // Update RSVP status
    const updatedRsvp = await prisma.rSVP.update({
      where: { id: rsvpId },
      data: { 
        status,
        reviewedAt: new Date(),
      },
    });

    // If approved, create invitation with QR code
    if (status === 'APPROVED') {
      const accessCode = generateAccessCode();
      const token = generateToken();

      await prisma.invitation.create({
        data: {
          rsvpId,
          eventId,
          accessCode,
          token,
          qrCodeData: `/api/qr/${token}`, // QR code data/URL
          guestName: rsvp.primaryName,
          guestCount: rsvp.guestCount,
        },
      });

      // Log the approval
      await prisma.auditLog.create({
        data: {
          eventId,
          action: 'RSVP_APPROVED',
          entityType: 'RSVP',
          entityId: rsvpId,
          details: JSON.stringify({ rsvpId, guestName: rsvp.primaryName }),
        },
      });
    } else {
      // Log the rejection
      await prisma.auditLog.create({
        data: {
          eventId,
          action: 'RSVP_REJECTED',
          entityType: 'RSVP',
          entityId: rsvpId,
          details: JSON.stringify({ rsvpId, guestName: rsvp.primaryName }),
        },
      });
    }

    res.json({ rsvp: updatedRsvp, message: `RSVP ${status.toLowerCase()}` });
  } catch (error) {
    console.error('Error reviewing RSVP:', error);
    res.status(500).json({ error: 'Failed to review RSVP' });
  }
});

// GET /api/couple/:token/media - Get media for event
router.get('/:token/media', validateCoupleToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;

    const media = await prisma.mediaAsset.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        guestName: true,
        fileName: true,
        filePath: true,
        duration: true,
        createdAt: true,
        status: true,
      },
    });

    res.json({ media });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// GET /api/couple/:token/checkins - Get check-ins for event
router.get('/:token/checkins', validateCoupleToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;

    const checkIns = await prisma.checkIn.findMany({
      where: { eventId },
      orderBy: { checkedInAt: 'desc' },
      include: {
        invitation: {
          select: {
            accessCode: true,
            rsvp: {
              select: {
                primaryName: true,
                secondaryName: true,
                guestCount: true,
              },
            },
          },
        },
      },
    });

    res.json({ checkIns });
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// GET /api/couple/:token/media/download - Download all media as ZIP
router.get('/:token/media/download', validateCoupleToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;
    const event = (req as any).event;

    const media = await prisma.mediaAsset.findMany({
      where: { eventId },
      select: { filePath: true, fileName: true },
    });

    if (media.length === 0) {
      return res.status(404).json({ error: 'No media to download' });
    }

    // For now, return a simple response - actual ZIP creation requires archiver package
    res.json({ 
      message: 'ZIP download endpoint', 
      mediaCount: media.length,
      note: 'Implement ZIP archiving with archiver package'
    });
    
    // TODO: Implement actual ZIP creation
    // const archiver = require('archiver');
    // const archive = archiver('zip', { zlib: { level: 9 } });
    // res.attachment(`${event.slug}-media.zip`);
    // archive.pipe(res);
    // for (const m of media) {
    //   archive.file(m.filePath, { name: m.fileName });
    // }
    // archive.finalize();
  } catch (error) {
    console.error('Error downloading media:', error);
    res.status(500).json({ error: 'Failed to download media' });
  }
});

// Helper functions
function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default router;
