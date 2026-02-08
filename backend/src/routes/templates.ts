import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import sharp from 'sharp'; // npm install sharp
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

/**
 * POST /api/templates
 * Create new template
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
 * IMPROVED: Better asset handling, thumbnail generation, preview support
 */
router.post('/upload', upload.single('template'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const { name, description, type } = req.body;
  
  // Validation
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
  const validTypes = [
    'INVITATION', 'RSVP', 'GUESTBOOK', 'GUESTBOOK_VIDEO', 'GUESTBOOK_AUDIO', 
    'GUESTBOOK_PHOTO', 'BOOTH', 'BOOTH_VIDEO', 'BOOTH_AUDIO', 'BOOTH_PHOTO', 
    'THANK_YOU', 'LIVE_LANDING', 'EVENT_ENDED'
  ];
  
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

    // Create unique template ID
    const templateId = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract ZIP to permanent location
    const extractPath = path.join(templatesDir, templateId);
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true, force: true });
    }
    fs.mkdirSync(extractPath, { recursive: true });
    zip.extractAllTo(extractPath, true);

    console.log(`[Templates] Extracted ZIP to ${extractPath}`);

    // Look for template files
    const indexPath = path.join(extractPath, 'index.html');
    const cssPath = path.join(extractPath, 'styles.css');
    const jsPath = path.join(extractPath, 'script.js');

    let htmlContent = '';
    let cssContent = '';
    let jsContent = '';

    // Find HTML file (required)
    if (fs.existsSync(indexPath)) {
      htmlContent = fs.readFileSync(indexPath, 'utf-8');
    } else {
      // Try to find any HTML file
      const files = fs.readdirSync(extractPath);
      const htmlFile = files.find(f => f.toLowerCase().endsWith('.html'));
      if (htmlFile) {
        htmlContent = fs.readFileSync(path.join(extractPath, htmlFile), 'utf-8');
      } else {
        throw new AppError('No HTML file found in ZIP', 400);
      }
    }

    // Find CSS file (optional)
    if (fs.existsSync(cssPath)) {
      cssContent = fs.readFileSync(cssPath, 'utf-8');
    } else {
      const files = fs.readdirSync(extractPath);
      const cssFile = files.find(f => f.toLowerCase().endsWith('.css'));
      if (cssFile) {
        cssContent = fs.readFileSync(path.join(extractPath, cssFile), 'utf-8');
      }
    }

    // Find JS file (optional)
    if (fs.existsSync(jsPath)) {
      jsContent = fs.readFileSync(jsPath, 'utf-8');
    } else {
      const files = fs.readdirSync(extractPath);
      const jsFile = files.find(f => f.toLowerCase().endsWith('.js'));
      if (jsFile) {
        jsContent = fs.readFileSync(path.join(extractPath, jsFile), 'utf-8');
      }
    }

    // Generate thumbnail from first image found or create placeholder
    let thumbnailPath: string | null = null;
    
    const findThumbnail = (dir: string): string | null => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          const found = findThumbnail(fullPath);
          if (found) return found;
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
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

    const sourceThumbnail = findThumbnail(extractPath);
    
    if (sourceThumbnail) {
      // Generate optimized thumbnail
      const thumbnailFilename = `${templateId}_thumbnail.jpg`;
      const thumbnailOutputPath = path.join(templatesDir, 'thumbnails', thumbnailFilename);
      
      const thumbnailsDir = path.join(templatesDir, 'thumbnails');
      if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
      }

      try {
        await sharp(sourceThumbnail)
          .resize(400, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(thumbnailOutputPath);
        
        thumbnailPath = `templates/thumbnails/${thumbnailFilename}`;
        console.log(`[Templates] Generated thumbnail at ${thumbnailPath}`);
      } catch (thumbError) {
        console.error('[Templates] Failed to generate thumbnail:', thumbError);
      }
    }

    // Store relative assets path (from templates directory)
    const assetsPath = `templates/${templateId}`;

    // Create template record in database
    const template = await prisma.template.create({
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
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
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

  } catch (error: any) {
    // Clean up on error
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('[Templates] Upload failed:', error);
    throw error;
  }
}));

/**
 * GET /api/templates/:id/assets/*
 * Serve template assets (images, fonts, etc.)
 */
router.get('/:id/assets/*', asyncHandler(async (req, res) => {
  const templateId = req.params.id;
  const assetPath = req.params[0]; // Everything after /assets/

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: { assetsPath: true },
  });

  if (!template || !template.assetsPath) {
    throw new AppError('Template or assets not found', 404);
  }

  // Construct full file path
  const fullPath = path.join(
    process.cwd(),
    template.assetsPath,
    assetPath
  );

  // Security: ensure path is within template directory
  const templateDir = path.join(process.cwd(), template.assetsPath);
  const resolvedPath = path.resolve(fullPath);
  
  if (!resolvedPath.startsWith(templateDir)) {
    throw new AppError('Invalid asset path', 403);
  }

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new AppError('Asset not found', 404);
  }

  // Serve the file
  res.sendFile(resolvedPath);
}));

/**
 * GET /api/templates/:id/preview
 * Get template preview/thumbnail
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
    const thumbnailFullPath = path.join(process.cwd(), template.thumbnailPath);
    
    if (fs.existsSync(thumbnailFullPath)) {
      return res.sendFile(thumbnailFullPath);
    }
  }

  // Return placeholder if no thumbnail
  res.status(404).json({ 
    message: 'No preview available',
    template: {
      id: req.params.id,
      name: template.name,
    }
  });
}));

/**
 * GET /api/templates/:id/files
 * List all files in template (for editing)
 */
router.get('/:id/files', asyncHandler(async (req, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
    select: { assetsPath: true, htmlContent: true, cssContent: true, jsContent: true },
  });

  if (!template) {
    throw new AppError('Template not found', 404);
  }

  const files: any[] = [];

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
    const assetsFullPath = path.join(process.cwd(), template.assetsPath);
    
    if (fs.existsSync(assetsFullPath)) {
      const listFiles = (dir: string, basePath: string = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const relativePath = path.join(basePath, entry.name);
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            files.push({
              name: relativePath,
              type: 'directory',
              editable: false,
            });
            listFiles(fullPath, relativePath);
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

      listFiles(assetsFullPath, 'assets');
    }
  }

  res.json({ files });
}));

/**
 * GET /api/templates/:id/file-content
 * Get content of a specific file in template
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

  if (!template) {
    throw new AppError('Template not found', 404);
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
    const fullPath = path.join(
      process.cwd(),
      template.assetsPath,
      filePath.replace('assets/', '')
    );

    // Security check
    const templateDir = path.join(process.cwd(), template.assetsPath);
    const resolvedPath = path.resolve(fullPath);
    
    if (!resolvedPath.startsWith(templateDir)) {
      throw new AppError('Invalid file path', 403);
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new AppError('File not found', 404);
    }

    // Check if file is text-based
    const ext = path.extname(filePath).toLowerCase();
    const textExtensions = ['.html', '.css', '.js', '.json', '.txt', '.md', '.xml', '.svg'];
    
    if (textExtensions.includes(ext)) {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      return res.json({ content });
    } else {
      throw new AppError('File type not supported for editing', 400);
    }
  }

  throw new AppError('File not found', 404);
}));

export default router;