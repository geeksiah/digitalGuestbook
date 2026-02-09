import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { createTemplateSchema, updateTemplateSchema } from '../utils/validation.js';
import {
  uploadToSupabase,
  getPublicUrl,
  getSignedUrl,
  deleteFromSupabase,
  listFiles,
  downloadFile,
  BUCKETS,
  isSupabaseConfigured,
} from '../services/supabaseStorage.js';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// MIME type map for uploads
// ═══════════════════════════════════════════════════════════════════════════════
const MIME_MAP: Record<string, string> = {
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

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth) — must come BEFORE router.use(authenticateAdmin)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/templates/:id/assets/*
 * Serve template assets — PUBLIC (no auth).
 *
 * STRATEGY: The 'templates' Supabase bucket is PRIVATE, so we can't give
 * guests a direct public URL. Instead this route acts as a proxy:
 *   1. Look up the template's assetsPath (Supabase folder prefix)
 *   2. Download the requested file from Supabase
 *   3. Stream it to the browser with correct Content-Type and cache headers
 *
 * If Supabase is not configured (dev mode), falls back to local filesystem.
 */
router.get('/:id/assets/*', asyncHandler(async (req, res) => {
  const templateId = req.params.id;
  const assetPath = req.params[0]; // Everything after /assets/

  if (!assetPath) {
    throw new AppError('Asset path is required', 400);
  }

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: { assetsPath: true },
  });

  if (!template || !template.assetsPath) {
    throw new AppError('Template or assets not found', 404);
  }

  // Security: prevent path traversal
  const normalized = assetPath.replace(/\.\./g, '').replace(/\/\//g, '/');
  if (normalized !== assetPath || assetPath.includes('..')) {
    throw new AppError('Invalid asset path', 403);
  }

  // ── Try Supabase first ──
  if (isSupabaseConfigured()) {
    try {
      const supabasePath = `${template.assetsPath}/${normalized}`.replace(/\/+/g, '/').replace(/^\//, '');
      const fileBuffer = await downloadFile(BUCKETS.TEMPLATES, supabasePath);

      const contentType = getMimeType(normalized);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(fileBuffer);
      return;
    } catch (err: any) {
      console.warn(`[Templates] Supabase asset not found: ${template.assetsPath}/${normalized} — ${err.message}`);
      // Fall through to local filesystem
    }
  }

  // ── Fallback: local filesystem (dev only) ──
  const fullPath = path.join(process.cwd(), template.assetsPath, normalized);
  const templateDir = path.join(process.cwd(), template.assetsPath);
  const resolvedPath = path.resolve(fullPath);

  if (!resolvedPath.startsWith(templateDir)) {
    throw new AppError('Invalid asset path', 403);
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new AppError('Asset not found', 404);
  }

  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(resolvedPath);
}));

/**
 * GET /api/templates/:id/preview
 * Get template preview/thumbnail — PUBLIC.
 */
router.get('/:id/preview', asyncHandler(async (req, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
    select: { thumbnailPath: true, assetsPath: true, name: true },
  });

  if (!template) {
    throw new AppError('Template not found', 404);
  }

  if (template.thumbnailPath) {
    // Try Supabase
    if (isSupabaseConfigured()) {
      try {
        const fileBuffer = await downloadFile(BUCKETS.TEMPLATES, template.thumbnailPath);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(fileBuffer);
        return;
      } catch {
        // Fall through to local
      }
    }

    // Local fallback
    const thumbnailFullPath = path.join(process.cwd(), template.thumbnailPath);
    if (fs.existsSync(thumbnailFullPath)) {
      return res.sendFile(thumbnailFullPath);
    }
  }

  res.status(404).json({
    message: 'No preview available',
    template: { id: req.params.id, name: template.name },
  });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES — admin auth required
// ═══════════════════════════════════════════════════════════════════════════════
router.use(authenticateAdmin);

/**
 * GET /api/templates
 */
router.get('/', asyncHandler(async (req, res) => {
  const { type, includeContent } = req.query;
  const where: any = {};
  if (type) where.type = type;

  const selectFields: any = {
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

  if (includeContent === 'true') {
    selectFields.htmlContent = true;
    selectFields.cssContent = true;
    selectFields.jsContent = true;
  }

  const templates = await prisma.template.findMany({
    where,
    orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    select: selectFields,
  });

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

  if (!template) throw new AppError('Template not found', 404);
  res.json({ template });
}));

/**
 * POST /api/templates
 */
router.post('/', asyncHandler(async (req, res) => {
  const data = createTemplateSchema.parse(req.body);

  if (data.isDefault) {
    await prisma.template.updateMany({
      where: { type: data.type, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await prisma.template.create({ data });
  res.status(201).json({ template });
}));

/**
 * PATCH /api/templates/:id
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const data = updateTemplateSchema.partial().parse(req.body);

  const existing = await prisma.template.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw new AppError('Template not found', 404);

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

  if (!template) throw new AppError('Template not found', 404);

  const totalUsage =
    template._count.eventsAsInvitation +
    template._count.eventsAsRsvp +
    template._count.eventsAsGuestbook +
    template._count.eventsAsThankYou;

  if (totalUsage > 0) {
    throw new AppError(`Cannot delete template in use by ${totalUsage} event(s)`, 400);
  }

  // Delete assets from Supabase
  if (template.assetsPath && isSupabaseConfigured()) {
    try {
      const files = await listFiles(BUCKETS.TEMPLATES, template.assetsPath);
      for (const file of files) {
        await deleteFromSupabase(BUCKETS.TEMPLATES, `${template.assetsPath}/${file.name}`);
      }
    } catch (err) {
      console.warn(`[Templates] Failed to delete Supabase assets for ${template.id}:`, err);
    }
  }

  await prisma.template.delete({ where: { id: req.params.id } });
  res.json({ message: 'Template deleted successfully' });
}));

/**
 * POST /api/templates/:id/duplicate
 */
router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const source = await prisma.template.findUnique({
    where: { id: req.params.id },
  });
  if (!source) throw new AppError('Template not found', 404);

  const template = await prisma.template.create({
    data: {
      name: `${source.name} (Copy)`,
      description: source.description,
      type: source.type,
      htmlContent: source.htmlContent,
      cssContent: source.cssContent,
      jsContent: source.jsContent,
      assetsPath: source.assetsPath, // shares same Supabase folder
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

// Use memory storage — we upload to Supabase, not local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
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
 * Upload template ZIP → extract in memory → upload all files to Supabase.
 *
 * Supabase structure:
 *   templates bucket:
 *     {templateId}/index.html
 *     {templateId}/assets/images/bg.jpg
 *     {templateId}/assets/fonts/...
 *     {templateId}/thumbnail.jpg
 *
 * The DB stores:
 *   assetsPath = "{templateId}"   (Supabase folder prefix)
 *   thumbnailPath = "{templateId}/thumbnail.jpg"
 */
router.post('/upload', upload.single('template'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No file uploaded', 400);

  const { name, description, type } = req.body;

  if (!name || !name.trim()) throw new AppError('Template name is required', 400);
  if (!type) throw new AppError('Template type is required', 400);

  const validTypes = [
    'INVITATION', 'RSVP', 'GUESTBOOK', 'GUESTBOOK_VIDEO', 'GUESTBOOK_AUDIO',
    'GUESTBOOK_PHOTO', 'BOOTH', 'BOOTH_VIDEO', 'BOOTH_AUDIO', 'BOOTH_PHOTO',
    'THANK_YOU', 'LIVE_LANDING', 'EVENT_ENDED',
  ];

  if (!validTypes.includes(type)) {
    throw new AppError(`Invalid template type. Must be one of: ${validTypes.join(', ')}`, 400);
  }

  // Parse ZIP from memory buffer
  let zip: AdmZip;
  try {
    zip = new AdmZip(req.file.buffer);
    if (zip.getEntries().length === 0) throw new Error('ZIP file is empty');
  } catch (err: any) {
    throw new AppError(`Invalid ZIP file: ${err.message}`, 400);
  }

  const templateId = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const supabasePrefix = templateId; // Folder in Supabase "templates" bucket

  // ── Detect wrapper directory ──
  const entries = zip.getEntries();
  let wrapperPrefix = '';

  // Check if all files are inside a single top-level directory
  const topLevelDirs = new Set<string>();
  const topLevelFiles: string[] = [];
  for (const entry of entries) {
    const parts = entry.entryName.split('/').filter(Boolean);
    if (entry.isDirectory && parts.length === 1) {
      topLevelDirs.add(parts[0]);
    } else if (!entry.isDirectory && parts.length === 1) {
      topLevelFiles.push(parts[0]);
    } else if (parts.length > 1) {
      topLevelDirs.add(parts[0]);
    }
  }

  if (topLevelDirs.size === 1 && topLevelFiles.length === 0) {
    wrapperPrefix = [...topLevelDirs][0] + '/';
    console.log(`[Templates] Detected wrapper directory: ${wrapperPrefix}`);
  }

  // ── Extract content ──
  let htmlContent = '';
  let cssContent = '';
  let jsContent = '';
  let thumbnailPath: string | null = null;
  const uploadedFiles: string[] = [];

  // Helper: strip wrapper prefix from entry name
  const stripWrapper = (entryName: string): string => {
    if (wrapperPrefix && entryName.startsWith(wrapperPrefix)) {
      return entryName.slice(wrapperPrefix.length);
    }
    return entryName;
  };

  // ── Pass 1: Find HTML/CSS/JS content files ──
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (entry.entryName.includes('__MACOSX')) continue;

    const relativePath = stripWrapper(entry.entryName);
    if (!relativePath) continue;

    const lowerName = relativePath.toLowerCase();
    const baseName = path.basename(lowerName);

    // HTML (required)
    if (!htmlContent && (baseName === 'index.html' || lowerName.endsWith('.html'))) {
      htmlContent = entry.getData().toString('utf-8');
    }

    // CSS (optional)
    if (!cssContent && ['styles.css', 'style.css', 'main.css', 'index.css'].includes(baseName)) {
      cssContent = entry.getData().toString('utf-8');
    } else if (!cssContent && lowerName.endsWith('.css')) {
      cssContent = entry.getData().toString('utf-8');
    }

    // JS (optional)
    if (!jsContent && ['script.js', 'main.js', 'index.js', 'app.js'].includes(baseName)) {
      jsContent = entry.getData().toString('utf-8');
    } else if (!jsContent && lowerName.endsWith('.js') && !lowerName.includes('node_modules')) {
      jsContent = entry.getData().toString('utf-8');
    }
  }

  if (!htmlContent) {
    throw new AppError('No HTML file found in ZIP', 400);
  }

  // ── Pass 2: Upload ALL files to Supabase ──
  if (isSupabaseConfigured()) {
    let firstImagePath: string | null = null;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (entry.entryName.includes('__MACOSX')) continue;

      const relativePath = stripWrapper(entry.entryName);
      if (!relativePath) continue;

      const supabasePath = `${supabasePrefix}/${relativePath}`;
      const contentType = getMimeType(relativePath);
      const fileBuffer = entry.getData();

      try {
        await uploadToSupabase(BUCKETS.TEMPLATES, supabasePath, fileBuffer, {
          contentType,
          upsert: true,
        });
        uploadedFiles.push(relativePath);

        // Track first image for thumbnail
        if (!firstImagePath && /\.(jpe?g|png|webp|gif)$/i.test(relativePath)) {
          // Prefer files named thumbnail/preview/cover
          if (/thumbnail|preview|cover/i.test(path.basename(relativePath))) {
            firstImagePath = supabasePath;
          } else if (!firstImagePath) {
            firstImagePath = supabasePath;
          }
        }
      } catch (err: any) {
        console.warn(`[Templates] Failed to upload ${supabasePath}: ${err.message}`);
      }
    }

    // Use first image as thumbnail (or generate later)
    if (firstImagePath) {
      thumbnailPath = firstImagePath;
    }

    console.log(`[Templates] Uploaded ${uploadedFiles.length} files to Supabase bucket "${BUCKETS.TEMPLATES}" prefix="${supabasePrefix}"`);
  } else {
    // Fallback: local disk (development only)
    console.warn('[Templates] Supabase not configured — falling back to local disk');
    const extractPath = path.join(process.cwd(), 'templates', templateId);
    fs.mkdirSync(extractPath, { recursive: true });
    zip.extractAllTo(extractPath, true);
  }

  // ── Create DB record ──
  const template = await prisma.template.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      type,
      htmlContent,
      cssContent: cssContent || null,
      jsContent: jsContent || null,
      assetsPath: supabasePrefix,      // Supabase folder prefix
      thumbnailPath,                    // Supabase path to thumbnail
      isDefault: false,
    },
  });

  console.log(`[Templates] Created template id=${template.id} name=${template.name} type=${template.type} files=${uploadedFiles.length}`);

  res.json({
    template,
    message: 'Template uploaded successfully',
    assets: {
      path: supabasePrefix,
      thumbnail: thumbnailPath,
      hasCSS: !!cssContent,
      hasJS: !!jsContent,
      fileCount: uploadedFiles.length,
      storage: isSupabaseConfigured() ? 'supabase' : 'local',
    },
  });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// FILE LISTING & CONTENT (admin)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/templates/:id/files
 * List all files in template
 */
router.get('/:id/files', asyncHandler(async (req, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
    select: { assetsPath: true, htmlContent: true, cssContent: true, jsContent: true },
  });

  if (!template) throw new AppError('Template not found', 404);

  const files: any[] = [];

  files.push({ name: 'index.html', type: 'html', size: template.htmlContent.length, editable: true });
  if (template.cssContent) {
    files.push({ name: 'styles.css', type: 'css', size: template.cssContent.length, editable: true });
  }
  if (template.jsContent) {
    files.push({ name: 'script.js', type: 'javascript', size: template.jsContent.length, editable: true });
  }

  // List from Supabase
  if (template.assetsPath && isSupabaseConfigured()) {
    try {
      const supabaseFiles = await listFiles(BUCKETS.TEMPLATES, template.assetsPath);
      for (const f of supabaseFiles) {
        const ext = path.extname(f.name).toLowerCase();
        files.push({
          name: `assets/${f.name}`,
          type: ext.slice(1) || 'file',
          size: f.metadata?.size || 0,
          editable: ['.html', '.css', '.js', '.json', '.txt', '.md'].includes(ext),
        });
      }
    } catch (err) {
      console.warn(`[Templates] Failed to list Supabase files for ${template.assetsPath}:`, err);
    }
  }

  // Fallback: local filesystem
  if (template.assetsPath && !isSupabaseConfigured()) {
    const assetsFullPath = path.join(process.cwd(), template.assetsPath);
    if (fs.existsSync(assetsFullPath)) {
      const listLocal = (dir: string, basePath: string = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const relativePath = path.join(basePath, entry.name);
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            files.push({ name: relativePath, type: 'directory', editable: false });
            listLocal(fullPath, relativePath);
          } else {
            const stats = fs.statSync(fullPath);
            const ext = path.extname(entry.name).toLowerCase();
            files.push({
              name: relativePath,
              type: ext.slice(1) || 'file',
              size: stats.size,
              editable: ['.html', '.css', '.js', '.json', '.txt', '.md'].includes(ext),
            });
          }
        }
      };
      listLocal(assetsFullPath, 'assets');
    }
  }

  res.json({ files });
}));

/**
 * GET /api/templates/:id/file-content
 * Get content of a specific file
 */
router.get('/:id/file-content', asyncHandler(async (req, res) => {
  const { filePath } = req.query;

  if (!filePath || typeof filePath !== 'string') {
    throw new AppError('File path is required', 400);
  }

  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
    select: { htmlContent: true, cssContent: true, jsContent: true, assetsPath: true },
  });

  if (!template) throw new AppError('Template not found', 404);

  // Main files from DB
  if (filePath === 'index.html') return res.json({ content: template.htmlContent });
  if (filePath === 'styles.css') return res.json({ content: template.cssContent || '' });
  if (filePath === 'script.js') return res.json({ content: template.jsContent || '' });

  // Asset files from Supabase
  if (template.assetsPath && filePath.startsWith('assets/')) {
    const relativePath = filePath.replace('assets/', '');
    const ext = path.extname(filePath).toLowerCase();
    const textExtensions = ['.html', '.css', '.js', '.json', '.txt', '.md', '.xml', '.svg'];

    if (!textExtensions.includes(ext)) {
      throw new AppError('File type not supported for editing', 400);
    }

    if (isSupabaseConfigured()) {
      try {
        const buffer = await downloadFile(BUCKETS.TEMPLATES, `${template.assetsPath}/${relativePath}`);
        return res.json({ content: buffer.toString('utf-8') });
      } catch {
        throw new AppError('File not found in storage', 404);
      }
    }

    // Local fallback
    const fullPath = path.join(process.cwd(), template.assetsPath, relativePath);
    const templateDir = path.join(process.cwd(), template.assetsPath);
    const resolvedPath = path.resolve(fullPath);

    if (!resolvedPath.startsWith(templateDir) || !fs.existsSync(resolvedPath)) {
      throw new AppError('File not found', 404);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return res.json({ content });
  }

  throw new AppError('File not found', 404);
}));

export default router;