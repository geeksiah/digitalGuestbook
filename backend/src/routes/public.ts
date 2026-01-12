import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { calculateEventPhase, getPhaseCapabilities } from '../utils/phase.js';

const router = Router();

/**
 * GET /api/public/event/:slug
 * Get public event information
 */
router.get('/event/:slug', asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: {
      invitationTemplate: true,
      rsvpTemplate: true,
      guestbookTemplate: true,
      thankYouTemplate: true,
    },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.isArchived) {
    throw new AppError('This event is no longer available', 410);
  }

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);

  res.json({
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      description: event.description,
      date: event.date,
      endDate: event.endDate,
      timezone: event.timezone,
      venue: event.venue,
      phase: currentPhase,
      capabilities,
      services: {
        invitation: event.invitationEnabled,
        rsvp: event.rsvpEnabled,
        guestbook: event.guestbookEnabled,
        checkIn: event.checkInEnabled,
      },
      invitationOnly: event.invitationOnly,
    },
    urls: {
      rsvp: event.rsvpEnabled ? `/e/${event.slug}/rsvp` : null,
      guestbook: event.guestbookEnabled ? `/e/${event.slug}/guestbook` : null,
      booth: event.guestbookEnabled ? `/e/${event.slug}/booth` : null,
      thankYou: `/e/${event.slug}/thanks`,
    },
  });
}));

/**
 * GET /api/public/event/:slug/invitation
 * Get rendered invitation page
 */
router.get('/event/:slug/invitation', asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: { invitationTemplate: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (!event.invitationEnabled) {
    throw new AppError('Invitation page not available', 404);
  }

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);

  // If no custom template, return data for frontend to render
  if (!event.invitationTemplate) {
    return res.json({
      template: null,
      data: {
        event: {
          name: event.name,
          description: event.description,
          date: event.date,
          venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        urls: {
          rsvp: event.rsvpEnabled && capabilities.canSubmitRsvp
            ? `/e/${event.slug}/rsvp`
            : null,
          guestbook: event.guestbookEnabled && capabilities.canAccessGuestbook
            ? `/e/${event.slug}/guestbook`
            : null,
        },
      },
    });
  }

  // Render template with injected data
  const templateData = {
    event: {
      name: event.name,
      description: event.description,
      date: event.date,
      formattedDate: new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      venue: event.venue,
    },
    phase: currentPhase,
    capabilities,
    urls: {
      rsvp: `/e/${event.slug}/rsvp`,
      guestbook: `/e/${event.slug}/guestbook`,
      booth: `/e/${event.slug}/booth`,
      thankYou: `/e/${event.slug}/thanks`,
    },
  };

  // Replace template variables
  let html = event.invitationTemplate.htmlContent;
  
  // Simple variable replacement: {{variable.path}}
  const replaceVariables = (template: string, data: any, prefix = ''): string => {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const fullPath = prefix ? `${prefix}.${path}` : path;
      const keys = path.split('.');
      let value: any = data;
      
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return match; // Keep original if not found
        }
      }
      
      return String(value ?? '');
    });
  };

  html = replaceVariables(html, templateData);

  // Inject CSS and JS
  if (event.invitationTemplate.cssContent) {
    html = html.replace('</head>', `<style>${event.invitationTemplate.cssContent}</style></head>`);
  }
  if (event.invitationTemplate.jsContent) {
    html = html.replace('</body>', `<script>${event.invitationTemplate.jsContent}</script></body>`);
  }

  res.send(html);
}));

/**
 * GET /api/public/event/:slug/thank-you
 * Get thank-you page
 */
router.get('/event/:slug/thank-you', asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: { thankYouTemplate: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const currentPhase = calculateEventPhase(event);

  // Thank-you page is only for POST_EVENT phase
  if (currentPhase !== 'POST_EVENT') {
    return res.redirect(`/e/${event.slug}`);
  }

  if (!event.thankYouTemplate) {
    return res.json({
      template: null,
      data: {
        event: {
          name: event.name,
          date: event.date,
        },
        message: 'Thank you for being part of our special day!',
      },
    });
  }

  // Render template
  let html = event.thankYouTemplate.htmlContent;
  
  const templateData = {
    event: {
      name: event.name,
      date: event.date,
    },
  };

  html = html.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.split('.');
    let value: any = templateData;
    for (const key of keys) {
      value = value?.[key];
    }
    return String(value ?? '');
  });

  if (event.thankYouTemplate.cssContent) {
    html = html.replace('</head>', `<style>${event.thankYouTemplate.cssContent}</style></head>`);
  }
  if (event.thankYouTemplate.jsContent) {
    html = html.replace('</body>', `<script>${event.thankYouTemplate.jsContent}</script></body>`);
  }

  res.send(html);
}));

/**
 * GET /api/public/verify-access/:eventSlug
 * Verify access code for invitation-only events
 */
router.get('/verify-access/:eventSlug', asyncHandler(async (req, res) => {
  const { eventSlug } = req.params;
  const { code } = req.query;

  if (!code) {
    throw new AppError('Access code required', 400);
  }

  const event = await prisma.event.findUnique({
    where: { slug: eventSlug },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      eventId: event.id,
      accessCode: code as string,
    },
    include: {
      rsvp: {
        select: { status: true },
      },
    },
  });

  if (!invitation) {
    return res.json({ valid: false, reason: 'Invalid code' });
  }

  if (invitation.rsvp.status !== 'APPROVED') {
    return res.json({ valid: false, reason: 'Not approved' });
  }

  res.json({
    valid: true,
    guest: {
      name: invitation.guestName,
      guestCount: invitation.guestCount,
    },
  });
}));

/**
 * GET /api/public/booth/download/:token
 * Download booth photo using secure token
 */
router.get('/booth/download/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  const { verifyBoothDownloadToken } = await import('../services/boothDownload.js');
  const { downloadFile, BUCKETS } = await import('../services/supabaseStorage.js');
  
  const result = await verifyBoothDownloadToken(token);
  
  if (!result) {
    throw new AppError('Invalid or expired download token', 404);
  }
  
  try {
    // Download file from Supabase
    const fileBuffer = await downloadFile(BUCKETS.MEDIA, result.filePath);
    
    // Get file extension from path
    const ext = result.filePath.split('.').pop() || 'jpg';
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                       ext === 'png' ? 'image/png' : 
                       ext === 'gif' ? 'image/gif' : 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="booth-photo-${Date.now()}.${ext}"`);
    res.send(fileBuffer);
  } catch (error: any) {
    console.error('[Booth Download] Failed to download file:', error.message);
    throw new AppError('Failed to download file', 500);
  }
}));

export default router;
