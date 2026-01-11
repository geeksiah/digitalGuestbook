import { spawn } from 'child_process';
import fs from 'fs';
import { downloadFile, uploadToSupabase, BUCKETS } from './supabaseStorage.js';

/**
 * Generate a thumbnail from a video file stored in Supabase
 * Uses FFmpeg to extract a frame from the video
 * 
 * @param videoPath - Path to video in Supabase storage (e.g., "eventId/video.mp4")
 * @param thumbnailPath - Desired path for thumbnail (e.g., "eventId/video-thumb.jpg")
 * @param timeOffset - Time in seconds to extract frame from (default: 1 second)
 * @returns Path to uploaded thumbnail in Supabase
 */
export async function generateVideoThumbnail(
  videoPath: string,
  thumbnailPath: string,
  timeOffset: number = 1
): Promise<string> {
  // Download video from Supabase to temporary location
  const tempDir = process.env.TMPDIR || '/tmp';
  const tempVideoPath = `${tempDir}/video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
  const tempThumbPath = `${tempDir}/thumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;

  try {
    // Download video file from Supabase
    const videoBuffer = await downloadFile(BUCKETS.MEDIA, videoPath);
    fs.writeFileSync(tempVideoPath, videoBuffer);

    // Generate thumbnail using FFmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
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
        } else {
          reject(new Error(`FFmpeg thumbnail generation failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });
    });

    // Read thumbnail file
    const thumbnailBuffer = fs.readFileSync(tempThumbPath);

    // Upload thumbnail to Supabase
    const { path: uploadedPath } = await uploadToSupabase(
      BUCKETS.MEDIA,
      thumbnailPath,
      thumbnailBuffer,
      {
        contentType: 'image/jpeg',
        metadata: {
          sourceVideo: videoPath,
          generatedAt: new Date().toISOString(),
        },
      }
    );

    // Cleanup temporary files
    try {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
    } catch (cleanupError) {
      console.warn('[Thumbnail] Failed to cleanup temp files:', cleanupError);
    }

    return uploadedPath;
  } catch (error: any) {
    // Cleanup on error
    try {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
    } catch (cleanupError) {
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
export async function generateVideoThumbnailFromBuffer(
  videoBuffer: Buffer,
  thumbnailPath: string,
  timeOffset: number = 1
): Promise<string> {
  const tempDir = process.env.TMPDIR || '/tmp';
  const tempVideoPath = `${tempDir}/video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
  const tempThumbPath = `${tempDir}/thumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;

  try {
    // Write video buffer to temp file
    fs.writeFileSync(tempVideoPath, videoBuffer);

    // Generate thumbnail using FFmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
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
        } else {
          reject(new Error(`FFmpeg thumbnail generation failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });
    });

    // Read thumbnail file
    const thumbnailBuffer = fs.readFileSync(tempThumbPath);

    // Upload thumbnail to Supabase
    const { path: uploadedPath } = await uploadToSupabase(
      BUCKETS.MEDIA,
      thumbnailPath,
      thumbnailBuffer,
      {
        contentType: 'image/jpeg',
        metadata: {
          generatedAt: new Date().toISOString(),
        },
      }
    );

    // Cleanup temporary files
    try {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
    } catch (cleanupError) {
      console.warn('[Thumbnail] Failed to cleanup temp files:', cleanupError);
    }

    return uploadedPath;
  } catch (error: any) {
    // Cleanup on error
    try {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    throw new Error(`Failed to generate video thumbnail: ${error.message}`);
  }
}

