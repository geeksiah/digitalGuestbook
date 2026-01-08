import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import prisma from '../utils/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ReelOptions {
  eventId: string;
  outputName?: string;
  maxDuration?: number; // seconds
  transition?: 'fade' | 'dissolve' | 'none';
}

interface ReelStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputPath?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// In-memory job tracking (use Redis in production for multi-instance)
const reelJobs = new Map<string, ReelStatus>();

// Check if ffmpeg is available
export const checkFfmpegAvailable = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    ffmpeg.on('close', (code) => resolve(code === 0));
    ffmpeg.on('error', () => resolve(false));
  });
};

// Generate a unique job ID
const generateJobId = (): string => {
  return `reel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get video duration using ffprobe
const getVideoDuration = async (filePath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => { output += data.toString(); });
    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(parseFloat(output.trim()) || 0);
      } else {
        resolve(0); // Default to 0 if unable to get duration
      }
    });
    ffprobe.on('error', () => resolve(0));
  });
};

// Create concat file for ffmpeg
const createConcatFile = async (videos: { path: string; duration: number }[], outputDir: string): Promise<string> => {
  const concatFilePath = path.join(outputDir, `concat_${Date.now()}.txt`);
  const content = videos.map(v => `file '${v.path.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(concatFilePath, content);
  return concatFilePath;
};

// Generate reel using ffmpeg
export const generateReel = async (options: ReelOptions): Promise<string> => {
  const jobId = generateJobId();
  const { eventId, outputName, maxDuration = 300 } = options;

  // Initialize job status
  reelJobs.set(jobId, {
    id: jobId,
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
  });

  // Start async processing
  processReel(jobId, eventId, outputName || `reel-${eventId}`, maxDuration).catch((error) => {
    console.error(`[ReelGenerator] Job ${jobId} failed:`, error);
    const job = reelJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error.message;
    }
  });

  return jobId;
};

// Actual processing function (runs async)
const processReel = async (jobId: string, eventId: string, outputName: string, maxDuration: number): Promise<void> => {
  const job = reelJobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  job.progress = 5;

  // Check ffmpeg availability
  const ffmpegAvailable = await checkFfmpegAvailable();
  if (!ffmpegAvailable) {
    job.status = 'failed';
    job.error = 'FFmpeg not installed. Please install FFmpeg to generate reels.';
    return;
  }

  job.progress = 10;

  // Get all videos for the event
  const videos = await prisma.mediaAsset.findMany({
    where: { eventId, type: 'VIDEO' },
    orderBy: { createdAt: 'asc' },
  });

  if (videos.length === 0) {
    job.status = 'failed';
    job.error = 'No videos found for this event';
    return;
  }

  job.progress = 15;

  // Prepare video list with durations
  const baseDir = path.join(__dirname, '../..');
  const outputDir = path.join(baseDir, 'generated', 'reels', eventId);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const videoList: { path: string; duration: number }[] = [];
  let totalDuration = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    // Remove leading slash for proper path joining
    const relativePath = video.filePath.startsWith('/') 
      ? video.filePath.slice(1) 
      : video.filePath;
    const videoPath = path.join(baseDir, relativePath);
    
    if (!fs.existsSync(videoPath)) {
      console.warn(`[ReelGenerator] Video file not found: ${videoPath}`);
      continue;
    }

    const duration = video.duration || await getVideoDuration(videoPath);
    
    // Check if adding this video would exceed max duration
    if (totalDuration + duration > maxDuration && videoList.length > 0) {
      break;
    }

    videoList.push({ path: videoPath, duration });
    totalDuration += duration;

    job.progress = 15 + Math.floor((i / videos.length) * 20);
  }

  if (videoList.length === 0) {
    job.status = 'failed';
    job.error = 'No valid video files found';
    return;
  }

  job.progress = 40;

  // Create concat file
  const concatFile = await createConcatFile(videoList, outputDir);
  const outputPath = path.join(outputDir, `${outputName}-${Date.now()}.mp4`);

  job.progress = 45;

  // Run ffmpeg concatenation
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y', // Overwrite output
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath
    ]);

    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      // Parse progress from ffmpeg output
      const timeMatch = output.match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch && totalDuration > 0) {
        const seconds = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
        job.progress = 45 + Math.floor((seconds / totalDuration) * 50);
      }
    });

    ffmpeg.on('close', (code) => {
      // Clean up concat file
      try { fs.unlinkSync(concatFile); } catch {}

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      try { fs.unlinkSync(concatFile); } catch {}
      reject(error);
    });
  });

  // Success
  job.status = 'completed';
  job.progress = 100;
  job.outputPath = `/generated/reels/${eventId}/${path.basename(outputPath)}`;
  job.completedAt = new Date();

  // Log to database
  await prisma.auditLog.create({
    data: {
      eventId,
      action: 'REEL_GENERATED',
      entityType: 'MEDIA',
      details: JSON.stringify({
        jobId,
        videoCount: videoList.length,
        totalDuration,
        outputPath: job.outputPath,
      }),
    },
  });
};

// Get job status
export const getReelJobStatus = (jobId: string): ReelStatus | null => {
  return reelJobs.get(jobId) || null;
};

// Clean up old jobs (call periodically)
export const cleanupOldJobs = (): void => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const [jobId, job] of reelJobs.entries()) {
    if (job.createdAt.getTime() < oneHourAgo && (job.status === 'completed' || job.status === 'failed')) {
      reelJobs.delete(jobId);
    }
  }
};

// Clean up every hour
setInterval(cleanupOldJobs, 60 * 60 * 1000);

