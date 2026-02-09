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
const sharp_1 = __importDefault(require("sharp"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const validation_js_1 = require("../utils/validation.js");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required) — must come BEFORE router.use(authenticateAdmin)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * GET /api/templates/:id/assets/*
 * Serve template assets (images, fonts, etc.) — PUBLIC, no auth required.
 * These are referenced by rendered templates served to guest browsers.
 */
router.get('/:id/assets/*', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const templateId = req.params.id;
    const assetPath = req.params[0]; // Everything after /assets/
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: templateId },
        select: { assetsPath: true },
    });
    if (!template || !template.assetsPath) {
        throw new errorHandler_js_1.AppError('Template or assets not found', 404);
    }
    // Construct full file path
    const fullPath = path_1.default.join(process.cwd(), template.assetsPath, assetPath);
    // Security: ensure path is within template directory
    const templateDir = path_1.default.join(process.cwd(), template.assetsPath);
    const resolvedPath = path_1.default.resolve(fullPath);
    if (!resolvedPath.startsWith(templateDir)) {
        throw new errorHandler_js_1.AppError('Invalid asset path', 403);
    }
    // Check if file exists
    if (!fs_1.default.existsSync(resolvedPath)) {
        throw new errorHandler_js_1.AppError('Asset not found', 404);
    }
    // Set proper cache headers for assets
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    // Serve the file with correct MIME type
    res.sendFile(resolvedPath);
}));
/**
 * GET /api/templates/:id/preview
 * Get template preview/thumbnail — PUBLIC for template previews.
 */
router.get('/:id/preview', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
        select: { thumbnailPath: true, assetsPath: true, name: true },
    });
    if (!template) {
        throw new errorHandler_js_1.AppError('Template not found', 404);
    }
    if (template.thumbnailPath) {
        const thumbnailFullPath = path_1.default.join(process.cwd(), template.thumbnailPath);
        if (fs_1.default.existsSync(thumbnailFullPath)) {
            return res.sendFile(thumbnailFullPath);
        }
    }
    // Return placeholder if no thumbnail
    res.status(404).json({
        message: 'No preview available',
        template: { id: req.params.id, name: template.name },
    });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES — all routes below require admin authentication
// ═══════════════════════════════════════════════════════════════════════════════
router.use(auth_js_1.authenticateAdmin);
/**
 * GET /api/templates
 * List all templates with optional type filter
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
        assetsPath: true,
        thumbnailPath: true,
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
    // Include content if requested
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
        include: {
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
/**
 * POST /api/templates
 * Create new template
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
    // Use partial schema to allow optional updates
    const data = validation_js_1.updateTemplateSchema.partial().parse(req.body);
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
            assetsPath: source.assetsPath,
            thumbnailPath: source.thumbnailPath,
            variables: source.variables,
            isDefault: false,
        },
    });
    res.status(201).json({ template });
}));
// ============================================
// TEMPLATE UPLOAD & ASSET MANAGEMENT
// ============================================
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
 * IMPROVED: Better asset handling, thumbnail generation, preview support
 */
router.post('/upload', upload.single('template'), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        throw new errorHandler_js_1.AppError('No file uploaded', 400);
    }
    const { name, description, type } = req.body;
    // Validation
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
    const validTypes = [
        'INVITATION', 'RSVP', 'GUESTBOOK', 'GUESTBOOK_VIDEO', 'GUESTBOOK_AUDIO',
        'GUESTBOOK_PHOTO', 'BOOTH', 'BOOTH_VIDEO', 'BOOTH_AUDIO', 'BOOTH_PHOTO',
        'THANK_YOU', 'LIVE_LANDING', 'EVENT_ENDED'
    ];
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
        // Create unique template ID
        const templateId = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Extract ZIP to permanent location
        const extractPath = path_1.default.join(templatesDir, templateId);
        if (fs_1.default.existsSync(extractPath)) {
            fs_1.default.rmSync(extractPath, { recursive: true, force: true });
        }
        fs_1.default.mkdirSync(extractPath, { recursive: true });
        zip.extractAllTo(extractPath, true);
        console.log(`[Templates] Extracted ZIP to ${extractPath}`);
        // ── WRAPPER DIRECTORY DETECTION ──
        // When users zip a folder (zip -r template.zip my-template/),
        // the ZIP extracts to extractPath/my-template/index.html
        let contentRoot = extractPath;
        const topEntries = fs_1.default.readdirSync(extractPath, { withFileTypes: true });
        const topDirs = topEntries.filter(e => e.isDirectory() && e.name !== '__MACOSX');
        const topFiles = topEntries.filter(e => e.isFile());
        if (topDirs.length === 1 && topFiles.length === 0) {
            contentRoot = path_1.default.join(extractPath, topDirs[0].name);
            console.log(`[Templates] Detected wrapper directory, content root: ${contentRoot}`);
        }
        // ── RECURSIVE FILE FINDER ──
        const findFileRecursive = (dir, extensions) => {
            try {
                const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isFile()) {
                        const ext = path_1.default.extname(entry.name).toLowerCase();
                        if (extensions.includes(ext)) {
                            return path_1.default.join(dir, entry.name);
                        }
                    }
                }
                for (const entry of entries) {
                    if (entry.isDirectory() && !['node_modules', '__MACOSX', '.git'].includes(entry.name)) {
                        const found = findFileRecursive(path_1.default.join(dir, entry.name), extensions);
                        if (found)
                            return found;
                    }
                }
            }
            catch { /* ignore */ }
            return null;
        };
        let htmlContent = '';
        let cssContent = '';
        let jsContent = '';
        // Find HTML file (required)
        const indexPath = path_1.default.join(contentRoot, 'index.html');
        if (fs_1.default.existsSync(indexPath)) {
            htmlContent = fs_1.default.readFileSync(indexPath, 'utf-8');
        }
        else {
            const found = findFileRecursive(contentRoot, ['.html'])
                || findFileRecursive(extractPath, ['.html']);
            if (found) {
                htmlContent = fs_1.default.readFileSync(found, 'utf-8');
            }
            else {
                throw new errorHandler_js_1.AppError('No HTML file found in ZIP', 400);
            }
        }
        // Find CSS file (optional)
        const cssChecks = ['styles.css', 'style.css', 'main.css', 'index.css'];
        let cssFound = false;
        for (const cssName of cssChecks) {
            const p = path_1.default.join(contentRoot, cssName);
            if (fs_1.default.existsSync(p)) {
                cssContent = fs_1.default.readFileSync(p, 'utf-8');
                cssFound = true;
                break;
            }
        }
        if (!cssFound) {
            const found = findFileRecursive(contentRoot, ['.css']);
            if (found)
                cssContent = fs_1.default.readFileSync(found, 'utf-8');
        }
        // Find JS file (optional)
        const jsChecks = ['script.js', 'main.js', 'index.js', 'app.js'];
        let jsFound = false;
        for (const jsName of jsChecks) {
            const p = path_1.default.join(contentRoot, jsName);
            if (fs_1.default.existsSync(p)) {
                jsContent = fs_1.default.readFileSync(p, 'utf-8');
                jsFound = true;
                break;
            }
        }
        if (!jsFound) {
            const found = findFileRecursive(contentRoot, ['.js']);
            if (found)
                jsContent = fs_1.default.readFileSync(found, 'utf-8');
        }
        // Generate thumbnail from first image found or create placeholder
        let thumbnailPath = null;
        const findThumbnail = (dir) => {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path_1.default.join(dir, entry.name);
                if (entry.isDirectory() && entry.name !== 'node_modules') {
                    const found = findThumbnail(fullPath);
                    if (found)
                        return found;
                }
                else if (entry.isFile()) {
                    const ext = path_1.default.extname(entry.name).toLowerCase();
                    if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
                        // Prioritize files named 'thumbnail', 'preview', or 'cover'
                        if (/thumbnail|preview|cover/i.test(entry.name)) {
                            return fullPath;
                        }
                        // Otherwise return first image found
                        if (!thumbnailPath) {
                            return fullPath;
                        }
                    }
                }
            }
            return null;
        };
        const sourceThumbnail = findThumbnail(contentRoot);
        if (sourceThumbnail) {
            // Generate optimized thumbnail
            const thumbnailFilename = `${templateId}_thumbnail.jpg`;
            const thumbnailOutputPath = path_1.default.join(templatesDir, 'thumbnails', thumbnailFilename);
            const thumbnailsDir = path_1.default.join(templatesDir, 'thumbnails');
            if (!fs_1.default.existsSync(thumbnailsDir)) {
                fs_1.default.mkdirSync(thumbnailsDir, { recursive: true });
            }
            try {
                await (0, sharp_1.default)(sourceThumbnail)
                    .resize(400, 300, { fit: 'cover' })
                    .jpeg({ quality: 80 })
                    .toFile(thumbnailOutputPath);
                thumbnailPath = `templates/thumbnails/${thumbnailFilename}`;
                console.log(`[Templates] Generated thumbnail at ${thumbnailPath}`);
            }
            catch (thumbError) {
                console.error('[Templates] Failed to generate thumbnail:', thumbError);
            }
        }
        // Store relative assets path (from templates directory)
        const assetsPath = `templates/${templateId}`;
        // Create template record in database
        const template = await prisma_js_1.default.template.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                type,
                htmlContent,
                cssContent: cssContent || null,
                jsContent: jsContent || null,
                assetsPath,
                thumbnailPath,
                isDefault: false,
            },
        });
        // Clean up uploaded file
        if (fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        console.log(`[Templates] Created template id=${template.id} name=${template.name} type=${template.type}`);
        res.json({
            template,
            message: 'Template uploaded successfully',
            assets: {
                path: assetsPath,
                thumbnail: thumbnailPath,
                hasCSS: !!cssContent,
                hasJS: !!jsContent,
            }
        });
    }
    catch (error) {
        // Clean up on error
        if (fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        console.error('[Templates] Upload failed:', error);
        throw error;
    }
}));
// NOTE: /:id/assets/* and /:id/preview are registered as PUBLIC routes
// at the top of this file (before authenticateAdmin). No duplicates here.
/**
 * GET /api/templates/:id/files
 * List all files in template (for editing)
 */
router.get('/:id/files', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
        select: { assetsPath: true, htmlContent: true, cssContent: true, jsContent: true },
    });
    if (!template) {
        throw new errorHandler_js_1.AppError('Template not found', 404);
    }
    const files = [];
    // Add main template files
    files.push({
        name: 'index.html',
        type: 'html',
        size: template.htmlContent.length,
        editable: true,
    });
    if (template.cssContent) {
        files.push({
            name: 'styles.css',
            type: 'css',
            size: template.cssContent.length,
            editable: true,
        });
    }
    if (template.jsContent) {
        files.push({
            name: 'script.js',
            type: 'javascript',
            size: template.jsContent.length,
            editable: true,
        });
    }
    // List assets if directory exists
    if (template.assetsPath) {
        const assetsFullPath = path_1.default.join(process.cwd(), template.assetsPath);
        if (fs_1.default.existsSync(assetsFullPath)) {
            const listFiles = (dir, basePath = '') => {
                const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const relativePath = path_1.default.join(basePath, entry.name);
                    const fullPath = path_1.default.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        files.push({
                            name: relativePath,
                            type: 'directory',
                            editable: false,
                        });
                        listFiles(fullPath, relativePath);
                    }
                    else {
                        const stats = fs_1.default.statSync(fullPath);
                        const ext = path_1.default.extname(entry.name).toLowerCase();
                        files.push({
                            name: relativePath,
                            type: ext.slice(1) || 'file',
                            size: stats.size,
                            editable: ['.html', '.css', '.js', '.json', '.txt', '.md'].includes(ext),
                        });
                    }
                }
            };
            listFiles(assetsFullPath, 'assets');
        }
    }
    res.json({ files });
}));
/**
 * GET /api/templates/:id/file-content
 * Get content of a specific file in template
 */
router.get('/:id/file-content', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') {
        throw new errorHandler_js_1.AppError('File path is required', 400);
    }
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
        select: { htmlContent: true, cssContent: true, jsContent: true, assetsPath: true },
    });
    if (!template) {
        throw new errorHandler_js_1.AppError('Template not found', 404);
    }
    // Handle main template files
    if (filePath === 'index.html') {
        return res.json({ content: template.htmlContent });
    }
    if (filePath === 'styles.css') {
        return res.json({ content: template.cssContent || '' });
    }
    if (filePath === 'script.js') {
        return res.json({ content: template.jsContent || '' });
    }
    // Handle asset files
    if (template.assetsPath && filePath.startsWith('assets/')) {
        const fullPath = path_1.default.join(process.cwd(), template.assetsPath, filePath.replace('assets/', ''));
        // Security check
        const templateDir = path_1.default.join(process.cwd(), template.assetsPath);
        const resolvedPath = path_1.default.resolve(fullPath);
        if (!resolvedPath.startsWith(templateDir)) {
            throw new errorHandler_js_1.AppError('Invalid file path', 403);
        }
        if (!fs_1.default.existsSync(resolvedPath)) {
            throw new errorHandler_js_1.AppError('File not found', 404);
        }
        // Check if file is text-based
        const ext = path_1.default.extname(filePath).toLowerCase();
        const textExtensions = ['.html', '.css', '.js', '.json', '.txt', '.md', '.xml', '.svg'];
        if (textExtensions.includes(ext)) {
            const content = fs_1.default.readFileSync(resolvedPath, 'utf-8');
            return res.json({ content });
        }
        else {
            throw new errorHandler_js_1.AppError('File type not supported for editing', 400);
        }
    }
    throw new errorHandler_js_1.AppError('File not found', 404);
}));
exports.default = router;
//# sourceMappingURL=templates.js.map