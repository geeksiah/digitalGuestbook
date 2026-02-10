// backend/src/services/supabaseStorage.ts
// ─── FULL REPLACEMENT ──────────────────────────────────────────────────────────
// Changes from original:
//   1. Added createSignedUploadUrl() for client-direct uploads
//   2. Added getMediaPublicUrl() convenience helper
//   3. Aggressive cacheControl for media uploads (1 year, immutable)
//   4. ensureBucketExists uses a local Set to avoid repeated API calls under load
//   5. TEMPLATES bucket is now PUBLIC (per spec)

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ── Supabase client singleton ──────────────────────────────────────────────────
let supabaseClient: SupabaseClient | null = null;

export const isSupabaseConfigured = (): boolean => {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
};

const getSupabaseClient = (): SupabaseClient => {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for storage operations.'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
};

// ── Bucket configuration ───────────────────────────────────────────────────────
export const BUCKETS = {
  MEDIA: 'media-assets' as const,
  REELS: 'generated-reels' as const,
  TEMPLATES: 'templates' as const,
  PDFS: 'invitation-pdfs' as const,
};
export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// ── Upload (existing, kept for backward compat + server-side usage) ────────────
export const uploadToSupabase = async (
  bucket: BucketName,
  filePath: string,
  fileBuffer: Buffer,
  options: {
    contentType?: string;
    metadata?: Record<string, string>;
    upsert?: boolean;
    cacheControl?: string;
  } = {}
): Promise<{ path: string; publicUrl: string }> => {
  const supabase = getSupabaseClient();
  await ensureBucketExists(bucket);

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

// ── NEW: Create a signed upload URL so the CLIENT can upload directly ──────────
/**
 * Creates a short-lived signed URL that allows the client to PUT a file
 * directly to Supabase Storage without the backend buffering the data.
 *
 * The Supabase JS SDK's `createSignedUploadUrl` returns { signedUrl, token, path }.
 * The client PUTs with header `Authorization: Bearer <token>`.
 */
export const createSignedUploadUrl = async (
  bucket: BucketName,
  storagePath: string,
  options?: { upsert?: boolean }
): Promise<{ signedUrl: string; token: string; path: string }> => {
  const supabase = getSupabaseClient();
  await ensureBucketExists(bucket);

  const normalizedPath = storagePath.replace(/^\/+/, '').replace(/\\/g, '/');

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(normalizedPath, { upsert: options?.upsert ?? false } as any);

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

// ── NEW: Convenience public URL builder ────────────────────────────────────────
/**
 * Build the public URL for a media asset without an API call.
 * Works for any public bucket.
 */
export const buildPublicUrl = (bucket: BucketName, storagePath: string): string => {
  const base = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const normalized = storagePath.replace(/^\/+/, '').replace(/\\/g, '/');
  return `${base}/storage/v1/object/public/${bucket}/${normalized}`;
};

// ── Upload from local filesystem ───────────────────────────────────────────────
export const uploadFileFromPath = async (
  bucket: BucketName,
  filePath: string,
  localFilePath: string,
  options: { contentType?: string; metadata?: Record<string, string> } = {}
): Promise<{ path: string; publicUrl: string }> => {
  const fileBuffer = fs.readFileSync(localFilePath);
  const ext = path.extname(localFilePath).toLowerCase();
  const contentTypeMap: Record<string, string> = {
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
  return uploadToSupabase(bucket, filePath, fileBuffer, {
    contentType: options.contentType || contentTypeMap[ext] || 'application/octet-stream',
    metadata: options.metadata,
  });
};

// ── Signed download URL ────────────────────────────────────────────────────────
export const getSignedUrl = async (
  bucket: BucketName,
  filePath: string,
  expiresIn = 3600
): Promise<string> => {
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

// ── Public URL (requires public bucket) ────────────────────────────────────────
export const getPublicUrl = (bucket: BucketName, filePath: string): string => {
  const supabase = getSupabaseClient();
  const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
  const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedPath);
  return data.publicUrl;
};

// ── Delete ─────────────────────────────────────────────────────────────────────
export const deleteFromSupabase = async (bucket: BucketName, filePath: string): Promise<void> => {
  const supabase = getSupabaseClient();
  const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
  const { error } = await supabase.storage.from(bucket).remove([normalizedPath]);
  if (error) {
    console.warn(`[Supabase Storage] Delete error for ${bucket}/${normalizedPath}:`, error.message);
  }
};

// ── File exists ────────────────────────────────────────────────────────────────
export const fileExists = async (bucket: BucketName, filePath: string): Promise<boolean> => {
  const supabase = getSupabaseClient();
  const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path.dirname(normalizedPath) || '.', { search: path.basename(normalizedPath) });

  if (error) return false;
  return data ? data.some((file) => file.name === path.basename(normalizedPath)) : false;
};

// ── List files ─────────────────────────────────────────────────────────────────
export const listFiles = async (
  bucket: BucketName,
  folderPath = ''
): Promise<
  Array<{
    name: string;
    id: string;
    updated_at: string;
    created_at: string;
    last_accessed_at: string;
    metadata: Record<string, any>;
  }>
> => {
  const supabase = getSupabaseClient();
  const normalizedPath = folderPath.replace(/^\/+/, '').replace(/\\/g, '/');

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(normalizedPath || '.', { sortBy: { column: 'created_at', order: 'desc' } });

  if (error) throw new Error(`Failed to list files: ${error.message}`);
  return data || [];
};

// ── Download file ──────────────────────────────────────────────────────────────
export const downloadFile = async (bucket: BucketName, filePath: string): Promise<Buffer> => {
  const supabase = getSupabaseClient();
  const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');

  const { data, error } = await supabase.storage.from(bucket).download(normalizedPath);
  if (error) throw new Error(`Failed to download file: ${error.message}`);

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

// ── Bucket initialization (cached to avoid repeated API calls under load) ──────
const initializedBuckets = new Set<string>();

export const ensureBucketExists = async (bucket: BucketName): Promise<void> => {
  if (initializedBuckets.has(bucket)) return; // fast path

  const supabase = getSupabaseClient();

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Failed to check buckets: ${listError.message}`);

  const exists = buckets?.some((b) => b.name === bucket);
  if (exists) {
    initializedBuckets.add(bucket);
    return;
  }

  console.log(`[Supabase Storage] Creating bucket: ${bucket}`);

  // PUBLIC buckets: MEDIA (guest content) and TEMPLATES (per spec)
  const publicBuckets: string[] = [BUCKETS.MEDIA, BUCKETS.TEMPLATES];
  const isPublic = publicBuckets.includes(bucket);

  const bucketConfig: any = { public: isPublic };

  if (bucket === BUCKETS.MEDIA) {
    bucketConfig.fileSizeLimit = 50 * 1024 * 1024;
    bucketConfig.allowedMimeTypes = ['image/*', 'video/*', 'audio/*'];
  } else if (bucket === BUCKETS.TEMPLATES) {
    bucketConfig.fileSizeLimit = 50 * 1024 * 1024;
  } else if (bucket === BUCKETS.PDFS) {
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
  } else {
    console.log(`[Supabase Storage] Bucket created: ${bucket} (public: ${isPublic})`);
  }

  initializedBuckets.add(bucket);
};

export const initializeBuckets = async (): Promise<void> => {
  console.log('[Supabase Storage] Initializing buckets...');
  for (const bucket of Object.values(BUCKETS)) {
    try {
      await ensureBucketExists(bucket);
    } catch (error: any) {
      console.error(`[Supabase Storage] Failed to init bucket ${bucket}:`, error.message);
    }
  }
  console.log('[Supabase Storage] Bucket initialization complete');
};