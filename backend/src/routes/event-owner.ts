import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateEventPhase } from '../utils/phase.js';
import { generateInvitationPass } from '../services/invitation.js';

const router = Router();
const prisma = new PrismaClient();

// Middleware to validate event owner access token from URL
const validateOwnerToken = async (req: Request, res: Response, next: Function) => {
  const { token } = req.params;
  
  if (!token) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    const event = await prisma.event.findFirst({
      where: { ownerAccessToken: token },
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

// GET /api/event-owner/:token - Get event details
router.get('/:token', validateOwnerToken, async (req: Request, res: Response) => {
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
        phaseOverride: true,
        invitationOnly: true,
        reelEnabled: true,
        rsvpMode: true,
        ticketingEnabled: true,
        ownerName: true,
        ownerEmail: true,
        ownerPhone: true,
        organizationName: true,
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

// GET /api/event-owner/:token/rsvps - Get RSVPs for event
router.get('/:token/rsvps', validateOwnerToken, async (req: Request, res: Response) => {
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

// POST /api/event-owner/:token/rsvps/:rsvpId/review - Review an RSVP
router.post('/:token/rsvps/:rsvpId/review', validateOwnerToken, async (req: Request, res: Response) => {
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

    // If approved, create invitation with proper QR code
    if (status === 'APPROVED') {
      // Use the invitation service to generate proper QR codes
      const invitation = await generateInvitationPass(rsvpId);

      // Log the approval
      await prisma.auditLog.create({
        data: {
          eventId,
          action: 'RSVP_APPROVED',
          entityType: 'RSVP',
          entityId: rsvpId,
          details: JSON.stringify({ 
            rsvpId, 
            guestName: rsvp.primaryName,
            invitationId: invitation.id,
            accessCode: invitation.accessCode,
          }),
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

// GET /api/event-owner/:token/media - Get media for event
router.get('/:token/media', validateOwnerToken, async (req: Request, res: Response) => {
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

// GET /api/event-owner/:token/checkins - Get check-ins for event
router.get('/:token/checkins', validateOwnerToken, async (req: Request, res: Response) => {
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

// GET /api/event-owner/:token/media/download - Download all media as ZIP
router.get('/:token/media/download', validateOwnerToken, async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Error downloading media:', error);
    res.status(500).json({ error: 'Failed to download media' });
  }
});

// POST /api/event-owner/:token/generate-reel - Generate video reel
router.post('/:token/generate-reel', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;
    const { maxDuration = 300 } = req.body;

    // Check if reel is enabled for this event
    const eventDetails = await prisma.event.findUnique({
      where: { id: eventId },
      select: { reelEnabled: true, slug: true, name: true, date: true, venue: true, primaryColor: true, secondaryColor: true },
    });

    if (!eventDetails?.reelEnabled) {
      return res.status(400).json({ error: 'Reel generation is not enabled for this event' });
    }

    // Check for videos
    const videoCount = await prisma.mediaAsset.count({
      where: { eventId, type: 'VIDEO' },
    });

    if (videoCount === 0) {
      return res.status(400).json({ error: 'No videos available for reel generation' });
    }

    // Import and use the reel generator
    const { generateReel, checkFfmpegAvailable } = await import('../services/reelGenerator.js');

    // Check FFmpeg availability
    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      return res.status(503).json({ error: 'FFmpeg is not installed on the server. Reel generation is unavailable.' });
    }

    // Start reel generation with event details for covers
    const jobId = await generateReel({
      eventId,
      outputName: `${eventDetails.slug}-reel`,
      maxDuration,
      eventDetails: {
        name: eventDetails.name,
        date: eventDetails.date,
        venue: eventDetails.venue,
        primaryColor: eventDetails.primaryColor,
        secondaryColor: eventDetails.secondaryColor,
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        eventId,
        action: 'REEL_GENERATION_STARTED',
        entityType: 'MEDIA',
        entityId: jobId,
        details: JSON.stringify({ videoCount, maxDuration }),
      },
    });

    res.json({ 
      message: 'Reel generation started', 
      jobId,
      videoCount,
    });
  } catch (error) {
    console.error('Error starting reel generation:', error);
    res.status(500).json({ error: 'Failed to start reel generation' });
  }
});

// GET /api/event-owner/:token/reel/:jobId/status - Get reel generation status
router.get('/:token/reel/:jobId/status', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const { getReelJobStatus } = await import('../services/reelGenerator.js');
    const status = await getReelJobStatus(jobId);

    if (!status) {
      return res.status(404).json({ error: 'Reel job not found' });
    }

    res.json({ status });
  } catch (error) {
    console.error('Error fetching reel status:', error);
    res.status(500).json({ error: 'Failed to fetch reel status' });
  }
});

// GET /api/event-owner/:token/reels - Get all reels for the event
router.get('/:token/reels', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;

    const reels = await prisma.reelJob.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        progress: true,
        outputPath: true,
        outputSize: true,
        duration: true,
        videoCount: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });

    res.json({ reels });
  } catch (error) {
    console.error('Error fetching reels:', error);
    res.status(500).json({ error: 'Failed to fetch reels' });
  }
});

// ============================================
// SALES & TRANSACTIONS
// ============================================

// GET /api/event-owner/:token/sales - Get sales summary
router.get('/:token/sales', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;

    // Get all transactions
    const transactions = await prisma.transaction.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary
    const summary = {
      totalGross: 0,
      totalPlatformFees: 0,
      totalProcessingFees: 0,
      totalNet: 0,
      totalRefunds: 0,
      totalPayouts: 0,
      availableBalance: 0,
      transactionCount: transactions.length,
      ticketsSold: 0,
    };

    for (const tx of transactions) {
      switch (tx.type) {
        case 'ticket_sale':
          summary.totalGross += tx.grossAmount;
          summary.totalPlatformFees += tx.platformFee;
          summary.totalProcessingFees += tx.processingFee;
          summary.totalNet += tx.netAmount;
          summary.ticketsSold += tx.ticketQuantity;
          break;
        case 'refund':
          summary.totalRefunds += Math.abs(tx.netAmount);
          break;
        case 'payout':
          summary.totalPayouts += Math.abs(tx.netAmount);
          break;
      }
    }

    summary.availableBalance = summary.totalNet - summary.totalRefunds - summary.totalPayouts;

    res.json({ summary, transactions });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET /api/event-owner/:token/sales/by-ticket - Get sales grouped by ticket type
router.get('/:token/sales/by-ticket', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;

    // Get ticket types with sales data
    const ticketTypes = await prisma.ticketType.findMany({
      where: { eventId },
      select: {
        id: true,
        name: true,
        price: true,
        quantityTotal: true,
        isActive: true,
      },
    });

    // Get transaction aggregates per ticket type
    const salesByTicket = await Promise.all(
      ticketTypes.map(async (ticket) => {
        const transactions = await prisma.transaction.findMany({
          where: {
            eventId,
            ticketTypeName: ticket.name,
            type: 'ticket_sale',
            status: 'completed',
          },
        });

        const sold = transactions.reduce((sum, tx) => sum + tx.ticketQuantity, 0);
        const revenue = transactions.reduce((sum, tx) => sum + tx.netAmount, 0);

        return {
          ...ticket,
          sold,
          remaining: ticket.quantityTotal > 0 ? ticket.quantityTotal - sold : null,
          revenue,
          percentSold: ticket.quantityTotal > 0 ? Math.round((sold / ticket.quantityTotal) * 100) : 0,
        };
      })
    );

    res.json({ salesByTicket });
  } catch (error) {
    console.error('Error fetching sales by ticket:', error);
    res.status(500).json({ error: 'Failed to fetch sales by ticket' });
  }
});

// ============================================
// PAYOUT WALLET
// ============================================

// GET /api/event-owner/:token/wallet - Get payout wallet configuration
router.get('/:token/wallet', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;

    let wallet = await prisma.payoutWallet.findUnique({
      where: { eventId },
    });

    // Return null if not configured
    if (!wallet) {
      return res.json({ wallet: null, configured: false });
    }

    // Mask sensitive fields
    const maskedWallet = {
      ...wallet,
      accountNumber: wallet.accountNumber ? `****${wallet.accountNumber.slice(-4)}` : null,
      routingNumber: wallet.routingNumber ? `****${wallet.routingNumber.slice(-4)}` : null,
      mobileNumber: wallet.mobileNumber ? `****${wallet.mobileNumber.slice(-4)}` : null,
    };

    res.json({ wallet: maskedWallet, configured: true });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// POST /api/event-owner/:token/wallet - Create or update payout wallet
router.post('/:token/wallet', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;
    const {
      bankName,
      accountName,
      accountNumber,
      routingNumber,
      swiftCode,
      mobileProvider,
      mobileNumber,
      paypalEmail,
      stripeAccountId,
      paystackSubaccount,
      preferredMethod,
      currency,
      autoPayoutEnabled,
      autoPayoutThreshold,
    } = req.body;

    const wallet = await prisma.payoutWallet.upsert({
      where: { eventId },
      update: {
        bankName,
        accountName,
        accountNumber,
        routingNumber,
        swiftCode,
        mobileProvider,
        mobileNumber,
        paypalEmail,
        stripeAccountId,
        paystackSubaccount,
        preferredMethod: preferredMethod || 'bank',
        currency: currency || 'USD',
        autoPayoutEnabled: autoPayoutEnabled || false,
        autoPayoutThreshold: autoPayoutThreshold || 100,
      },
      create: {
        eventId,
        bankName,
        accountName,
        accountNumber,
        routingNumber,
        swiftCode,
        mobileProvider,
        mobileNumber,
        paypalEmail,
        stripeAccountId,
        paystackSubaccount,
        preferredMethod: preferredMethod || 'bank',
        currency: currency || 'USD',
        autoPayoutEnabled: autoPayoutEnabled || false,
        autoPayoutThreshold: autoPayoutThreshold || 100,
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        eventId,
        action: 'PAYOUT_WALLET_UPDATED',
        entityType: 'WALLET',
        entityId: wallet.id,
        details: JSON.stringify({ preferredMethod, currency }),
      },
    });

    res.json({ wallet, message: 'Payout wallet saved successfully' });
  } catch (error) {
    console.error('Error saving wallet:', error);
    res.status(500).json({ error: 'Failed to save wallet' });
  }
});

// ============================================
// PAYOUT REQUESTS
// ============================================

// GET /api/event-owner/:token/payouts - Get payout requests
router.get('/:token/payouts', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;

    const payouts = await prisma.payoutRequest.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ payouts });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
});

// POST /api/event-owner/:token/payouts/request - Request a payout
router.post('/:token/payouts/request', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;
    const { amount, notes } = req.body;

    // Get wallet to check if configured
    const wallet = await prisma.payoutWallet.findUnique({
      where: { eventId },
    });

    if (!wallet) {
      return res.status(400).json({ error: 'Please configure your payout wallet first' });
    }

    // Calculate available balance
    const transactions = await prisma.transaction.findMany({
      where: { eventId },
    });

    let availableBalance = 0;
    for (const tx of transactions) {
      if (tx.type === 'ticket_sale' && tx.status === 'completed') {
        availableBalance += tx.netAmount;
      } else if (tx.type === 'refund') {
        availableBalance -= Math.abs(tx.netAmount);
      } else if (tx.type === 'payout') {
        availableBalance -= Math.abs(tx.netAmount);
      }
    }

    // Check pending payout requests
    const pendingPayouts = await prisma.payoutRequest.aggregate({
      where: { eventId, status: { in: ['pending', 'processing'] } },
      _sum: { requestedAmount: true },
    });
    
    const pendingAmount = pendingPayouts._sum.requestedAmount || 0;
    const effectiveBalance = availableBalance - pendingAmount;

    if (amount > effectiveBalance) {
      return res.status(400).json({ 
        error: 'Insufficient balance', 
        availableBalance: effectiveBalance,
        requestedAmount: amount,
      });
    }

    if (amount < 10) {
      return res.status(400).json({ error: 'Minimum payout amount is $10' });
    }

    // Create payout request
    const payout = await prisma.payoutRequest.create({
      data: {
        eventId,
        requestedAmount: amount,
        currency: wallet.currency,
        payoutMethod: wallet.preferredMethod,
        notes,
        status: 'pending',
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        eventId,
        action: 'PAYOUT_REQUESTED',
        entityType: 'PAYOUT',
        entityId: payout.id,
        details: JSON.stringify({ amount, currency: wallet.currency, method: wallet.preferredMethod }),
      },
    });

    res.json({ 
      payout, 
      message: 'Payout request submitted successfully',
      note: 'Payouts are typically processed within 3-5 business days',
    });
  } catch (error) {
    console.error('Error requesting payout:', error);
    res.status(500).json({ error: 'Failed to request payout' });
  }
});

// GET /api/event-owner/:token/payouts/:payoutId - Get payout details
router.get('/:token/payouts/:payoutId', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;
    const { payoutId } = req.params;

    const payout = await prisma.payoutRequest.findFirst({
      where: { id: payoutId, eventId },
    });

    if (!payout) {
      return res.status(404).json({ error: 'Payout request not found' });
    }

    res.json({ payout });
  } catch (error) {
    console.error('Error fetching payout:', error);
    res.status(500).json({ error: 'Failed to fetch payout' });
  }
});

// DELETE /api/event-owner/:token/payouts/:payoutId - Cancel a pending payout request
router.delete('/:token/payouts/:payoutId', validateOwnerToken, async (req: Request, res: Response) => {
  try {
    const eventId = (req as any).eventId;
    const { payoutId } = req.params;

    const payout = await prisma.payoutRequest.findFirst({
      where: { id: payoutId, eventId },
    });

    if (!payout) {
      return res.status(404).json({ error: 'Payout request not found' });
    }

    if (payout.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending payout requests can be cancelled' });
    }

    await prisma.payoutRequest.update({
      where: { id: payoutId },
      data: { status: 'rejected', rejectionReason: 'Cancelled by event owner' },
    });

    res.json({ message: 'Payout request cancelled' });
  } catch (error) {
    console.error('Error cancelling payout:', error);
    res.status(500).json({ error: 'Failed to cancel payout' });
  }
});

export default router;
