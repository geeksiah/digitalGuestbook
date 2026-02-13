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
const supabaseStorage_js_1 = require("../services/supabaseStorage.js");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════════════════════════════════════════
// MIME type map for uploads
// ═══════════════════════════════════════════════════════════════════════════════
const MIME_MAP = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
};
function getMimeType(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    return MIME_MAP[ext] || 'application/octet-stream';
}
function normalizeSupabasePath(p) {
    return String(p || '')
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\//, '')
        .replace(/\/$/, '');
}
function baseHasAssetsFolder(base) {
    return /(^|\/)assets$/.test(normalizeSupabasePath(base));
}
// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth) — must come BEFORE router.use(authenticateAdmin)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * GET /api/templates/:id/assets/*
 * Serve template assets — PUBLIC (no auth).
 *
 * If Supabase is configured, download from private bucket and stream it.
 * Falls back to local filesystem (dev only).
 */
router.get('/:id/assets/*', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const templateId = req.params.id;
    const assetPath = req.params[0];
    if (!assetPath)
        throw new errorHandler_js_1.AppError('Asset path is required', 400);
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: templateId },
        select: { assetsPath: true },
    });
    if (!template?.assetsPath)
        throw new errorHandler_js_1.AppError('Template or assets not found', 404);
    // Prevent traversal
    const normalized = assetPath.replace(/\.\./g, '').replace(/\/\//g, '/');
    if (normalized !== assetPath || assetPath.includes('..')) {
        throw new errorHandler_js_1.AppError('Invalid asset path', 403);
    }
    // Supabase (preferred)
    if ((0, supabaseStorage_js_1.isSupabaseConfigured)()) {
        const base = normalizeSupabasePath(template.assetsPath);
        const rel = normalizeSupabasePath(normalized);
        // Backward compatible:
        // - new: assetsPath = "tpl_xxx/assets" -> use base/rel
        // - old: assetsPath = "tpl_xxx" -> try base/rel AND base/assets/rel
        const candidates = baseHasAssetsFolder(base)
            ? [`${base}/${rel}`]
            : [`${base}/${rel}`, `${base}/assets/${rel}`];
        let fileBuffer = null;
        let usedPath = null;
        for (const key of candidates) {
            try {
                fileBuffer = await (0, supabaseStorage_js_1.downloadFile)(supabaseStorage_js_1.BUCKETS.TEMPLATES, key);
                usedPath = key;
                break;
            }
            catch {
                // try next candidate
            }
        }
        if (fileBuffer) {
            res.setHeader('Content-Type', getMimeType(rel));
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('X-Template-Asset-Path', usedPath);
            res.send(fileBuffer);
            return;
        }
        console.warn(`[Templates] Supabase asset not found. Tried: ${candidates.join(' | ')}`);
        // fall through to local
    }
    // Local fallback (dev only)
    const fullPath = path_1.default.join(process.cwd(), template.assetsPath, normalized);
    const templateDir = path_1.default.join(process.cwd(), template.assetsPath);
    const resolvedPath = path_1.default.resolve(fullPath);
    if (!resolvedPath.startsWith(templateDir))
        throw new errorHandler_js_1.AppError('Invalid asset path', 403);
    if (!fs_1.default.existsSync(resolvedPath))
        throw new errorHandler_js_1.AppError('Asset not found', 404);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(resolvedPath);
}));
/**
 * GET /api/templates/:id/preview
 * Get template preview/thumbnail — PUBLIC.
 */
router.get('/:id/preview', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
        select: { thumbnailPath: true, name: true },
    });
    if (!template)
        throw new errorHandler_js_1.AppError('Template not found', 404);
    if (template.thumbnailPath) {
        if ((0, supabaseStorage_js_1.isSupabaseConfigured)()) {
            try {
                const fileBuffer = await (0, supabaseStorage_js_1.downloadFile)(supabaseStorage_js_1.BUCKETS.TEMPLATES, normalizeSupabasePath(template.thumbnailPath));
                res.setHeader('Content-Type', 'image/jpeg');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.send(fileBuffer);
                return;
            }
            catch {
                // fall through
            }
        }
        const thumbnailFullPath = path_1.default.join(process.cwd(), template.thumbnailPath);
        if (fs_1.default.existsSync(thumbnailFullPath))
            return res.sendFile(thumbnailFullPath);
    }
    res.status(404).json({
        message: 'No preview available',
        template: { id: req.params.id, name: template.name },
    });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES — admin auth required
// ═══════════════════════════════════════════════════════════════════════════════
router.use(auth_js_1.authenticateAdmin);
/**
 * GET /api/templates
 */
router.get('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { type, includeContent } = req.query;
    const where = {};
    if (type)
        where.type = type;
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
                eventsAsGuestbookVideo: true,
                eventsAsGuestbookAudio: true,
                eventsAsGuestbookPhoto: true,
                eventsAsBooth: true,
                eventsAsBoothVideo: true,
                eventsAsBoothAudio: true,
                eventsAsBoothPhoto: true,
                eventsAsThankYou: true,
                eventsAsLiveLanding: true,
                eventsAsEventEnded: true,
                eventsAsItineraryPage: true,
                eventsAsGiftingPage: true,
            },
        },
    };
    if (includeContent === 'true') {
        selectFields.htmlContent = true;
        selectFields.cssContent = true;
        selectFields.jsContent = true;
    }
    const templates = await prisma_js_1.default.template.findMany({
        where,
        orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
        select: selectFields,
    });
    const templatesWithUsage = templates.map((t) => ({
        ...t,
        usageCount: t._count.eventsAsInvitation +
            t._count.eventsAsRsvp +
            t._count.eventsAsGuestbook +
            t._count.eventsAsGuestbookVideo +
            t._count.eventsAsGuestbookAudio +
            t._count.eventsAsGuestbookPhoto +
            t._count.eventsAsBooth +
            t._count.eventsAsBoothVideo +
            t._count.eventsAsBoothAudio +
            t._count.eventsAsBoothPhoto +
            t._count.eventsAsThankYou +
            t._count.eventsAsLiveLanding +
            t._count.eventsAsEventEnded +
            t._count.eventsAsItineraryPage +
            t._count.eventsAsGiftingPage,
    }));
    res.json({ templates: templatesWithUsage });
}));
/**
 * GET /api/templates/:id
 */
router.get('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
        include: {
            eventsAsInvitation: { select: { id: true, name: true, slug: true } },
            eventsAsRsvp: { select: { id: true, name: true, slug: true } },
            eventsAsGuestbook: { select: { id: true, name: true, slug: true } },
            eventsAsThankYou: { select: { id: true, name: true, slug: true } },
            eventsAsItineraryPage: { select: { id: true, name: true, slug: true } },
            eventsAsGiftingPage: { select: { id: true, name: true, slug: true } },
        },
    });
    if (!template)
        throw new errorHandler_js_1.AppError('Template not found', 404);
    res.json({ template });
}));
/**
 * POST /api/templates
 */
router.post('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = validation_js_1.createTemplateSchema.parse(req.body);
    if (data.isDefault) {
        await prisma_js_1.default.template.updateMany({
            where: { type: data.type, isDefault: true },
            data: { isDefault: false },
        });
    }
    const template = await prisma_js_1.default.template.create({ data });
    res.status(201).json({ template });
}));
/**
 * PATCH /api/templates/:id
 */
router.patch('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = validation_js_1.updateTemplateSchema.partial().parse(req.body);
    const existing = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
    });
    if (!existing)
        throw new errorHandler_js_1.AppError('Template not found', 404);
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
                    eventsAsGuestbookVideo: true,
                    eventsAsGuestbookAudio: true,
                    eventsAsGuestbookPhoto: true,
                    eventsAsBooth: true,
                    eventsAsBoothVideo: true,
                    eventsAsBoothAudio: true,
                    eventsAsBoothPhoto: true,
                    eventsAsThankYou: true,
                    eventsAsLiveLanding: true,
                    eventsAsEventEnded: true,
                    eventsAsItineraryPage: true,
                    eventsAsGiftingPage: true,
                },
            },
        },
    });
    if (!template)
        throw new errorHandler_js_1.AppError('Template not found', 404);
    const totalUsage = template._count.eventsAsInvitation +
        template._count.eventsAsRsvp +
        template._count.eventsAsGuestbook +
        template._count.eventsAsGuestbookVideo +
        template._count.eventsAsGuestbookAudio +
        template._count.eventsAsGuestbookPhoto +
        template._count.eventsAsBooth +
        template._count.eventsAsBoothVideo +
        template._count.eventsAsBoothAudio +
        template._count.eventsAsBoothPhoto +
        template._count.eventsAsThankYou +
        template._count.eventsAsLiveLanding +
        template._count.eventsAsEventEnded +
        template._count.eventsAsItineraryPage +
        template._count.eventsAsGiftingPage;
    if (totalUsage > 0) {
        throw new errorHandler_js_1.AppError(`Cannot delete template in use by ${totalUsage} event(s)`, 400);
    }
    // Delete files in Supabase assets folder (non-recursive as per your constraint)
    if (template.assetsPath && (0, supabaseStorage_js_1.isSupabaseConfigured)()) {
        try {
            const base = normalizeSupabasePath(template.assetsPath);
            const files = await (0, supabaseStorage_js_1.listFiles)(supabaseStorage_js_1.BUCKETS.TEMPLATES, base);
            for (const f of files) {
                const key = `${base}/${normalizeSupabasePath(f.name)}`.replace(/\/+/g, '/');
                await (0, supabaseStorage_js_1.deleteFromSupabase)(supabaseStorage_js_1.BUCKETS.TEMPLATES, key);
            }
        }
        catch (err) {
            console.warn(`[Templates] Failed to delete Supabase assets for ${template.id}:`, err);
        }
    }
    await prisma_js_1.default.template.delete({ where: { id: req.params.id } });
    res.json({ message: 'Template deleted successfully' });
}));
/**
 * POST /api/templates/:id/duplicate
 * NOTE: This shares the same assetsPath (same Supabase folder). Keep if intended.
 */
router.post('/:id/duplicate', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const source = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
    });
    if (!source)
        throw new errorHandler_js_1.AppError('Template not found', 404);
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
// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE UPLOAD — ZIP extraction → Supabase Storage
// ═══════════════════════════════════════════════════════════════════════════════
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip'))
            cb(null, true);
        else
            cb(new Error('Only ZIP files are allowed'));
    },
});
router.post('/upload', upload.single('template'), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!req.file)
        throw new errorHandler_js_1.AppError('No file uploaded', 400);
    const { name, description, type } = req.body;
    if (!name || !name.trim())
        throw new errorHandler_js_1.AppError('Template name is required', 400);
    if (!type)
        throw new errorHandler_js_1.AppError('Template type is required', 400);
    const validTypes = [
        'INVITATION', 'RSVP', 'GUESTBOOK', 'GUESTBOOK_VIDEO', 'GUESTBOOK_AUDIO',
        'GUESTBOOK_PHOTO', 'BOOTH', 'BOOTH_VIDEO', 'BOOTH_AUDIO', 'BOOTH_PHOTO',
        'THANK_YOU', 'LIVE_LANDING', 'EVENT_ENDED', 'ITINERARY', 'GIFTING',
    ];
    if (!validTypes.includes(type)) {
        throw new errorHandler_js_1.AppError(`Invalid template type. Must be one of: ${validTypes.join(', ')}`, 400);
    }
    let zip;
    try {
        zip = new adm_zip_1.default(req.file.buffer);
        if (zip.getEntries().length === 0)
            throw new Error('ZIP file is empty');
    }
    catch (err) {
        throw new errorHandler_js_1.AppError(`Invalid ZIP file: ${err.message}`, 400);
    }
    const templateId = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const supabasePrefix = templateId;
    const entries = zip.getEntries();
    let wrapperPrefix = '';
    // Detect wrapper directory
    const topLevelDirs = new Set();
    const topLevelFiles = [];
    for (const entry of entries) {
        const parts = entry.entryName.split('/').filter(Boolean);
        if (entry.isDirectory && parts.length === 1)
            topLevelDirs.add(parts[0]);
        else if (!entry.isDirectory && parts.length === 1)
            topLevelFiles.push(parts[0]);
        else if (parts.length > 1)
            topLevelDirs.add(parts[0]);
    }
    if (topLevelDirs.size === 1 && topLevelFiles.length === 0) {
        wrapperPrefix = [...topLevelDirs][0] + '/';
        console.log(`[Templates] Detected wrapper directory: ${wrapperPrefix}`);
    }
    const stripWrapper = (entryName) => {
        if (wrapperPrefix && entryName.startsWith(wrapperPrefix))
            return entryName.slice(wrapperPrefix.length);
        return entryName;
    };
    let htmlContent = '';
    let cssContent = '';
    let jsContent = '';
    let thumbnailPath = null;
    const uploadedFiles = [];
    // Pass 1: load html/css/js
    for (const entry of entries) {
        if (entry.isDirectory)
            continue;
        if (entry.entryName.includes('__MACOSX'))
            continue;
        const relativePath = stripWrapper(entry.entryName);
        if (!relativePath)
            continue;
        const lowerName = relativePath.toLowerCase();
        const baseName = path_1.default.basename(lowerName);
        if (!htmlContent && (baseName === 'index.html' || lowerName.endsWith('.html'))) {
            htmlContent = entry.getData().toString('utf-8');
        }
        if (!cssContent && ['styles.css', 'style.css', 'main.css', 'index.css'].includes(baseName)) {
            cssContent = entry.getData().toString('utf-8');
        }
        else if (!cssContent && lowerName.endsWith('.css')) {
            cssContent = entry.getData().toString('utf-8');
        }
        if (!jsContent && ['script.js', 'main.js', 'index.js', 'app.js'].includes(baseName)) {
            jsContent = entry.getData().toString('utf-8');
        }
        else if (!jsContent && lowerName.endsWith('.js') && !lowerName.includes('node_modules')) {
            jsContent = entry.getData().toString('utf-8');
        }
    }
    if (!htmlContent)
        throw new errorHandler_js_1.AppError('No HTML file found in ZIP', 400);
    // Pass 2: upload files
    if ((0, supabaseStorage_js_1.isSupabaseConfigured)()) {
        let firstImagePath = null;
        for (const entry of entries) {
            if (entry.isDirectory)
                continue;
            if (entry.entryName.includes('__MACOSX'))
                continue;
            const relativePath = stripWrapper(entry.entryName);
            if (!relativePath)
                continue;
            const supabasePath = normalizeSupabasePath(`${supabasePrefix}/${relativePath}`);
            const contentType = getMimeType(relativePath);
            const fileBuffer = entry.getData();
            try {
                await (0, supabaseStorage_js_1.uploadToSupabase)(supabaseStorage_js_1.BUCKETS.TEMPLATES, supabasePath, fileBuffer, {
                    contentType,
                    upsert: true,
                });
                uploadedFiles.push(relativePath);
                if (!firstImagePath && /\.(jpe?g|png|webp|gif)$/i.test(relativePath)) {
                    if (/thumbnail|preview|cover/i.test(path_1.default.basename(relativePath)))
                        firstImagePath = supabasePath;
                    else if (!firstImagePath)
                        firstImagePath = supabasePath;
                }
            }
            catch (err) {
                console.warn(`[Templates] Failed to upload ${supabasePath}: ${err.message}`);
            }
        }
        if (firstImagePath)
            thumbnailPath = firstImagePath;
        console.log(`[Templates] Uploaded ${uploadedFiles.length} files to Supabase bucket "${supabaseStorage_js_1.BUCKETS.TEMPLATES}" prefix="${supabasePrefix}"`);
    }
    else {
        console.warn('[Templates] Supabase not configured — falling back to local disk');
        const extractPath = path_1.default.join(process.cwd(), 'templates', templateId);
        fs_1.default.mkdirSync(extractPath, { recursive: true });
        zip.extractAllTo(extractPath, true);
    }
    // Store assetsPath as the assets folder (preferred)
    const hasAssetsFolder = uploadedFiles.some(p => p === 'assets' || p.startsWith('assets/'));
    const assetsPathForDb = hasAssetsFolder ? `${supabasePrefix}/assets` : supabasePrefix;
    const template = await prisma_js_1.default.template.create({
        data: {
            name: name.trim(),
            description: description?.trim() || null,
            type,
            htmlContent,
            cssContent: cssContent || null,
            jsContent: jsContent || null,
            assetsPath: assetsPathForDb,
            thumbnailPath,
            isDefault: false,
        },
    });
    res.json({
        template,
        message: 'Template uploaded successfully',
        assets: {
            path: assetsPathForDb,
            thumbnail: thumbnailPath,
            hasCSS: !!cssContent,
            hasJS: !!jsContent,
            fileCount: uploadedFiles.length,
            storage: (0, supabaseStorage_js_1.isSupabaseConfigured)() ? 'supabase' : 'local',
        },
    });
}));
/**
 * GET /api/templates/:id/files
 */
router.get('/:id/files', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: req.params.id },
        select: { assetsPath: true, htmlContent: true, cssContent: true, jsContent: true },
    });
    if (!template)
        throw new errorHandler_js_1.AppError('Template not found', 404);
    const files = [];
    files.push({ name: 'index.html', type: 'html', size: template.htmlContent.length, editable: true });
    if (template.cssContent)
        files.push({ name: 'styles.css', type: 'css', size: template.cssContent.length, editable: true });
    if (template.jsContent)
        files.push({ name: 'script.js', type: 'javascript', size: template.jsContent.length, editable: true });
    if (template.assetsPath && (0, supabaseStorage_js_1.isSupabaseConfigured)()) {
        try {
            const base = normalizeSupabasePath(template.assetsPath);
            const supabaseFiles = await (0, supabaseStorage_js_1.listFiles)(supabaseStorage_js_1.BUCKETS.TEMPLATES, base);
            for (const f of supabaseFiles) {
                const ext = path_1.default.extname(f.name).toLowerCase();
                const displayName = baseHasAssetsFolder(base)
                    ? `assets/${f.name}`
                    : f.name.startsWith('assets/')
                        ? f.name
                        : `assets/${f.name}`;
                files.push({
                    name: displayName.replace(/\/+/g, '/'),
                    type: ext.slice(1) || 'file',
                    size: f.metadata?.size || 0,
                    editable: ['.html', '.css', '.js', '.json', '.txt', '.md'].includes(ext),
                });
            }
        }
        catch (err) {
            console.warn(`[Templates] Failed to list Supabase files for ${template.assetsPath}:`, err);
        }
    }
    res.json({ files });
}));
/**
 * GET /api/templates/:id/file-content
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
    if (!template)
        throw new errorHandler_js_1.AppError('Template not found', 404);
    if (filePath === 'index.html')
        return res.json({ content: template.htmlContent });
    if (filePath === 'styles.css')
        return res.json({ content: template.cssContent || '' });
    if (filePath === 'script.js')
        return res.json({ content: template.jsContent || '' });
    if (template.assetsPath && filePath.startsWith('assets/')) {
        const relativePath = filePath.replace(/^assets\//, '');
        const ext = path_1.default.extname(filePath).toLowerCase();
        const textExtensions = ['.html', '.css', '.js', '.json', '.txt', '.md', '.xml', '.svg'];
        if (!textExtensions.includes(ext))
            throw new errorHandler_js_1.AppError('File type not supported for editing', 400);
        if ((0, supabaseStorage_js_1.isSupabaseConfigured)()) {
            try {
                const key = `${normalizeSupabasePath(template.assetsPath)}/${normalizeSupabasePath(relativePath)}`;
                const buffer = await (0, supabaseStorage_js_1.downloadFile)(supabaseStorage_js_1.BUCKETS.TEMPLATES, key);
                return res.json({ content: buffer.toString('utf-8') });
            }
            catch {
                throw new errorHandler_js_1.AppError('File not found in storage', 404);
            }
        }
    }
    throw new errorHandler_js_1.AppError('File not found', 404);
}));
exports.default = router;
//# sourceMappingURL=templates.js.map