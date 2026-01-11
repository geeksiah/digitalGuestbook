"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeBuckets = exports.ensureBucketExists = exports.downloadFile = exports.listFiles = exports.fileExists = exports.deleteFromSupabase = exports.getPublicUrl = exports.getSignedUrl = exports.uploadFileFromPath = exports.uploadToSupabase = exports.BUCKETS = exports.isSupabaseConfigured = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Supabase client singleton
let supabaseClient = null;
/**
 * Check if Supabase is configured
 */
const isSupabaseConfigured = () => {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
};
exports.isSupabaseConfigured = isSupabaseConfigured;
const getSupabaseClient = () => {
    if (supabaseClient) {
        return supabaseClient;
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.warn('[Supabase Storage] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set - storage operations will fail');
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for storage operations. Please configure these in your environment variables.');
    }
    supabaseClient = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    return supabaseClient;
};
/**
 * Storage bucket configuration
 *
 * Bucket Naming Guidelines:
 * - Use lowercase letters, numbers, and hyphens only
 * - Keep names descriptive but concise
 * - Must be unique within your Supabase project
 * - Cannot be changed after creation (need to recreate)
 */
exports.BUCKETS = {
    MEDIA: 'media-assets', // Event media (photos, videos, audio) - PUBLIC for direct access
    REELS: 'generated-reels', // Generated video reels - PRIVATE (require authentication)
    TEMPLATES: 'templates', // Template files - PRIVATE (admin only)
    PDFS: 'invitation-pdfs', // Generated PDF invitations - PRIVATE (sensitive data)
};
/**
 * Upload a file to Supabase Storage
 */
const uploadToSupabase = async (bucket, filePath, fileBuffer, options = {}) => {
    const supabase = getSupabaseClient();
    // Ensure bucket exists
    await (0, exports.ensureBucketExists)(bucket);
    // Normalize path (remove leading slash, use forward slashes)
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    // Upload file
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(normalizedPath, fileBuffer, {
        contentType: options.contentType || 'application/octet-stream',
        metadata: options.metadata || {},
        upsert: options.upsert || false,
        cacheControl: '3600', // Cache for 1 hour
    });
    if (error) {
        console.error(`[Supabase Storage] Upload error for ${bucket}/${normalizedPath}:`, error);
        throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }
    // Get public URL
    const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(normalizedPath);
    return {
        path: normalizedPath,
        publicUrl: publicUrlData.publicUrl,
    };
};
exports.uploadToSupabase = uploadToSupabase;
/**
 * Upload from local filesystem to Supabase Storage
 */
const uploadFileFromPath = async (bucket, filePath, localFilePath, options = {}) => {
    // Read file from local filesystem
    const fileBuffer = fs_1.default.readFileSync(localFilePath);
    // Determine content type from extension if not provided
    const ext = path_1.default.extname(localFilePath).toLowerCase();
    const contentTypeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.pdf': 'application/pdf',
        '.zip': 'application/zip',
    };
    const contentType = options.contentType || contentTypeMap[ext] || 'application/octet-stream';
    return (0, exports.uploadToSupabase)(bucket, filePath, fileBuffer, {
        contentType,
        metadata: options.metadata,
    });
};
exports.uploadFileFromPath = uploadFileFromPath;
/**
 * Download a file from Supabase Storage
 * Returns a signed URL that expires after specified seconds (default 1 hour)
 */
const getSignedUrl = async (bucket, filePath, expiresIn = 3600) => {
    const supabase = getSupabaseClient();
    // Normalize path
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(normalizedPath, expiresIn);
    if (error) {
        console.error(`[Supabase Storage] Signed URL error for ${bucket}/${normalizedPath}:`, error);
        throw new Error(`Failed to create signed URL: ${error.message}`);
    }
    return data.signedUrl;
};
exports.getSignedUrl = getSignedUrl;
/**
 * Get public URL for a file (no expiration, requires bucket to be public)
 */
const getPublicUrl = (bucket, filePath) => {
    const supabase = getSupabaseClient();
    // Normalize path
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(normalizedPath);
    return data.publicUrl;
};
exports.getPublicUrl = getPublicUrl;
/**
 * Delete a file from Supabase Storage
 */
const deleteFromSupabase = async (bucket, filePath) => {
    const supabase = getSupabaseClient();
    // Normalize path
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { error } = await supabase.storage
        .from(bucket)
        .remove([normalizedPath]);
    if (error) {
        console.error(`[Supabase Storage] Delete error for ${bucket}/${normalizedPath}:`, error);
        // Don't throw - file might not exist, log and continue
        console.warn(`[Supabase Storage] File may not exist: ${bucket}/${normalizedPath}`);
    }
};
exports.deleteFromSupabase = deleteFromSupabase;
/**
 * Check if a file exists in Supabase Storage
 */
const fileExists = async (bucket, filePath) => {
    const supabase = getSupabaseClient();
    // Normalize path
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data, error } = await supabase.storage
        .from(bucket)
        .list(path_1.default.dirname(normalizedPath) || '.', {
        search: path_1.default.basename(normalizedPath),
    });
    if (error) {
        return false;
    }
    return data ? data.some(file => file.name === path_1.default.basename(normalizedPath)) : false;
};
exports.fileExists = fileExists;
/**
 * List files in a bucket folder
 */
const listFiles = async (bucket, folderPath = '') => {
    const supabase = getSupabaseClient();
    // Normalize path
    const normalizedPath = folderPath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data, error } = await supabase.storage
        .from(bucket)
        .list(normalizedPath || '.', {
        sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) {
        console.error(`[Supabase Storage] List error for ${bucket}/${normalizedPath}:`, error);
        throw new Error(`Failed to list files: ${error.message}`);
    }
    return data || [];
};
exports.listFiles = listFiles;
/**
 * Download file content as buffer
 */
const downloadFile = async (bucket, filePath) => {
    const supabase = getSupabaseClient();
    // Normalize path
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data, error } = await supabase.storage
        .from(bucket)
        .download(normalizedPath);
    if (error) {
        console.error(`[Supabase Storage] Download error for ${bucket}/${normalizedPath}:`, error);
        throw new Error(`Failed to download file: ${error.message}`);
    }
    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
};
exports.downloadFile = downloadFile;
/**
 * Ensure bucket exists, create if it doesn't
 */
const ensureBucketExists = async (bucket) => {
    const supabase = getSupabaseClient();
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
        console.error('[Supabase Storage] Error listing buckets:', listError);
        throw new Error(`Failed to check buckets: ${listError.message}`);
    }
    const bucketExists = buckets?.some(b => b.name === bucket);
    if (!bucketExists) {
        console.log(`[Supabase Storage] Creating bucket: ${bucket}`);
        // Determine if bucket should be public based on type and security requirements
        // PUBLIC buckets: Direct URL access without authentication (use for public content)
        // PRIVATE buckets: Require signed URLs or authentication (use for sensitive data)
        const publicBuckets = [exports.BUCKETS.MEDIA]; // Media is public (event photos/videos for guests to view)
        const isPublic = publicBuckets.includes(bucket);
        // Security note:
        // - MEDIA: Public (event photos/videos are meant to be shared)
        // - REELS: Private (generated content, may contain sensitive moments)
        // - TEMPLATES: Private (admin assets, intellectual property)
        // - PDFS: Private (invitations contain access codes, personal info)
        // Configure bucket-specific settings
        const bucketConfig = {
            public: isPublic,
        };
        // Set file size limits and MIME types per bucket
        if (bucket === exports.BUCKETS.MEDIA) {
            bucketConfig.fileSizeLimit = 50 * 1024 * 1024; // 50MB for media files
            bucketConfig.allowedMimeTypes = ['image/*', 'video/*', 'audio/*'];
        }
        else if (bucket === exports.BUCKETS.REELS) {
            // No size limit for reels (can be large)
            bucketConfig.allowedMimeTypes = ['video/*'];
        }
        else if (bucket === exports.BUCKETS.TEMPLATES) {
            bucketConfig.fileSizeLimit = 50 * 1024 * 1024; // 50MB for templates
            bucketConfig.allowedMimeTypes = [
                'application/zip',
                'text/html',
                'text/css',
                'application/javascript',
                'application/json',
            ];
        }
        else if (bucket === exports.BUCKETS.PDFS) {
            bucketConfig.fileSizeLimit = 10 * 1024 * 1024; // 10MB for PDFs
            bucketConfig.allowedMimeTypes = ['application/pdf'];
        }
        const { error: createError } = await supabase.storage.createBucket(bucket, bucketConfig);
        if (createError) {
            // Bucket might already exist (race condition), check again
            const { data: buckets2 } = await supabase.storage.listBuckets();
            const stillMissing = !buckets2?.some(b => b.name === bucket);
            if (stillMissing) {
                console.error(`[Supabase Storage] Failed to create bucket ${bucket}:`, createError);
                throw new Error(`Failed to create bucket: ${createError.message}`);
            }
        }
        else {
            console.log(`[Supabase Storage] Bucket created: ${bucket} (public: ${isPublic})`);
        }
    }
};
exports.ensureBucketExists = ensureBucketExists;
/**
 * Initialize all required buckets
 */
const initializeBuckets = async () => {
    console.log('[Supabase Storage] Initializing buckets...');
    for (const bucket of Object.values(exports.BUCKETS)) {
        try {
            await (0, exports.ensureBucketExists)(bucket);
        }
        catch (error) {
            console.error(`[Supabase Storage] Failed to initialize bucket ${bucket}:`, error.message);
            // Don't throw - continue with other buckets
        }
    }
    console.log('[Supabase Storage] Bucket initialization complete');
};
exports.initializeBuckets = initializeBuckets;
//# sourceMappingURL=supabaseStorage.js.map