"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const validation_js_1 = require("../utils/validation.js");
const router = (0, express_1.Router)();
// All routes require admin authentication
router.use(auth_js_1.authenticateAdmin);
/**
 * GET /api/templates
 * List all templates with optional type filter
 * Query params:
 *   - type: filter by template type
 *   - includeContent: if 'true', include HTML/CSS/JS content for previews
 */
router.get('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { type, includeContent } = req.query;
    const where = {};
    if (type) {
        where.type = type;
    }
    const selectFields = {
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
    const templates = await prisma_js_1.default.template.findMany({
        where,
        orderBy: [
            { type: 'asc' },
            { isDefault: 'desc' },
            { name: 'asc' },
        ],
        select: selectFields,
    });
    // Calculate total usage count
    const templatesWithUsage = templates.map((t) => ({
        ...t,
        usageCount: t._count.eventsAsInvitation +
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
router.get('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
        select: {
            id: true,
            name: true,
            description: true,
            type: true,
            htmlContent: true,
            cssContent: true,
            jsContent: true,
            assetsPath: true,
            thumbnailPath: true,
            variables: true,
            isDefault: true,
            createdAt: true,
            updatedAt: true,
            eventsAsInvitation: { select: { id: true, name: true, slug: true } },
            eventsAsRsvp: { select: { id: true, name: true, slug: true } },
            eventsAsGuestbook: { select: { id: true, name: true, slug: true } },
            eventsAsThankYou: { select: { id: true, name: true, slug: true } },
        },
    });
    if (!template) {
        throw new errorHandler_js_1.AppError('Template not found', 404);
    }
    res.json({ template });
}));
// Configure multer for template ZIP uploads
const templatesDir = path_1.default.join(process.cwd(), 'templates');
if (!fs_1.default.existsSync(templatesDir)) {
    fs_1.default.mkdirSync(templatesDir, { recursive: true });
}
const upload = (0, multer_1.default)({
    dest: path_1.default.join(templatesDir, 'uploads'),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only ZIP files are allowed'));
        }
    },
});
/**
 * POST /api/templates/upload
 * Upload template as ZIP file and extract
 */
router.post('/upload', upload.single('template'), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        throw new errorHandler_js_1.AppError('No file uploaded', 400);
    }
    const { name, description, type } = req.body;
    if (!name || !name.trim()) {
        if (fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        throw new errorHandler_js_1.AppError('Template name is required', 400);
    }
    if (!type) {
        if (fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        throw new errorHandler_js_1.AppError('Template type is required', 400);
    }
    // Validate template type
    const validTypes = ['INVITATION', 'RSVP', 'GUESTBOOK', 'GUESTBOOK_VIDEO', 'GUESTBOOK_AUDIO', 'GUESTBOOK_PHOTO', 'BOOTH', 'BOOTH_VIDEO', 'BOOTH_AUDIO', 'BOOTH_PHOTO', 'THANK_YOU', 'LIVE_LANDING', 'EVENT_ENDED'];
    if (!validTypes.includes(type)) {
        if (fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        throw new errorHandler_js_1.AppError(`Invalid template type. Must be one of: ${validTypes.join(', ')}`, 400);
    }
    try {
        // Verify ZIP file is valid
        let zip;
        try {
            zip = new adm_zip_1.default(req.file.path);
            const zipEntries = zip.getEntries();
            if (zipEntries.length === 0) {
                throw new Error('ZIP file is empty');
            }
        }
        catch (zipError) {
            if (fs_1.default.existsSync(req.file.path)) {
                fs_1.default.unlinkSync(req.file.path);
            }
            throw new errorHandler_js_1.AppError(`Invalid ZIP file: ${zipError.message}`, 400);
        }
        // Extract ZIP
        const extractPath = path_1.default.join(templatesDir, 'archives', req.file.filename);
        if (fs_1.default.existsSync(extractPath)) {
            fs_1.default.rmSync(extractPath, { recursive: true, force: true });
        }
        fs_1.default.mkdirSync(extractPath, { recursive: true });
        zip.extractAllTo(extractPath, true);
        // Look for template files
        const indexPath = path_1.default.join(extractPath, 'index.html');
        const cssPath = path_1.default.join(extractPath, 'styles.css');
        const jsPath = path_1.default.join(extractPath, 'script.js');
        const thumbnailPath = path_1.default.join(extractPath, 'thumbnail.png');
        let htmlContent = '<div>Template content</div>';
        let cssContent = '';
        let jsContent = '';
        let thumbnailPathRel = null;
        if (fs_1.default.existsSync(indexPath)) {
            htmlContent = fs_1.default.readFileSync(indexPath, 'utf-8');
        }
        else {
            // Try to find HTML file
            const files = fs_1.default.readdirSync(extractPath);
            const htmlFile = files.find(f => f.endsWith('.html'));
            if (htmlFile) {
                htmlContent = fs_1.default.readFileSync(path_1.default.join(extractPath, htmlFile), 'utf-8');
            }
        }
        if (fs_1.default.existsSync(cssPath)) {
            cssContent = fs_1.default.readFileSync(cssPath, 'utf-8');
        }
        else {
            const files = fs_1.default.readdirSync(extractPath);
            const cssFile = files.find(f => f.endsWith('.css'));
            if (cssFile) {
                cssContent = fs_1.default.readFileSync(path_1.default.join(extractPath, cssFile), 'utf-8');
            }
        }
        if (fs_1.default.existsSync(jsPath)) {
            jsContent = fs_1.default.readFileSync(jsPath, 'utf-8');
        }
        else {
            const files = fs_1.default.readdirSync(extractPath);
            const jsFile = files.find(f => f.endsWith('.js'));
            if (jsFile) {
                jsContent = fs_1.default.readFileSync(path_1.default.join(extractPath, jsFile), 'utf-8');
            }
        }
        // Check for thumbnail
        const imageFiles = fs_1.default.readdirSync(extractPath).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
        if (imageFiles.length > 0) {
            thumbnailPathRel = `templates/archives/${req.file.filename}/${imageFiles[0]}`;
        }
        // Relative path from project root
        const assetsPathRel = `templates/archives/${req.file.filename}`;
        // If setting as default, unset other defaults of same type
        if (req.body.isDefault === 'true' || req.body.isDefault === true) {
            await prisma_js_1.default.template.updateMany({
                where: { type, isDefault: true },
                data: { isDefault: false },
            });
        }
        const template = await prisma_js_1.default.template.create({
            data: {
                name,
                description: description || null,
                type,
                htmlContent,
                cssContent: cssContent || null,
                jsContent: jsContent || null,
                assetsPath: assetsPathRel || null,
                thumbnailPath: thumbnailPathRel || null,
                isDefault: req.body.isDefault === 'true' || req.body.isDefault === true,
            }, // Temporary type assertion until Prisma client is regenerated
        });
        // Clean up uploaded ZIP
        fs_1.default.unlinkSync(req.file.path);
        res.status(201).json({ template, message: 'Template uploaded and extracted successfully' });
    }
    catch (error) {
        // Clean up on error
        if (req.file && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        throw new errorHandler_js_1.AppError(`Failed to process template: ${error.message}`, 400);
    }
}));
/**
 * POST /api/templates
 * Create new template (manual HTML/CSS/JS input)
 */
router.post('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = validation_js_1.createTemplateSchema.parse(req.body);
    // If setting as default, unset other defaults of same type
    if (data.isDefault) {
        await prisma_js_1.default.template.updateMany({
            where: { type: data.type, isDefault: true },
            data: { isDefault: false },
        });
    }
    const template = await prisma_js_1.default.template.create({
        data,
    });
    res.status(201).json({ template });
}));
/**
 * PATCH /api/templates/:id
 * Update template
 */
router.patch('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = validation_js_1.updateTemplateSchema.parse(req.body);
    const existing = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
    });
    if (!existing) {
        throw new errorHandler_js_1.AppError('Template not found', 404);
    }
    // If setting as default, unset other defaults of same type
    if (data.isDefault && !existing.isDefault) {
        await prisma_js_1.default.template.updateMany({
            where: {
                type: data.type || existing.type,
                isDefault: true,
                id: { not: req.params.id },
            },
            data: { isDefault: false },
        });
    }
    const template = await prisma_js_1.default.template.update({
        where: { id: req.params.id },
        data,
    });
    res.json({ template });
}));
/**
 * DELETE /api/templates/:id
 * Delete template
 */
router.delete('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const template = await prisma_js_1.default.template.findUnique({
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
        throw new errorHandler_js_1.AppError('Template not found', 404);
    }
    const totalUsage = template._count.eventsAsInvitation +
        template._count.eventsAsRsvp +
        template._count.eventsAsGuestbook +
        template._count.eventsAsThankYou;
    if (totalUsage > 0) {
        throw new errorHandler_js_1.AppError(`Cannot delete template that is in use by ${totalUsage} event(s)`, 400);
    }
    await prisma_js_1.default.template.delete({
        where: { id: req.params.id },
    });
    res.json({ message: 'Template deleted successfully' });
}));
/**
 * POST /api/templates/:id/duplicate
 * Duplicate a template
 */
router.post('/:id/duplicate', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const source = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
    });
    if (!source) {
        throw new errorHandler_js_1.AppError('Template not found', 404);
    }
    const template = await prisma_js_1.default.template.create({
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
router.post('/assign/:eventId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { invitationTemplateId, rsvpTemplateId, guestbookTemplateId, guestbookVideoTemplateId, guestbookAudioTemplateId, guestbookPhotoTemplateId, boothTemplateId, boothVideoTemplateId, boothAudioTemplateId, boothPhotoTemplateId, thankYouTemplateId, liveLandingTemplateId, eventEndedTemplateId, } = req.body;
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    // Validate template IDs and types
    const templateAssignments = {};
    // Helper to validate and add template
    const validateAndAdd = async (templateId, fieldName, expectedType, requiresService) => {
        if (templateId === null) {
            // Explicitly set to null to remove assignment
            templateAssignments[fieldName] = null;
            return;
        }
        if (!templateId)
            return;
        if (requiresService && !requiresService.enabled) {
            throw new errorHandler_js_1.AppError(`Cannot assign ${expectedType} template - ${requiresService.name} service is disabled`, 400);
        }
        const template = await prisma_js_1.default.template.findUnique({ where: { id: templateId } });
        if (!template || template.type !== expectedType) {
            throw new errorHandler_js_1.AppError(`Invalid ${expectedType} template`, 400);
        }
        templateAssignments[fieldName] = templateId;
    };
    await validateAndAdd(invitationTemplateId, 'invitationTemplateId', 'INVITATION', { enabled: event.invitationEnabled, name: 'invitation' });
    await validateAndAdd(rsvpTemplateId, 'rsvpTemplateId', 'RSVP', { enabled: event.rsvpEnabled, name: 'RSVP' });
    await validateAndAdd(guestbookTemplateId, 'guestbookTemplateId', 'GUESTBOOK', { enabled: event.guestbookEnabled, name: 'guestbook' });
    await validateAndAdd(guestbookVideoTemplateId, 'guestbookVideoTemplateId', 'GUESTBOOK_VIDEO', { enabled: event.guestbookEnabled, name: 'guestbook' });
    await validateAndAdd(guestbookAudioTemplateId, 'guestbookAudioTemplateId', 'GUESTBOOK_AUDIO', { enabled: event.guestbookEnabled, name: 'guestbook' });
    await validateAndAdd(guestbookPhotoTemplateId, 'guestbookPhotoTemplateId', 'GUESTBOOK_PHOTO', { enabled: event.guestbookEnabled, name: 'guestbook' });
    await validateAndAdd(boothTemplateId, 'boothTemplateId', 'BOOTH', { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
    await validateAndAdd(boothVideoTemplateId, 'boothVideoTemplateId', 'BOOTH_VIDEO', { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
    await validateAndAdd(boothAudioTemplateId, 'boothAudioTemplateId', 'BOOTH_AUDIO', { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
    await validateAndAdd(boothPhotoTemplateId, 'boothPhotoTemplateId', 'BOOTH_PHOTO', { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
    await validateAndAdd(thankYouTemplateId, 'thankYouTemplateId', 'THANK_YOU');
    await validateAndAdd(liveLandingTemplateId, 'liveLandingTemplateId', 'LIVE_LANDING');
    await validateAndAdd(eventEndedTemplateId, 'eventEndedTemplateId', 'EVENT_ENDED');
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
        liveLandingTemplateId,
        eventEndedTemplateId,
    });
    const updatedEvent = await prisma_js_1.default.event.update({
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
            liveLandingTemplate: true,
            eventEndedTemplate: true,
        },
    });
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            adminId: req.admin.id,
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
// Serve template asset files publicly via API
router.get('/assets/:assetPath(*)', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const assetPath = req.params.assetPath;
    if (!assetPath) {
        throw new errorHandler_js_1.AppError('Asset path required', 400);
    }
    // Resolve and secure path
    const templatesDir = path_1.default.join(process.cwd(), 'templates');
    const fullPath = path_1.default.resolve(process.cwd(), assetPath);
    if (!fullPath.startsWith(templatesDir)) {
        throw new errorHandler_js_1.AppError('Invalid asset path', 403);
    }
    if (!fs_1.default.existsSync(fullPath)) {
        throw new errorHandler_js_1.AppError('Asset not found', 404);
    }
    res.sendFile(fullPath);
}));
/**
 * GET /api/templates/:id/assets
 * List assets files for a template
 */
router.get('/:id/assets', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
        select: { assetsPath: true },
    });
    if (!template || !template.assetsPath) {
        return res.json({ assets: [] });
    }
    try {
        const assetsDir = path_1.default.join(process.cwd(), template.assetsPath);
        if (!fs_1.default.existsSync(assetsDir)) {
            return res.json({ assets: [] });
        }
        const files = fs_1.default.readdirSync(assetsDir);
        const assets = files.map(file => {
            const filePath = path_1.default.join(assetsDir, file);
            const stats = fs_1.default.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                isDirectory: stats.isDirectory(),
                modified: stats.mtime,
            };
        });
        res.json({ assets });
    }
    catch (error) {
        console.error('Error reading assets directory:', error);
        res.json({ assets: [] });
    }
}));
exports.default = router;
//# sourceMappingURL=templates.js.map