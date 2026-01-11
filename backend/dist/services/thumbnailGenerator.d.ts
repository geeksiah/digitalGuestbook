/**
 * Generate a thumbnail from a video file stored in Supabase
 * Uses FFmpeg to extract a frame from the video
 *
 * @param videoPath - Path to video in Supabase storage (e.g., "eventId/video.mp4")
 * @param thumbnailPath - Desired path for thumbnail (e.g., "eventId/video-thumb.jpg")
 * @param timeOffset - Time in seconds to extract frame from (default: 1 second)
 * @returns Path to uploaded thumbnail in Supabase
 */
export declare function generateVideoThumbnail(videoPath: string, thumbnailPath: string, timeOffset?: number): Promise<string>;
/**
 * Generate thumbnail from video buffer (for uploads)
 * More efficient as it avoids downloading from Supabase
 *
 * @param videoBuffer - Video file buffer
 * @param thumbnailPath - Desired path for thumbnail in Supabase
 * @param timeOffset - Time in seconds to extract frame from (default: 1 second)
 * @returns Path to uploaded thumbnail in Supabase
 */
export declare function generateVideoThumbnailFromBuffer(videoBuffer: Buffer, thumbnailPath: string, timeOffset?: number): Promise<string>;
//# sourceMappingURL=thumbnailGenerator.d.ts.map