export declare const isSupabaseConfigured: () => boolean;
export declare const BUCKETS: {
    MEDIA: "media-assets";
    REELS: "generated-reels";
    TEMPLATES: "templates";
    PDFS: "invitation-pdfs";
};
export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
export declare const uploadToSupabase: (bucket: BucketName, filePath: string, fileBuffer: Buffer, options?: {
    contentType?: string;
    metadata?: Record<string, string>;
    upsert?: boolean;
    cacheControl?: string;
}) => Promise<{
    path: string;
    publicUrl: string;
}>;
/**
 * Creates a short-lived signed URL that allows the client to PUT a file
 * directly to Supabase Storage without the backend buffering the data.
 *
 * The Supabase JS SDK's `createSignedUploadUrl` returns { signedUrl, token, path }.
 * The client PUTs with header `Authorization: Bearer <token>`.
 */
export declare const createSignedUploadUrl: (bucket: BucketName, storagePath: string, options?: {
    upsert?: boolean;
}) => Promise<{
    signedUrl: string;
    token: string;
    path: string;
}>;
/**
 * Build the public URL for a media asset without an API call.
 * Works for any public bucket.
 */
export declare const buildPublicUrl: (bucket: BucketName, storagePath: string) => string;
export declare const uploadFileFromPath: (bucket: BucketName, filePath: string, localFilePath: string, options?: {
    contentType?: string;
    metadata?: Record<string, string>;
}) => Promise<{
    path: string;
    publicUrl: string;
}>;
export declare const getSignedUrl: (bucket: BucketName, filePath: string, expiresIn?: number) => Promise<string>;
export declare const getPublicUrl: (bucket: BucketName, filePath: string) => string;
export declare const deleteFromSupabase: (bucket: BucketName, filePath: string) => Promise<void>;
export declare const fileExists: (bucket: BucketName, filePath: string) => Promise<boolean>;
export declare const listFiles: (bucket: BucketName, folderPath?: string) => Promise<Array<{
    name: string;
    id: string;
    updated_at: string;
    created_at: string;
    last_accessed_at: string;
    metadata: Record<string, any>;
}>>;
export declare const downloadFile: (bucket: BucketName, filePath: string) => Promise<Buffer>;
export declare const ensureBucketExists: (bucket: BucketName) => Promise<void>;
export declare const initializeBuckets: () => Promise<void>;
//# sourceMappingURL=supabaseStorage.d.ts.map