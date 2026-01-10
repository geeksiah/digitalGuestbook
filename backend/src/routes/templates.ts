import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { createTemplateSchema, updateTemplateSchema } from '../utils/validation.js';

const router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

/**
 * GET /api/templates
 * List all templates with optional type filter
 * Query params:
 *   - type: filter by template type
 *   - includeContent: if 'true', include HTML/CSS/JS content for previews
 */
router.get('/', asyncHandler(async (req, res) => {
  const { type, includeContent } = req.query;

  const where: any = {};
  if (type) {
    where.type = type;
  }

  const selectFields: any = {
    id: true,
    name: true,
    description: true,
    type: true,
    isDefault: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        eventsAsInvitation: true,
        eventsAsRsvp: true,
        eventsAsGuestbook: true,
        eventsAsThankYou: true,
      },
    },
  };

  // Include content if requested (for thumbnail previews)
  if (includeContent === 'true') {
    selectFields.htmlContent = true;
    selectFields.cssContent = true;
    selectFields.jsContent = true;
  }

  const templates = await prisma.template.findMany({
    where,
    orderBy: [
      { type: 'asc' },
      { isDefault: 'desc' },
      { name: 'asc' },
    ],
    select: selectFields,
  });

  // Calculate total usage count
  const templatesWithUsage = templates.map((t: any) => ({
    ...t,
    usageCount: 
      t._count.eventsAsInvitation +
      t._count.eventsAsRsvp +
      t._count.eventsAsGuestbook +
      t._count.eventsAsThankYou,
  }));

  res.json({ templates: templatesWithUsage });
}));

/**
 * GET /api/templates/:id
 * Get single template
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
    include: {
      eventsAsInvitation: { select: { id: true, name: true, slug: true } },
      eventsAsRsvp: { select: { id: true, name: true, slug: true } },
      eventsAsGuestbook: { select: { id: true, name: true, slug: true } },
      eventsAsThankYou: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!template) {
    throw new AppError('Template not found', 404);
  }

  res.json({ template });
}));

// Configure multer for template ZIP uploads
const templatesDir = path.join(process.cwd(), 'templates');
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

const upload = multer({
  dest: path.join(templatesDir, 'uploads'),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  },
});

/**
 * POST /api/templates/upload
 * Upload template as ZIP file and extract
 */
router.post('/upload', upload.single('template'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const { name, description, type } = req.body;
  
  if (!name || !name.trim()) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw new AppError('Template name is required', 400);
  }

  if (!type) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw new AppError('Template type is required', 400);
  }

  // Validate template type
  const validTypes = ['INVITATION', 'RSVP', 'GUESTBOOK', 'GUESTBOOK_VIDEO', 'GUESTBOOK_AUDIO', 'GUESTBOOK_PHOTO', 'BOOTH', 'BOOTH_VIDEO', 'BOOTH_AUDIO', 'BOOTH_PHOTO', 'THANK_YOU'];
  if (!validTypes.includes(type)) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw new AppError(`Invalid template type. Must be one of: ${validTypes.join(', ')}`, 400);
  }

  try {
    // Verify ZIP file is valid
    let zip: AdmZip;
    try {
      zip = new AdmZip(req.file.path);
      const zipEntries = zip.getEntries();
      if (zipEntries.length === 0) {
        throw new Error('ZIP file is empty');
      }
    } catch (zipError: any) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw new AppError(`Invalid ZIP file: ${zipError.message}`, 400);
    }

    // Extract ZIP
    const extractPath = path.join(templatesDir, 'archives', req.file.filename);
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true, force: true });
    }
    fs.mkdirSync(extractPath, { recursive: true });
    zip.extractAllTo(extractPath, true);

    // Look for template files
    const indexPath = path.join(extractPath, 'index.html');
    const cssPath = path.join(extractPath, 'styles.css');
    const jsPath = path.join(extractPath, 'script.js');
    const thumbnailPath = path.join(extractPath, 'thumbnail.png');

    let htmlContent = '<div>Template content</div>';
    let cssContent = '';
    let jsContent = '';
    let thumbnailPathRel = null;

    if (fs.existsSync(indexPath)) {
      htmlContent = fs.readFileSync(indexPath, 'utf-8');
    } else {
      // Try to find HTML file
      const files = fs.readdirSync(extractPath);
      const htmlFile = files.find(f => f.endsWith('.html'));
      if (htmlFile) {
        htmlContent = fs.readFileSync(path.join(extractPath, htmlFile), 'utf-8');
      }
    }

    if (fs.existsSync(cssPath)) {
      cssContent = fs.readFileSync(cssPath, 'utf-8');
    } else {
      const files = fs.readdirSync(extractPath);
      const cssFile = files.find(f => f.endsWith('.css'));
      if (cssFile) {
        cssContent = fs.readFileSync(path.join(extractPath, cssFile), 'utf-8');
      }
    }

    if (fs.existsSync(jsPath)) {
      jsContent = fs.readFileSync(jsPath, 'utf-8');
    } else {
      const files = fs.readdirSync(extractPath);
      const jsFile = files.find(f => f.endsWith('.js'));
      if (jsFile) {
        jsContent = fs.readFileSync(path.join(extractPath, jsFile), 'utf-8');
      }
    }

    // Check for thumbnail
    const imageFiles = fs.readdirSync(extractPath).filter(f => 
      /\.(png|jpg|jpeg|gif|webp)$/i.test(f)
    );
    if (imageFiles.length > 0) {
      thumbnailPathRel = `templates/archives/${req.file.filename}/${imageFiles[0]}`;
    }

    // Relative path from project root
    const assetsPathRel = `templates/archives/${req.file.filename}`;

    // If setting as default, unset other defaults of same type
    if (req.body.isDefault === 'true' || req.body.isDefault === true) {
      await prisma.template.updateMany({
        where: { type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.template.create({
      data: {
        name,
        description: description || null,
        type,
        htmlContent,
        cssContent: cssContent || null,
        jsContent: jsContent || null,
        assetsPath: assetsPathRel,
        thumbnailPath: thumbnailPathRel,
        isDefault: req.body.isDefault === 'true' || req.body.isDefault === true,
      },
    });

    // Clean up uploaded ZIP
    fs.unlinkSync(req.file.path);

    res.status(201).json({ template, message: 'Template uploaded and extracted successfully' });
  } catch (error: any) {
    // Clean up on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw new AppError(`Failed to process template: ${error.message}`, 400);
  }
}));

/**
 * POST /api/templates
 * Create new template (manual HTML/CSS/JS input)
 */
router.post('/', asyncHandler(async (req, res) => {
  const data = createTemplateSchema.parse(req.body);

  // If setting as default, unset other defaults of same type
  if (data.isDefault) {
    await prisma.template.updateMany({
      where: { type: data.type, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await prisma.template.create({
    data,
  });

  res.status(201).json({ template });
}));

/**
 * PATCH /api/templates/:id
 * Update template
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const data = updateTemplateSchema.parse(req.body);

  const existing = await prisma.template.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new AppError('Template not found', 404);
  }

  // If setting as default, unset other defaults of same type
  if (data.isDefault && !existing.isDefault) {
    await prisma.template.updateMany({
      where: { 
        type: data.type || existing.type, 
        isDefault: true,
        id: { not: req.params.id },
      },
      data: { isDefault: false },
    });
  }

  const template = await prisma.template.update({
    where: { id: req.params.id },
    data,
  });

  res.json({ template });
}));

/**
 * DELETE /api/templates/:id
 * Delete template
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
    include: {
      _count: {
        select: {
          eventsAsInvitation: true,
          eventsAsRsvp: true,
          eventsAsGuestbook: true,
          eventsAsThankYou: true,
        },
      },
    },
  });

  if (!template) {
    throw new AppError('Template not found', 404);
  }

  const totalUsage = 
    template._count.eventsAsInvitation +
    template._count.eventsAsRsvp +
    template._count.eventsAsGuestbook +
    template._count.eventsAsThankYou;

  if (totalUsage > 0) {
    throw new AppError(
      `Cannot delete template that is in use by ${totalUsage} event(s)`,
      400
    );
  }

  await prisma.template.delete({
    where: { id: req.params.id },
  });

  res.json({ message: 'Template deleted successfully' });
}));

/**
 * POST /api/templates/:id/duplicate
 * Duplicate a template
 */
router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const source = await prisma.template.findUnique({
    where: { id: req.params.id },
  });

  if (!source) {
    throw new AppError('Template not found', 404);
  }

  const template = await prisma.template.create({
    data: {
      name: `${source.name} (Copy)`,
      description: source.description,
      type: source.type,
      htmlContent: source.htmlContent,
      cssContent: source.cssContent,
      jsContent: source.jsContent,
      variables: source.variables,
      isDefault: false,
    },
  });

  res.status(201).json({ template });
}));

/**
 * POST /api/templates/assign/:eventId
 * Assign templates to an event (with per-event asset isolation)
 */
router.post('/assign/:eventId', asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const {
    invitationTemplateId,
    rsvpTemplateId,
    guestbookTemplateId,
    guestbookVideoTemplateId,
    guestbookAudioTemplateId,
    guestbookPhotoTemplateId,
    boothTemplateId,
    boothVideoTemplateId,
    boothAudioTemplateId,
    boothPhotoTemplateId,
    thankYouTemplateId,
  } = req.body;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  // Validate template IDs and types
  const templateAssignments: any = {};

  // Helper to validate and add template
  const validateAndAdd = async (
    templateId: string | null | undefined, 
    fieldName: string, 
    expectedType: string, 
    requiresService?: { enabled: boolean; name: string }
  ) => {
    if (templateId === null) {
      // Explicitly set to null to remove assignment
      templateAssignments[fieldName] = null;
      return;
    }
    if (!templateId) return;
    
    if (requiresService && !requiresService.enabled) {
      throw new AppError(`Cannot assign ${expectedType} template - ${requiresService.name} service is disabled`, 400);
    }
    
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template || template.type !== expectedType) {
      throw new AppError(`Invalid ${expectedType} template`, 400);
    }
    templateAssignments[fieldName] = templateId;
  };

  await validateAndAdd(invitationTemplateId, 'invitationTemplateId', 'INVITATION', 
    { enabled: event.invitationEnabled, name: 'invitation' });
  await validateAndAdd(rsvpTemplateId, 'rsvpTemplateId', 'RSVP', 
    { enabled: event.rsvpEnabled, name: 'RSVP' });
  await validateAndAdd(guestbookTemplateId, 'guestbookTemplateId', 'GUESTBOOK', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(guestbookVideoTemplateId, 'guestbookVideoTemplateId', 'GUESTBOOK_VIDEO', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(guestbookAudioTemplateId, 'guestbookAudioTemplateId', 'GUESTBOOK_AUDIO', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(guestbookPhotoTemplateId, 'guestbookPhotoTemplateId', 'GUESTBOOK_PHOTO', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(boothTemplateId, 'boothTemplateId', 'BOOTH', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(boothVideoTemplateId, 'boothVideoTemplateId', 'BOOTH_VIDEO', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(boothAudioTemplateId, 'boothAudioTemplateId', 'BOOTH_AUDIO', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(boothPhotoTemplateId, 'boothPhotoTemplateId', 'BOOTH_PHOTO', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(thankYouTemplateId, 'thankYouTemplateId', 'THANK_YOU');

  // Copy template assets to event-specific directory for isolation using service
  const { copyTemplateAssetsForEvent } = await import('../services/templateIsolation.js');
  await copyTemplateAssetsForEvent(eventId, {
    invitationTemplateId,
    rsvpTemplateId,
    guestbookTemplateId,
    guestbookVideoTemplateId,
    guestbookAudioTemplateId,
    guestbookPhotoTemplateId,
    boothTemplateId,
    boothVideoTemplateId,
    boothAudioTemplateId,
    boothPhotoTemplateId,
    thankYouTemplateId,
  });

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: templateAssignments,
    include: {
      invitationTemplate: true,
      rsvpTemplate: true,
      guestbookTemplate: true,
      guestbookVideoTemplate: true,
      guestbookAudioTemplate: true,
      guestbookPhotoTemplate: true,
      boothTemplate: true,
      boothVideoTemplate: true,
      boothAudioTemplate: true,
      boothPhotoTemplate: true,
      thankYouTemplate: true,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      eventId,
      adminId: req.admin!.id,
      action: 'TEMPLATES_ASSIGNED',
      entityType: 'EVENT',
      entityId: eventId,
      details: JSON.stringify(templateAssignments),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  res.json({ event: updatedEvent, message: 'Templates assigned and assets copied successfully' });
}));

export default router;
