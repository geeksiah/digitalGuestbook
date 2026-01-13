"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldJobs = exports.getEventReelJobs = exports.getReelJobStatus = exports.generateReel = exports.checkFfmpegAvailable = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const supabaseStorage_js_1 = require("./supabaseStorage.js");
// Database-backed job tracking for persistence
// Check if ffmpeg is available
const checkFfmpegAvailable = async () => {
    return new Promise((resolve) => {
        const ffmpeg = (0, child_process_1.spawn)('ffmpeg', ['-version']);
        ffmpeg.on('close', (code) => resolve(code === 0));
        ffmpeg.on('error', () => resolve(false));
    });
};
exports.checkFfmpegAvailable = checkFfmpegAvailable;
// Generate a unique job ID
const generateJobId = () => {
    return `reel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
// Get video duration using ffprobe
const getVideoDuration = async (filePath) => {
    return new Promise((resolve, reject) => {
        const ffprobe = (0, child_process_1.spawn)('ffprobe', [
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
            }
            else {
                resolve(0); // Default to 0 if unable to get duration
            }
        });
        ffprobe.on('error', () => resolve(0));
    });
};
// Create concat file for ffmpeg
const createConcatFile = async (videos, outputDir) => {
    const concatFilePath = path_1.default.join(outputDir, `concat_${Date.now()}.txt`);
    const content = videos.map(v => `file '${v.path.replace(/'/g, "'\\''")}'`).join('\n');
    fs_1.default.writeFileSync(concatFilePath, content);
    return concatFilePath;
};
// Generate reel using ffmpeg - creates a persistent database job
const generateReel = async (options) => {
    const { eventId, outputName, maxDuration = 300, eventDetails } = options;
    // Count videos first
    const videoCount = await prisma_js_1.default.mediaAsset.count({
        where: { eventId, type: 'VIDEO' },
    });
    // Create persistent job in database (using type assertion until Prisma client is regenerated)
    const job = await prisma_js_1.default.reelJob.create({
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
        await updateJobStatus(jobId, 'failed', { errorMessage: error.message });
    });
    return jobId;
};
exports.generateReel = generateReel;
// Generate intro/outro title cards using FFmpeg
const generateTitleCard = async (outputPath, title, subtitle, duration, primaryColor, secondaryColor) => {
    // Use drawtext filter to create a title card
    // Format colors for FFmpeg (remove # prefix if present)
    const bgColor = primaryColor.replace('#', '');
    const textColor = secondaryColor.replace('#', '');
    await new Promise((resolve, reject) => {
        const ffmpeg = (0, child_process_1.spawn)('ffmpeg', [
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
            if (code === 0)
                resolve();
            else
                reject(new Error(`Title card generation failed with code ${code}`));
        });
        ffmpeg.on('error', reject);
    });
};
// Helper to update job progress in database
const updateJobProgress = async (jobId, progress, status) => {
    await prisma_js_1.default.reelJob.update({
        where: { id: jobId },
        data: {
            progress,
            ...(status && { status }),
            ...(status === 'processing' && !progress && { startedAt: new Date() }),
        },
    });
};
const updateJobStatus = async (jobId, status, data) => {
    await prisma_js_1.default.reelJob.update({
        where: { id: jobId },
        data: {
            status,
            ...data,
            ...(status === 'completed' && { completedAt: new Date() }),
        },
    });
};
// Actual processing function (runs async)
const processReel = async (jobId, eventId, outputName, maxDuration, eventDetails) => {
    await updateJobProgress(jobId, 5, 'processing');
    // Check ffmpeg availability
    const ffmpegAvailable = await (0, exports.checkFfmpegAvailable)();
    if (!ffmpegAvailable) {
        await updateJobStatus(jobId, 'failed', { errorMessage: 'FFmpeg not installed. Please install FFmpeg to generate reels.' });
        return;
    }
    await updateJobProgress(jobId, 10);
    // Get all videos for the event
    const videos = await prisma_js_1.default.mediaAsset.findMany({
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
    const outputDir = path_1.default.join(baseDir, 'generated', 'reels', eventId);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    const videoList = [];
    let totalDuration = 0;
    // Track temporary video files for cleanup
    const tempVideoPaths = [];
    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        let videoPath = null;
        try {
            // Download video from Supabase Storage to temporary file
            const tempDir = process.env.TMPDIR || '/tmp';
            const tempVideoPath = path_1.default.join(tempDir, `reel_${jobId}_${i}_${Date.now()}.mp4`);
            console.log(`[ReelGenerator] [${jobId}] Downloading video ${i + 1}/${videos.length} from Supabase: ${video.filePath}`);
            const videoBuffer = await (0, supabaseStorage_js_1.downloadFile)(supabaseStorage_js_1.BUCKETS.MEDIA, video.filePath);
            fs_1.default.writeFileSync(tempVideoPath, videoBuffer);
            videoPath = tempVideoPath;
            tempVideoPaths.push(tempVideoPath);
            console.log(`[ReelGenerator] [${jobId}] Downloaded video to: ${tempVideoPath}`);
        }
        catch (error) {
            console.error(`[ReelGenerator] [${jobId}] Failed to download video ${video.filePath}:`, error.message);
            continue; // Skip this video and continue with next
        }
        if (!videoPath || !fs_1.default.existsSync(videoPath)) {
            await updateJobProgress(jobId, 15 + Math.floor((i / videos.length) * 15));
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
        // Cleanup temp files before returning
        for (const tempPath of tempVideoPaths) {
            try {
                if (fs_1.default.existsSync(tempPath))
                    fs_1.default.unlinkSync(tempPath);
            }
            catch { }
        }
        await updateJobStatus(jobId, 'failed', { errorMessage: 'No valid video files found' });
        return;
    }
    await updateJobProgress(jobId, 30);
    // Generate intro and outro cards if event details provided
    const primaryColor = eventDetails?.primaryColor || '#FFD700';
    const secondaryColor = eventDetails?.secondaryColor || '#1a1a2e';
    const introPath = path_1.default.join(outputDir, `intro-${Date.now()}.mp4`);
    const outroPath = path_1.default.join(outputDir, `outro-${Date.now()}.mp4`);
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
            await generateTitleCard(introPath, eventDetails.name, eventDetails.venue ? `${formattedDate} | ${eventDetails.venue}` : formattedDate, 4, // 4 seconds
            primaryColor, secondaryColor);
            videoList.unshift({ path: introPath, duration: 4 });
            // Generate outro card
            await generateTitleCard(outroPath, 'Thank You', `${eventDetails.name}`, 3, // 3 seconds
            primaryColor, secondaryColor);
            videoList.push({ path: outroPath, duration: 3 });
            await updateJobProgress(jobId, 40);
        }
        catch (error) {
            console.warn('[ReelGenerator] Failed to generate title cards, continuing without them:', error);
        }
    }
    await updateJobProgress(jobId, 45);
    const outputPath = path_1.default.join(outputDir, `${outputName}-${Date.now()}.mp4`);
    const transitionDuration = 0.5; // 0.5 second transitions
    await updateJobProgress(jobId, 50);
    // Use filter_complex with xfade for smooth transitions between clips
    await new Promise((resolve, reject) => {
        // Capture tempVideoPaths in closure for cleanup
        const tempFilesToCleanup = [...tempVideoPaths];
        const titleCards = eventDetails ? [introPath, outroPath] : [];
        // Helper function to handle ffmpeg process
        function handleFfmpegProcess(ffmpeg, jobId, totalDuration, resolve, reject, tempFilesToCleanup, concatFile, titleCards) {
            let lastProgressUpdate = 50;
            let lastUpdateTime = Date.now();
            const PROGRESS_UPDATE_INTERVAL = 2000; // Update every 2 seconds
            ffmpeg.stderr.on('data', async (data) => {
                const output = data.toString();
                // Parse progress from ffmpeg output - handle multiple time formats
                // Format 1: time=00:01:23.45
                // Format 2: time=00:01:23
                let timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                if (!timeMatch) {
                    timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
                }
                if (timeMatch && totalDuration > 0) {
                    const hours = parseInt(timeMatch[1], 10);
                    const minutes = parseInt(timeMatch[2], 10);
                    const secs = parseInt(timeMatch[3], 10);
                    const seconds = hours * 3600 + minutes * 60 + secs;
                    // Calculate progress: 50% (before FFmpeg) + 45% (during encoding) = 95%
                    // Reserve 5% for finalization
                    const encodingProgress = Math.min(seconds / totalDuration, 1);
                    const progress = Math.min(50 + Math.floor(encodingProgress * 45), 95);
                    // Update progress only if it increased significantly and enough time has passed
                    const now = Date.now();
                    if (progress > lastProgressUpdate && (now - lastUpdateTime) >= PROGRESS_UPDATE_INTERVAL) {
                        lastProgressUpdate = progress;
                        lastUpdateTime = now;
                        try {
                            await updateJobProgress(jobId, progress);
                            console.log(`[ReelGenerator] [${jobId}] Progress: ${progress}% (${seconds}s / ${totalDuration}s)`);
                        }
                        catch (error) {
                            console.error(`[ReelGenerator] [${jobId}] Failed to update progress:`, error);
                        }
                    }
                }
                // Log FFmpeg errors/warnings
                if (output.includes('error') || output.includes('Error')) {
                    console.error(`[ReelGenerator] [${jobId}] FFmpeg error: ${output.substring(0, 200)}`);
                }
            });
            ffmpeg.on('close', async (code) => {
                // Clean up temp files
                for (const file of concatFile) {
                    try {
                        if (fs_1.default.existsSync(file))
                            fs_1.default.unlinkSync(file);
                    }
                    catch { }
                }
                for (const card of titleCards) {
                    try {
                        if (fs_1.default.existsSync(card))
                            fs_1.default.unlinkSync(card);
                    }
                    catch { }
                }
                // Cleanup temporary video files
                for (const tempPath of tempFilesToCleanup) {
                    try {
                        if (fs_1.default.existsSync(tempPath))
                            fs_1.default.unlinkSync(tempPath);
                    }
                    catch { }
                }
                if (code === 0) {
                    // Update progress to 95% when FFmpeg completes successfully
                    try {
                        await updateJobProgress(jobId, 95);
                        console.log(`[ReelGenerator] [${jobId}] FFmpeg encoding completed successfully`);
                    }
                    catch (error) {
                        console.error(`[ReelGenerator] [${jobId}] Failed to update progress after encoding:`, error);
                    }
                    resolve();
                }
                else {
                    console.error(`[ReelGenerator] [${jobId}] FFmpeg exited with code ${code}`);
                    await updateJobStatus(jobId, 'failed', { errorMessage: `FFmpeg process failed with exit code ${code}` });
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });
            ffmpeg.on('error', async (error) => {
                console.error(`[ReelGenerator] [${jobId}] FFmpeg error:`, error);
                for (const file of concatFile) {
                    try {
                        if (fs_1.default.existsSync(file))
                            fs_1.default.unlinkSync(file);
                    }
                    catch { }
                }
                for (const card of titleCards) {
                    try {
                        if (fs_1.default.existsSync(card))
                            fs_1.default.unlinkSync(card);
                    }
                    catch { }
                }
                // Cleanup temporary video files
                for (const tempPath of tempFilesToCleanup) {
                    try {
                        if (fs_1.default.existsSync(tempPath))
                            fs_1.default.unlinkSync(tempPath);
                    }
                    catch { }
                }
                await updateJobStatus(jobId, 'failed', { errorMessage: `FFmpeg error: ${error.message}` });
                reject(error);
            });
        }
        if (videoList.length === 1) {
            // Single video - just copy with title cards
            const ffmpegArgs = [
                '-y',
                '-i', videoList[0].path,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '20',
                '-c:a', 'aac',
                '-b:a', '256k',
                '-ar', '48000',
                '-movflags', '+faststart',
                '-pix_fmt', 'yuv420p',
                outputPath
            ];
            const ffmpeg = (0, child_process_1.spawn)('ffmpeg', ffmpegArgs);
            handleFfmpegProcess(ffmpeg, jobId, totalDuration, resolve, reject, tempFilesToCleanup, [], titleCards);
        }
        else {
            // Multiple videos - use xfade for smooth transitions
            // Build filter_complex with xfade transitions
            const filterParts = [];
            const inputArgs = [];
            // Add all video inputs
            videoList.forEach((_, idx) => {
                inputArgs.push('-i', videoList[idx].path);
            });
            // Normalize all videos first (scale to 1920x1080, set fps to 30)
            videoList.forEach((_, idx) => {
                filterParts.push(`[${idx}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${idx}]`);
                filterParts.push(`[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo[a${idx}]`);
            });
            // Build xfade chain
            let currentVideo = 'v0';
            let currentAudio = 'a0';
            let offset = 0;
            for (let i = 0; i < videoList.length - 1; i++) {
                const nextVideo = `v${i + 1}`;
                const nextAudio = `a${i + 1}`;
                const outputVideo = i === videoList.length - 2 ? '[vout]' : `[v${i}x]`;
                const outputAudio = i === videoList.length - 2 ? '[aout]' : `[a${i}x]`;
                // Calculate transition offset (start transition 0.5s before video ends)
                const videoDuration = videoList[i].duration;
                const transitionStart = Math.max(0, videoDuration - transitionDuration);
                // Video xfade transition
                filterParts.push(`${currentVideo}${nextVideo}xfade=transition=fade:duration=${transitionDuration}:offset=${transitionStart}${outputVideo}`);
                // Audio crossfade
                filterParts.push(`${currentAudio}${nextAudio}acrossfade=d=${transitionDuration}${outputAudio}`);
                currentVideo = outputVideo.replace(/[\[\]]/g, '');
                currentAudio = outputAudio.replace(/[\[\]]/g, '');
                offset += videoDuration - transitionDuration;
            }
            const filterComplex = filterParts.join(';');
            const ffmpegArgs = [
                '-y',
                ...inputArgs,
                '-filter_complex', filterComplex,
                '-map', '[vout]',
                '-map', '[aout]',
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '20',
                '-c:a', 'aac',
                '-b:a', '256k',
                '-ar', '48000',
                '-movflags', '+faststart',
                '-pix_fmt', 'yuv420p',
                outputPath
            ];
            const ffmpeg = (0, child_process_1.spawn)('ffmpeg', ffmpegArgs);
            handleFfmpegProcess(ffmpeg, jobId, totalDuration, resolve, reject, tempFilesToCleanup, [], titleCards);
        }
    });
    // Update progress to 97% - finalizing
    await updateJobProgress(jobId, 97).catch(() => { });
    // Verify output file exists
    if (!fs_1.default.existsSync(outputPath)) {
        await updateJobStatus(jobId, 'failed', { errorMessage: 'Reel generation completed but output file not found' });
        console.error(`[ReelGenerator] [${jobId}] Output file not found: ${outputPath}`);
        return;
    }
    // Get file stats
    const stats = fs_1.default.statSync(outputPath);
    // Upload to Supabase Storage
    const reelFileName = `${outputName}-${Date.now()}.mp4`;
    const reelStoragePath = `${eventId}/${reelFileName}`;
    console.log(`[ReelGenerator] [${jobId}] Uploading reel to Supabase: ${reelStoragePath}`);
    // Update progress to 98% - uploading to Supabase
    await updateJobProgress(jobId, 98).catch(() => { });
    let supabasePath;
    try {
        const { path: uploadedPath } = await (0, supabaseStorage_js_1.uploadFileFromPath)(supabaseStorage_js_1.BUCKETS.REELS, reelStoragePath, outputPath, {
            contentType: 'video/mp4',
            metadata: {
                eventId,
                jobId,
                videoCount: videoList.length.toString(),
                duration: totalDuration.toString(),
            },
        });
        supabasePath = uploadedPath;
        console.log(`[ReelGenerator] [${jobId}] Reel uploaded to Supabase: ${uploadedPath}`);
        // Cleanup local file after successful upload
        try {
            if (fs_1.default.existsSync(outputPath))
                fs_1.default.unlinkSync(outputPath);
        }
        catch { }
    }
    catch (uploadError) {
        console.error(`[ReelGenerator] [${jobId}] Failed to upload reel to Supabase:`, uploadError.message);
        // Keep local path if Supabase upload fails
        supabasePath = `/generated/reels/${eventId}/${path_1.default.basename(outputPath)}`;
    }
    // Cleanup temporary video files
    for (const tempPath of tempVideoPaths) {
        try {
            if (fs_1.default.existsSync(tempPath))
                fs_1.default.unlinkSync(tempPath);
        }
        catch { }
    }
    // Update progress to 99% - saving to database
    await updateJobProgress(jobId, 99).catch(() => { });
    // Success - update database
    try {
        await updateJobStatus(jobId, 'completed', {
            outputPath: supabasePath,
            outputSize: stats.size,
            duration: Math.round(totalDuration),
        });
        // Update progress to 100%
        await updateJobProgress(jobId, 100);
        console.log(`[ReelGenerator] [${jobId}] Reel generated successfully: ${supabasePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB, ${Math.round(totalDuration)}s)`);
    }
    catch (error) {
        console.error(`[ReelGenerator] [${jobId}] Failed to save job status:`, error);
        await updateJobStatus(jobId, 'failed', { errorMessage: `Failed to save job status: ${error.message}` });
        throw error;
    }
    // Log to database
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: 'REEL_GENERATED',
            entityType: 'MEDIA',
            details: JSON.stringify({
                jobId,
                videoCount: videoList.length,
                totalDuration,
                outputPath: supabasePath,
                hasIntroOutro: !!eventDetails,
            }),
        },
    });
};
// Get job status from database
const getReelJobStatus = async (jobId) => {
    const job = await prisma_js_1.default.reelJob.findUnique({
        where: { id: jobId },
    });
    if (!job)
        return null;
    return {
        id: job.id,
        status: job.status,
        progress: job.progress,
        outputPath: job.outputPath || undefined,
        error: job.errorMessage || undefined,
        createdAt: job.createdAt,
        completedAt: job.completedAt || undefined,
    };
};
exports.getReelJobStatus = getReelJobStatus;
// Get all reel jobs for an event
const getEventReelJobs = async (eventId) => {
    const jobs = await prisma_js_1.default.reelJob.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
    });
    return jobs.map((job) => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        outputPath: job.outputPath || undefined,
        error: job.errorMessage || undefined,
        createdAt: job.createdAt,
        completedAt: job.completedAt || undefined,
    }));
};
exports.getEventReelJobs = getEventReelJobs;
// Clean up old failed jobs (keep completed ones)
const cleanupOldJobs = async () => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma_js_1.default.reelJob.deleteMany({
        where: {
            status: 'failed',
            createdAt: { lt: oneWeekAgo },
        },
    });
};
exports.cleanupOldJobs = cleanupOldJobs;
//# sourceMappingURL=reelGenerator.js.map