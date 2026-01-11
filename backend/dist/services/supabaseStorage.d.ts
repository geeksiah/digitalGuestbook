/**
 * Check if Supabase is configured
 */
export declare const isSupabaseConfigured: () => boolean;
/**
 * Storage bucket configuration
 *
 * Bucket Naming Guidelines:
 * - Use lowercase letters, numbers, and hyphens only
 * - Keep names descriptive but concise
 * - Must be unique within your Supabase project
 * - Cannot be changed after creation (need to recreate)
 */
export declare const BUCKETS: {
    readonly MEDIA: "media-assets";
    readonly REELS: "generated-reels";
    readonly TEMPLATES: "templates";
    readonly PDFS: "invitation-pdfs";
};
export type BucketName = typeof BUCKETS[keyof typeof BUCKETS];
/**
 * Upload a file to Supabase Storage
 */
export declare const uploadToSupabase: (bucket: BucketName, filePath: string, fileBuffer: Buffer, options?: {
    contentType?: string;
    metadata?: Record<string, string>;
    upsert?: boolean;
}) => Promise<{
    path: string;
    publicUrl: string;
}>;
/**
 * Upload from local filesystem to Supabase Storage
 */
export declare const uploadFileFromPath: (bucket: BucketName, filePath: string, localFilePath: string, options?: {
    contentType?: string;
    metadata?: Record<string, string>;
}) => Promise<{
    path: string;
    publicUrl: string;
}>;
/**
 * Download a file from Supabase Storage
 * Returns a signed URL that expires after specified seconds (default 1 hour)
 */
export declare const getSignedUrl: (bucket: BucketName, filePath: string, expiresIn?: number) => Promise<string>;
/**
 * Get public URL for a file (no expiration, requires bucket to be public)
 */
export declare const getPublicUrl: (bucket: BucketName, filePath: string) => string;
/**
 * Delete a file from Supabase Storage
 */
export declare const deleteFromSupabase: (bucket: BucketName, filePath: string) => Promise<void>;
/**
 * Check if a file exists in Supabase Storage
 */
export declare const fileExists: (bucket: BucketName, filePath: string) => Promise<boolean>;
/**
 * List files in a bucket folder
 */
export declare const listFiles: (bucket: BucketName, folderPath?: string) => Promise<Array<{
    name: string;
    id: string;
    updated_at: string;
    created_at: string;
    last_accessed_at: string;
    metadata: Record<string, any>;
}>>;
/**
 * Download file content as buffer
 */
export declare const downloadFile: (bucket: BucketName, filePath: string) => Promise<Buffer>;
/**
 * Ensure bucket exists, create if it doesn't
 */
export declare const ensureBucketExists: (bucket: BucketName) => Promise<void>;
/**
 * Initialize all required buckets
 */
export declare const initializeBuckets: () => Promise<void>;
//# sourceMappingURL=supabaseStorage.d.ts.map