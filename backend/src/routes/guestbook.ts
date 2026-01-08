/**
 * GET /api/guestbook/:eventId/booth
 * Get booth mode configuration (no access code required - kiosk mode)
 * 
 * UPDATED: Now includes maxPhotosPerSession from event settings
 */
router.get('/:eventId/booth', verifyBoothAccess, asyncHandler(async (req, res) => {
  const event = (req as any).event;

  res.json({
    booth: {
      eventId: event.id,
      eventName: event.name,
      maxRecordingDuration: event.maxRecordingDuration,
      minRecordingDuration: event.minRecordingDuration,
      // NEW: Booth-specific photo limit per session
      maxPhotosPerSession: event.maxPhotosPerBoothSession || 10,
      // NEW: Shutter countdown timer
      shutterCountdown: event.boothShutterCountdown || 3,
      // Event branding colors
      primaryColor: event.primaryColor || '#6366f1',
      secondaryColor: event.secondaryColor || '#e0e7ff',
      // Template data for custom styling
      template: event.boothTemplate ? {
        id: event.boothTemplate.id,
        name: event.boothTemplate.name,
        htmlContent: event.boothTemplate.htmlContent,
        cssContent: event.boothTemplate.cssContent,
        jsContent: event.boothTemplate.jsContent,
        variables: event.boothTemplate.variables,
      } : null,
    },
  });
}));

/**
 * POST /api/guestbook/:eventId/booth/upload
 * Upload media in booth mode (no access code required)
 * 
 * UPDATED: Validates photo count per session using session tracking
 */
router.post(
  '/:eventId/booth/upload',
  verifyBoothAccess,
  upload.single('media'),
  asyncHandler(async (req, res) => {
    const event = (req as any).event;
    const file = req.file;

    if (!file) {
      throw new AppError('No media file provided', 400);
    }

    const data = mediaUploadSchema.parse({
      ...req.body,
      captureMode: 'BOOTH', // Force booth mode
    });

    // For photos, check session limit (using deviceId + timestamp window)
    if (data.type === 'PHOTO') {
      const sessionWindow = 30 * 60 * 1000; // 30 minute session window
      const sessionStart = new Date(Date.now() - sessionWindow);
      
      const photosInSession = await prisma.mediaAsset.count({
        where: {
          eventId: event.id,
          type: 'PHOTO',
          captureMode: 'BOOTH',
          deviceId: data.deviceId,
          createdAt: { gte: sessionStart },
        },
      });

      const maxPhotosPerSession = event.maxPhotosPerBoothSession || 10;
      
      if (photosInSession >= maxPhotosPerSession) {
        throw new AppError(
          `Maximum ${maxPhotosPerSession} photos per session. Please start a new session.`,
          400
        );
      }
    }

    // Generate unique filename
    const ext = file.originalname.split('.').pop() || 'bin';
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = path.join('uploads', 'media', event.id, uniqueFilename);
    
    // Ensure directory exists
    const uploadDir = path.dirname(path.join(process.cwd(), filePath));
    await fs.promises.mkdir(uploadDir, { recursive: true });
    
    // Move file to final location
    await fs.promises.rename(file.path, path.join(process.cwd(), filePath));

    // Create media entry
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        eventId: event.id,
        type: data.type,
        fileName: file.originalname,
        filePath: `/${filePath}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        duration: data.duration,
        guestName: data.guestName || 'Booth Guest',
        guestEmail: data.guestEmail,
        captureMode: 'BOOTH',
        deviceId: data.deviceId,
        status: 'READY',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        eventId: event.id,
        action: 'GUESTBOOK_UPLOAD',
        entityType: 'MEDIA',
        entityId: mediaAsset.id,
        details: JSON.stringify({
          type: data.type,
          captureMode: 'BOOTH',
          guestName: data.guestName,
          deviceId: data.deviceId,
        }),
      },
    });

    res.status(201).json({
      message: 'Media uploaded successfully',
      mediaAsset: {
        id: mediaAsset.id,
        type: mediaAsset.type,
        status: mediaAsset.status,
      },
    });
  })
);
