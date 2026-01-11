"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVideoThumbnail = generateVideoThumbnail;
exports.generateVideoThumbnailFromBuffer = generateVideoThumbnailFromBuffer;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const supabaseStorage_js_1 = require("./supabaseStorage.js");
/**
 * Generate a thumbnail from a video file stored in Supabase
 * Uses FFmpeg to extract a frame from the video
 *
 * @param videoPath - Path to video in Supabase storage (e.g., "eventId/video.mp4")
 * @param thumbnailPath - Desired path for thumbnail (e.g., "eventId/video-thumb.jpg")
 * @param timeOffset - Time in seconds to extract frame from (default: 1 second)
 * @returns Path to uploaded thumbnail in Supabase
 */
async function generateVideoThumbnail(videoPath, thumbnailPath, timeOffset = 1) {
    // Download video from Supabase to temporary location
    const tempDir = process.env.TMPDIR || '/tmp';
    const tempVideoPath = `${tempDir}/video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
    const tempThumbPath = `${tempDir}/thumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    try {
        // Download video file from Supabase
        const videoBuffer = await (0, supabaseStorage_js_1.downloadFile)(supabaseStorage_js_1.BUCKETS.MEDIA, videoPath);
        fs_1.default.writeFileSync(tempVideoPath, videoBuffer);
        // Generate thumbnail using FFmpeg
        await new Promise((resolve, reject) => {
            const ffmpeg = (0, child_process_1.spawn)('ffmpeg', [
                '-i', tempVideoPath,
                '-ss', timeOffset.toString(), // Seek to specified time
                '-vframes', '1', // Extract only 1 frame
                '-vf', 'scale=640:-1', // Resize to 640px width, maintain aspect ratio
                '-q:v', '2', // High quality JPEG (2 = very high quality)
                '-y', // Overwrite output file
                tempThumbPath,
            ]);
            let stderr = '';
            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`FFmpeg thumbnail generation failed with code ${code}: ${stderr}`));
                }
            });
            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg spawn error: ${error.message}`));
            });
        });
        // Read thumbnail file
        const thumbnailBuffer = fs_1.default.readFileSync(tempThumbPath);
        // Upload thumbnail to Supabase
        const { path: uploadedPath } = await (0, supabaseStorage_js_1.uploadToSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, thumbnailPath, thumbnailBuffer, {
            contentType: 'image/jpeg',
            metadata: {
                sourceVideo: videoPath,
                generatedAt: new Date().toISOString(),
            },
        });
        // Cleanup temporary files
        try {
            if (fs_1.default.existsSync(tempVideoPath))
                fs_1.default.unlinkSync(tempVideoPath);
            if (fs_1.default.existsSync(tempThumbPath))
                fs_1.default.unlinkSync(tempThumbPath);
        }
        catch (cleanupError) {
            console.warn('[Thumbnail] Failed to cleanup temp files:', cleanupError);
        }
        return uploadedPath;
    }
    catch (error) {
        // Cleanup on error
        try {
            if (fs_1.default.existsSync(tempVideoPath))
                fs_1.default.unlinkSync(tempVideoPath);
            if (fs_1.default.existsSync(tempThumbPath))
                fs_1.default.unlinkSync(tempThumbPath);
        }
        catch (cleanupError) {
            // Ignore cleanup errors
        }
        throw new Error(`Failed to generate video thumbnail: ${error.message}`);
    }
}
/**
 * Generate thumbnail from video buffer (for uploads)
 * More efficient as it avoids downloading from Supabase
 *
 * @param videoBuffer - Video file buffer
 * @param thumbnailPath - Desired path for thumbnail in Supabase
 * @param timeOffset - Time in seconds to extract frame from (default: 1 second)
 * @returns Path to uploaded thumbnail in Supabase
 */
async function generateVideoThumbnailFromBuffer(videoBuffer, thumbnailPath, timeOffset = 1) {
    const tempDir = process.env.TMPDIR || '/tmp';
    const tempVideoPath = `${tempDir}/video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
    const tempThumbPath = `${tempDir}/thumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    try {
        // Write video buffer to temp file
        fs_1.default.writeFileSync(tempVideoPath, videoBuffer);
        // Generate thumbnail using FFmpeg
        await new Promise((resolve, reject) => {
            const ffmpeg = (0, child_process_1.spawn)('ffmpeg', [
                '-i', tempVideoPath,
                '-ss', timeOffset.toString(),
                '-vframes', '1',
                '-vf', 'scale=640:-1',
                '-q:v', '2',
                '-y',
                tempThumbPath,
            ]);
            let stderr = '';
            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`FFmpeg thumbnail generation failed with code ${code}: ${stderr}`));
                }
            });
            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg spawn error: ${error.message}`));
            });
        });
        // Read thumbnail file
        const thumbnailBuffer = fs_1.default.readFileSync(tempThumbPath);
        // Upload thumbnail to Supabase
        const { path: uploadedPath } = await (0, supabaseStorage_js_1.uploadToSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, thumbnailPath, thumbnailBuffer, {
            contentType: 'image/jpeg',
            metadata: {
                generatedAt: new Date().toISOString(),
            },
        });
        // Cleanup temporary files
        try {
            if (fs_1.default.existsSync(tempVideoPath))
                fs_1.default.unlinkSync(tempVideoPath);
            if (fs_1.default.existsSync(tempThumbPath))
                fs_1.default.unlinkSync(tempThumbPath);
        }
        catch (cleanupError) {
            console.warn('[Thumbnail] Failed to cleanup temp files:', cleanupError);
        }
        return uploadedPath;
    }
    catch (error) {
        // Cleanup on error
        try {
            if (fs_1.default.existsSync(tempVideoPath))
                fs_1.default.unlinkSync(tempVideoPath);
            if (fs_1.default.existsSync(tempThumbPath))
                fs_1.default.unlinkSync(tempThumbPath);
        }
        catch (cleanupError) {
            // Ignore cleanup errors
        }
        throw new Error(`Failed to generate video thumbnail: ${error.message}`);
    }
}
//# sourceMappingURL=thumbnailGenerator.js.map