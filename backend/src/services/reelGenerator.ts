import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import prisma from '../utils/prisma.js';

interface EventDetails {
  name: string;
  date: Date | string;
  venue: string | null;
  primaryColor?: string;
  secondaryColor?: string;
}

interface ReelOptions {
  eventId: string;
  outputName?: string;
  maxDuration?: number; // seconds
  transition?: 'fade' | 'dissolve' | 'none';
  eventDetails?: EventDetails;
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

// Database-backed job tracking for persistence

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

// Generate reel using ffmpeg - creates a persistent database job
export const generateReel = async (options: ReelOptions): Promise<string> => {
  const { eventId, outputName, maxDuration = 300, eventDetails } = options;

  // Count videos first
  const videoCount = await prisma.mediaAsset.count({
    where: { eventId, type: 'VIDEO' },
  });

  // Create persistent job in database
  const job = await prisma.reelJob.create({
    data: {
      eventId,
      status: 'pending',
      progress: 0,
      maxDuration,
      videoCount,
    },
  });

  const jobId = job.id;

  // Start async processing
  processReel(jobId, eventId, outputName || `reel-${eventId}`, maxDuration, eventDetails).catch(async (error) => {
    console.error(`[ReelGenerator] Job ${jobId} failed:`, error);
    await prisma.reelJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error.message,
      },
    });
  });

  return jobId;
};

// Generate intro/outro title cards using FFmpeg
const generateTitleCard = async (
  outputPath: string,
  title: string,
  subtitle: string,
  duration: number,
  primaryColor: string,
  secondaryColor: string
): Promise<void> => {
  // Use drawtext filter to create a title card
  // Format colors for FFmpeg (remove # prefix if present)
  const bgColor = primaryColor.replace('#', '');
  const textColor = secondaryColor.replace('#', '');
  
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=${bgColor}:s=1920x1080:d=${duration}`,
      '-vf', [
        `drawtext=text='${title.replace(/'/g, "\\'")}':fontsize=72:fontcolor=${textColor}:x=(w-text_w)/2:y=(h-text_h)/2-50:font=Arial`,
        `drawtext=text='${subtitle.replace(/'/g, "\\'")}':fontsize=36:fontcolor=${textColor}:x=(w-text_w)/2:y=(h+text_h)/2+20:font=Arial`,
      ].join(','),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-t', duration.toString(),
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Title card generation failed with code ${code}`));
    });
    ffmpeg.on('error', reject);
  });
};

// Helper to update job progress in database
const updateJobProgress = async (jobId: string, progress: number, status?: string) => {
  await prisma.reelJob.update({
    where: { id: jobId },
    data: {
      progress,
      ...(status && { status }),
      ...(status === 'processing' && !progress && { startedAt: new Date() }),
    },
  });
};

const updateJobStatus = async (jobId: string, status: string, data?: { outputPath?: string; outputSize?: number; duration?: number; errorMessage?: string }) => {
  await prisma.reelJob.update({
    where: { id: jobId },
    data: {
      status,
      ...data,
      ...(status === 'completed' && { completedAt: new Date() }),
    },
  });
};

// Actual processing function (runs async)
const processReel = async (
  jobId: string, 
  eventId: string, 
  outputName: string, 
  maxDuration: number,
  eventDetails?: EventDetails
): Promise<void> => {
  await updateJobProgress(jobId, 5, 'processing');

  // Check ffmpeg availability
  const ffmpegAvailable = await checkFfmpegAvailable();
  if (!ffmpegAvailable) {
    await updateJobStatus(jobId, 'failed', { errorMessage: 'FFmpeg not installed. Please install FFmpeg to generate reels.' });
    return;
  }

  await updateJobProgress(jobId, 10);

  // Get all videos for the event
  const videos = await prisma.mediaAsset.findMany({
    where: { eventId, type: 'VIDEO' },
    orderBy: { createdAt: 'asc' },
  });

  if (videos.length === 0) {
    await updateJobStatus(jobId, 'failed', { errorMessage: 'No videos found for this event' });
    return;
  }

  await updateJobProgress(jobId, 15);

  // Prepare video list with durations
  const baseDir = process.cwd();
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

    await updateJobProgress(jobId, 15 + Math.floor((i / videos.length) * 15));
  }

  if (videoList.length === 0) {
    await updateJobStatus(jobId, 'failed', { errorMessage: 'No valid video files found' });
    return;
  }

  await updateJobProgress(jobId, 30);

  // Generate intro and outro cards if event details provided
  const primaryColor = eventDetails?.primaryColor || '#FFD700';
  const secondaryColor = eventDetails?.secondaryColor || '#1a1a2e';
  const introPath = path.join(outputDir, `intro-${Date.now()}.mp4`);
  const outroPath = path.join(outputDir, `outro-${Date.now()}.mp4`);

  if (eventDetails) {
    try {
      // Format date
      const eventDate = new Date(eventDetails.date);
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Generate intro card
      await generateTitleCard(
        introPath,
        eventDetails.name,
        eventDetails.venue ? `${formattedDate} | ${eventDetails.venue}` : formattedDate,
        4, // 4 seconds
        primaryColor,
        secondaryColor
      );
      videoList.unshift({ path: introPath, duration: 4 });

      // Generate outro card
      await generateTitleCard(
        outroPath,
        'Thank You',
        `${eventDetails.name}`,
        3, // 3 seconds
        primaryColor,
        secondaryColor
      );
      videoList.push({ path: outroPath, duration: 3 });

      await updateJobProgress(jobId, 40);
    } catch (error) {
      console.warn('[ReelGenerator] Failed to generate title cards, continuing without them:', error);
    }
  }

  await updateJobProgress(jobId, 45);

  // Create concat file with fade transitions
  const concatFile = await createConcatFile(videoList, outputDir);
  const outputPath = path.join(outputDir, `${outputName}-${Date.now()}.mp4`);

  await updateJobProgress(jobId, 50);

  // Run ffmpeg concatenation with crossfade between clips
  // Using a more sophisticated filter for professional look
  await new Promise<void>((resolve, reject) => {
    const ffmpegArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '20', // Higher quality
      '-c:a', 'aac',
      '-b:a', '256k', // Higher audio bitrate
      '-ar', '48000', // Audio sample rate
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p', // Compatibility
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    ffmpeg.stderr.on('data', async (data) => {
      const output = data.toString();
      // Parse progress from ffmpeg output
      const timeMatch = output.match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch && totalDuration > 0) {
        const seconds = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
        const progress = 50 + Math.floor((seconds / totalDuration) * 45);
        // Throttle db updates to avoid too many writes
        if (Math.random() < 0.1) { // Update ~10% of the time
          await updateJobProgress(jobId, progress).catch(() => {});
        }
      }
    });

    ffmpeg.on('close', (code) => {
      // Clean up temp files
      try { fs.unlinkSync(concatFile); } catch {}
      try { if (eventDetails) fs.unlinkSync(introPath); } catch {}
      try { if (eventDetails) fs.unlinkSync(outroPath); } catch {}

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      try { fs.unlinkSync(concatFile); } catch {}
      try { if (eventDetails) fs.unlinkSync(introPath); } catch {}
      try { if (eventDetails) fs.unlinkSync(outroPath); } catch {}
      reject(error);
    });
  });

  // Get file stats
  const stats = fs.statSync(outputPath);
  const reelOutputPath = `/generated/reels/${eventId}/${path.basename(outputPath)}`;

  // Success - update database
  await updateJobStatus(jobId, 'completed', {
    outputPath: reelOutputPath,
    outputSize: stats.size,
    duration: Math.round(totalDuration),
  });

  // Update progress to 100%
  await updateJobProgress(jobId, 100);

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
        outputPath: reelOutputPath,
        hasIntroOutro: !!eventDetails,
      }),
    },
  });
};

// Get job status from database
export const getReelJobStatus = async (jobId: string): Promise<ReelStatus | null> => {
  const job = await prisma.reelJob.findUnique({
    where: { id: jobId },
  });
  
  if (!job) return null;
  
  return {
    id: job.id,
    status: job.status as 'pending' | 'processing' | 'completed' | 'failed',
    progress: job.progress,
    outputPath: job.outputPath || undefined,
    error: job.errorMessage || undefined,
    createdAt: job.createdAt,
    completedAt: job.completedAt || undefined,
  };
};

// Get all reel jobs for an event
export const getEventReelJobs = async (eventId: string): Promise<ReelStatus[]> => {
  const jobs = await prisma.reelJob.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
  });
  
  return jobs.map(job => ({
    id: job.id,
    status: job.status as 'pending' | 'processing' | 'completed' | 'failed',
    progress: job.progress,
    outputPath: job.outputPath || undefined,
    error: job.errorMessage || undefined,
    createdAt: job.createdAt,
    completedAt: job.completedAt || undefined,
  }));
};

// Clean up old failed jobs (keep completed ones)
export const cleanupOldJobs = async (): Promise<void> => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  await prisma.reelJob.deleteMany({
    where: {
      status: 'failed',
      createdAt: { lt: oneWeekAgo },
    },
  });
};

