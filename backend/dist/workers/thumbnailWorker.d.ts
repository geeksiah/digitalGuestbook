export interface ThumbnailJob {
    mediaAssetId: string;
    storagePath: string;
    eventId: string;
    timeOffset?: number;
}
export declare function generateThumbnailForAsset(job: ThumbnailJob): Promise<string | null>;
/**
 * Fire-and-forget: enqueues thumbnail generation.
 * Returns immediately — does NOT block the upload response.
 */
export declare function enqueueThumbnail(job: ThumbnailJob): void;
//# sourceMappingURL=thumbnailWorker.d.ts.map