"use strict";
// backend/src/services/supabaseStorage.ts
// ─── FULL REPLACEMENT ──────────────────────────────────────────────────────────
// Changes from original:
//   1. Added createSignedUploadUrl() for client-direct uploads
//   2. Added getMediaPublicUrl() convenience helper
//   3. Aggressive cacheControl for media uploads (1 year, immutable)
//   4. ensureBucketExists uses a local Set to avoid repeated API calls under load
//   5. TEMPLATES bucket is now PUBLIC (per spec)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeBuckets = exports.ensureBucketExists = exports.downloadFile = exports.listFiles = exports.fileExists = exports.deleteFromSupabase = exports.getPublicUrl = exports.getSignedUrl = exports.uploadFileFromPath = exports.buildPublicUrl = exports.createSignedUploadUrl = exports.uploadToSupabase = exports.BUCKETS = exports.isSupabaseConfigured = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ── Supabase client singleton ──────────────────────────────────────────────────
let supabaseClient = null;
const isSupabaseConfigured = () => {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
};
exports.isSupabaseConfigured = isSupabaseConfigured;
const getSupabaseClient = () => {
    if (supabaseClient)
        return supabaseClient;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for storage operations.');
    }
    supabaseClient = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return supabaseClient;
};
// ── Bucket configuration ───────────────────────────────────────────────────────
exports.BUCKETS = {
    MEDIA: 'media-assets',
    REELS: 'generated-reels',
    TEMPLATES: 'templates',
    PDFS: 'invitation-pdfs',
};
// ── Upload (existing, kept for backward compat + server-side usage) ────────────
const uploadToSupabase = async (bucket, filePath, fileBuffer, options = {}) => {
    const supabase = getSupabaseClient();
    await (0, exports.ensureBucketExists)(bucket);
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data, error } = await supabase.storage.from(bucket).upload(normalizedPath, fileBuffer, {
        contentType: options.contentType || 'application/octet-stream',
        metadata: options.metadata || {},
        upsert: options.upsert || false,
        cacheControl: options.cacheControl || '31536000, immutable', // 1 year
    });
    if (error) {
        console.error(`[Supabase Storage] Upload error for ${bucket}/${normalizedPath}:`, error);
        throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(normalizedPath);
    return { path: normalizedPath, publicUrl: publicUrlData.publicUrl };
};
exports.uploadToSupabase = uploadToSupabase;
// ── NEW: Create a signed upload URL so the CLIENT can upload directly ──────────
/**
 * Creates a short-lived signed URL that allows the client to PUT a file
 * directly to Supabase Storage without the backend buffering the data.
 *
 * The Supabase JS SDK's `createSignedUploadUrl` returns { signedUrl, token, path }.
 * The client PUTs with header `Authorization: Bearer <token>`.
 */
const createSignedUploadUrl = async (bucket, storagePath, options) => {
    const supabase = getSupabaseClient();
    await (0, exports.ensureBucketExists)(bucket);
    const normalizedPath = storagePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(normalizedPath, { upsert: options?.upsert ?? false });
    if (error) {
        console.error(`[Supabase Storage] Signed upload URL error: ${bucket}/${normalizedPath}`, error);
        throw new Error(`Failed to create signed upload URL: ${error.message}`);
    }
    return {
        signedUrl: data.signedUrl,
        token: data.token,
        path: normalizedPath,
    };
};
exports.createSignedUploadUrl = createSignedUploadUrl;
// ── NEW: Convenience public URL builder ────────────────────────────────────────
/**
 * Build the public URL for a media asset without an API call.
 * Works for any public bucket.
 */
const buildPublicUrl = (bucket, storagePath) => {
    const base = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const normalized = storagePath.replace(/^\/+/, '').replace(/\\/g, '/');
    return `${base}/storage/v1/object/public/${bucket}/${normalized}`;
};
exports.buildPublicUrl = buildPublicUrl;
// ── Upload from local filesystem ───────────────────────────────────────────────
const uploadFileFromPath = async (bucket, filePath, localFilePath, options = {}) => {
    const fileBuffer = fs_1.default.readFileSync(localFilePath);
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
    return (0, exports.uploadToSupabase)(bucket, filePath, fileBuffer, {
        contentType: options.contentType || contentTypeMap[ext] || 'application/octet-stream',
        metadata: options.metadata,
    });
};
exports.uploadFileFromPath = uploadFileFromPath;
// ── Signed download URL ────────────────────────────────────────────────────────
const getSignedUrl = async (bucket, filePath, expiresIn = 3600) => {
    const supabase = getSupabaseClient();
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(normalizedPath, expiresIn);
    if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
    }
    return data.signedUrl;
};
exports.getSignedUrl = getSignedUrl;
// ── Public URL (requires public bucket) ────────────────────────────────────────
const getPublicUrl = (bucket, filePath) => {
    const supabase = getSupabaseClient();
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedPath);
    return data.publicUrl;
};
exports.getPublicUrl = getPublicUrl;
// ── Delete ─────────────────────────────────────────────────────────────────────
const deleteFromSupabase = async (bucket, filePath) => {
    const supabase = getSupabaseClient();
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { error } = await supabase.storage.from(bucket).remove([normalizedPath]);
    if (error) {
        console.warn(`[Supabase Storage] Delete error for ${bucket}/${normalizedPath}:`, error.message);
    }
};
exports.deleteFromSupabase = deleteFromSupabase;
// ── File exists ────────────────────────────────────────────────────────────────
const fileExists = async (bucket, filePath) => {
    const supabase = getSupabaseClient();
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data, error } = await supabase.storage
        .from(bucket)
        .list(path_1.default.dirname(normalizedPath) || '.', { search: path_1.default.basename(normalizedPath) });
    if (error)
        return false;
    return data ? data.some((file) => file.name === path_1.default.basename(normalizedPath)) : false;
};
exports.fileExists = fileExists;
// ── List files ─────────────────────────────────────────────────────────────────
const listFiles = async (bucket, folderPath = '') => {
    const supabase = getSupabaseClient();
    const normalizedPath = folderPath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data, error } = await supabase.storage
        .from(bucket)
        .list(normalizedPath || '.', { sortBy: { column: 'created_at', order: 'desc' } });
    if (error)
        throw new Error(`Failed to list files: ${error.message}`);
    return data || [];
};
exports.listFiles = listFiles;
// ── Download file ──────────────────────────────────────────────────────────────
const downloadFile = async (bucket, filePath) => {
    const supabase = getSupabaseClient();
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const { data, error } = await supabase.storage.from(bucket).download(normalizedPath);
    if (error)
        throw new Error(`Failed to download file: ${error.message}`);
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
};
exports.downloadFile = downloadFile;
// ── Bucket initialization (cached to avoid repeated API calls under load) ──────
const initializedBuckets = new Set();
const ensureBucketExists = async (bucket) => {
    if (initializedBuckets.has(bucket))
        return; // fast path
    const supabase = getSupabaseClient();
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError)
        throw new Error(`Failed to check buckets: ${listError.message}`);
    const exists = buckets?.some((b) => b.name === bucket);
    if (exists) {
        initializedBuckets.add(bucket);
        return;
    }
    console.log(`[Supabase Storage] Creating bucket: ${bucket}`);
    // PUBLIC buckets: MEDIA (guest content) and TEMPLATES (per spec)
    const publicBuckets = [exports.BUCKETS.MEDIA, exports.BUCKETS.TEMPLATES];
    const isPublic = publicBuckets.includes(bucket);
    const bucketConfig = { public: isPublic };
    if (bucket === exports.BUCKETS.MEDIA) {
        bucketConfig.fileSizeLimit = 50 * 1024 * 1024;
        bucketConfig.allowedMimeTypes = ['image/*', 'video/*', 'audio/*'];
    }
    else if (bucket === exports.BUCKETS.TEMPLATES) {
        bucketConfig.fileSizeLimit = 50 * 1024 * 1024;
    }
    else if (bucket === exports.BUCKETS.PDFS) {
        bucketConfig.fileSizeLimit = 10 * 1024 * 1024;
        bucketConfig.allowedMimeTypes = ['application/pdf'];
    }
    const { error: createError } = await supabase.storage.createBucket(bucket, bucketConfig);
    if (createError) {
        // Race condition — check again
        const { data: buckets2 } = await supabase.storage.listBuckets();
        if (!buckets2?.some((b) => b.name === bucket)) {
            throw new Error(`Failed to create bucket: ${createError.message}`);
        }
    }
    else {
        console.log(`[Supabase Storage] Bucket created: ${bucket} (public: ${isPublic})`);
    }
    initializedBuckets.add(bucket);
};
exports.ensureBucketExists = ensureBucketExists;
const initializeBuckets = async () => {
    console.log('[Supabase Storage] Initializing buckets...');
    for (const bucket of Object.values(exports.BUCKETS)) {
        try {
            await (0, exports.ensureBucketExists)(bucket);
        }
        catch (error) {
            console.error(`[Supabase Storage] Failed to init bucket ${bucket}:`, error.message);
        }
    }
    console.log('[Supabase Storage] Bucket initialization complete');
};
exports.initializeBuckets = initializeBuckets;
//# sourceMappingURL=supabaseStorage.js.map