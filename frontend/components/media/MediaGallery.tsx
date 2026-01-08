'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { API_BASE_URL, mediaApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface MediaAsset {
  id: string;
  type: 'VIDEO' | 'AUDIO' | 'PHOTO';
  guestName: string | null;
  filePath: string;
  fileName: string;
  fileSize?: number;
  duration: number | null;
  thumbnailPath: string | null;
  createdAt: string;
}

interface MediaStats {
  total: number;
  byType: { video: number; audio: number; photo: number };
  totalSizeMB: number;
  totalDurationSeconds: number;
}

interface MediaGalleryProps {
  eventId: string;
  eventSlug?: string;
  media: MediaAsset[];
  reelEnabled?: boolean;
  onRefresh?: () => void;
  isAdmin?: boolean;
}

// Icons
const Icons = {
  folder: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  video: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  audio: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
  photo: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  download: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  play: <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
  close: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  back: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  trash: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  reel: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
};

type ViewMode = 'folders' | 'videos' | 'audio' | 'photos';

export default function MediaGallery({ 
  eventId, 
  eventSlug, 
  media, 
  reelEnabled = false, 
  onRefresh,
  isAdmin = true 
}: MediaGalleryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('folders');
  const [previewMedia, setPreviewMedia] = useState<MediaAsset | null>(null);
  const [reelJobId, setReelJobId] = useState<string | null>(null);
  const [reelProgress, setReelProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Group media by type
  const videos = media.filter(m => m.type === 'VIDEO');
  const audioFiles = media.filter(m => m.type === 'AUDIO');
  const photos = media.filter(m => m.type === 'PHOTO');

  const folders = [
    { id: 'videos', label: 'Videos', count: videos.length, icon: Icons.video, color: 'bg-rose-50 text-rose-600 border-rose-200' },
    { id: 'audio', label: 'Audio Messages', count: audioFiles.length, icon: Icons.audio, color: 'bg-violet-50 text-violet-600 border-violet-200' },
    { id: 'photos', label: 'Photos', count: photos.length, icon: Icons.photo, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  ];

  const getCurrentMedia = () => {
    switch (viewMode) {
      case 'videos': return videos;
      case 'audio': return audioFiles;
      case 'photos': return photos;
      default: return media;
    }
  };

  const handleFolderClick = (folderId: string) => {
    setViewMode(folderId as ViewMode);
  };

  const handleBack = () => {
    setViewMode('folders');
  };

  const handleDownloadAll = async () => {
    try {
      toast.loading('Preparing download...', { id: 'download' });
      const response = await mediaApi.downloadAll(eventId);
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${eventSlug || eventId}-media.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss('download');
      toast.success('Download started');
    } catch {
      toast.dismiss('download');
      toast.error('Failed to download');
    }
  };

  const handleGenerateReel = async () => {
    if (videos.length === 0) {
      toast.error('No videos available');
      return;
    }

    try {
      setIsGenerating(true);
      const response = await mediaApi.generateReel(eventId);
      const { jobId } = response.data;
      setReelJobId(jobId);
      toast.success('Reel generation started');

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await mediaApi.getReelStatus(jobId);
          const { job } = statusResponse.data;

          setReelProgress(job.progress);

          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            setReelJobId(null);
            toast.success('Reel generated successfully!');
            if (job.outputPath) {
              window.open(`${API_BASE_URL}${job.outputPath}`, '_blank');
            }
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            setReelJobId(null);
            toast.error(job.error || 'Reel generation failed');
          }
        } catch {
          clearInterval(pollInterval);
          setIsGenerating(false);
        }
      }, 2000);
    } catch (e: any) {
      setIsGenerating(false);
      toast.error(e.response?.data?.error || 'Failed to start reel generation');
    }
  };

  const handleDeleteMedia = async (id: string) => {
    if (!confirm('Delete this media permanently?')) return;
    
    try {
      await mediaApi.delete(id);
      toast.success('Media deleted');
      onRefresh?.();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Folder view
  if (viewMode === 'folders') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-navy-900">Media Library</h3>
            <p className="text-sm text-surface-500">{media.length} total items</p>
          </div>
          <button onClick={handleDownloadAll} className="btn-outline" disabled={media.length === 0}>
            {Icons.download}
            <span className="ml-2">Download All</span>
          </button>
        </div>

        {/* Folders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => handleFolderClick(folder.id)}
              disabled={folder.count === 0}
              className={cn(
                'flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all',
                folder.count > 0 
                  ? 'bg-white hover:shadow-md hover:border-surface-300 cursor-pointer' 
                  : 'bg-surface-50 border-surface-200 opacity-50 cursor-not-allowed',
                'border-surface-200'
              )}
            >
              <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center border', folder.color)}>
                {Icons.folder}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy-900">{folder.label}</p>
                <p className="text-sm text-surface-500">{folder.count} item{folder.count !== 1 ? 's' : ''}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Reel Generation (only if videos exist and enabled) */}
        {reelEnabled && videos.length > 0 && (
          <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                  {Icons.reel}
                </div>
                <div>
                  <h4 className="font-medium">Video Reel</h4>
                  <p className="text-sm text-white/70">
                    {videos.length} video{videos.length !== 1 ? 's' : ''} • 
                    {formatDuration(videos.reduce((sum, v) => sum + (v.duration || 0), 0))} total
                  </p>
                </div>
              </div>
              <button
                onClick={handleGenerateReel}
                disabled={isGenerating}
                className="px-4 py-2 bg-white text-navy-900 rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {reelProgress}%
                  </span>
                ) : (
                  'Generate Reel'
                )}
              </button>
            </div>
            {isGenerating && (
              <div className="mt-4">
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${reelProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {media.length === 0 && (
          <div className="bg-white rounded-xl border border-surface-200 p-16 text-center">
            <div className="w-14 h-14 mx-auto rounded-xl bg-surface-100 flex items-center justify-center text-surface-400 mb-4">
              {Icons.photo}
            </div>
            <h3 className="text-lg font-medium text-navy-900 mb-1">No media yet</h3>
            <p className="text-surface-500">Guest messages will appear here</p>
          </div>
        )}
      </div>
    );
  }

  // Individual folder view
  const currentMedia = getCurrentMedia();
  const folderInfo = folders.find(f => f.id === viewMode);

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 rounded-lg hover:bg-surface-100 transition-colors">
            {Icons.back}
          </button>
          <div>
            <h3 className="text-lg font-semibold text-navy-900">{folderInfo?.label}</h3>
            <p className="text-sm text-surface-500">{currentMedia.length} item{currentMedia.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Media Grid */}
      {currentMedia.length === 0 ? (
        <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
          <p className="text-surface-500">No {folderInfo?.label.toLowerCase()} yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {currentMedia.map(item => (
            <div key={item.id} className="group bg-white rounded-xl border border-surface-200 overflow-hidden hover:border-surface-300 hover:shadow-md transition-all">
              {/* Thumbnail/Preview */}
              <div 
                onClick={() => setPreviewMedia(item)}
                className="aspect-square bg-surface-100 flex items-center justify-center relative cursor-pointer overflow-hidden"
              >
                {item.type === 'PHOTO' ? (
                  <img 
                    src={`${API_BASE_URL}${item.filePath}`} 
                    alt="" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                  />
                ) : item.type === 'VIDEO' && item.thumbnailPath ? (
                  <img 
                    src={`${API_BASE_URL}${item.thumbnailPath}`} 
                    alt="" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                  />
                ) : (
                  <div className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center',
                    item.type === 'VIDEO' ? 'bg-rose-100 text-rose-500' : 'bg-violet-100 text-violet-500'
                  )}>
                    {item.type === 'VIDEO' ? Icons.video : Icons.audio}
                  </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/30 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 text-navy-900 shadow-lg">
                    {Icons.play}
                  </div>
                </div>

                {/* Duration badge */}
                {item.duration && (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-mono">
                    {formatDuration(item.duration)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-medium text-navy-900 text-sm truncate">{item.guestName || 'Anonymous'}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-surface-400">{formatDate(item.createdAt, 'MMM d')}</p>
                  {isAdmin && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteMedia(item.id); }}
                      className="p-1 rounded text-surface-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      {Icons.trash}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewMedia && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90" 
          onClick={() => setPreviewMedia(null)}
        >
          <div onClick={e => e.stopPropagation()} className="relative max-w-5xl w-full">
            <button 
              onClick={() => setPreviewMedia(null)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              {Icons.close}
            </button>

            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              {/* Media player */}
              <div className="bg-black min-h-[50vh] flex items-center justify-center">
                {previewMedia.type === 'PHOTO' && (
                  <img 
                    src={`${API_BASE_URL}${previewMedia.filePath}`} 
                    alt="" 
                    className="max-h-[70vh] object-contain" 
                  />
                )}
                {previewMedia.type === 'VIDEO' && (
                  <video 
                    src={`${API_BASE_URL}${previewMedia.filePath}`} 
                    controls 
                    autoPlay 
                    className="max-h-[70vh] w-full" 
                  />
                )}
                {previewMedia.type === 'AUDIO' && (
                  <div className="p-12 w-full max-w-md">
                    <div className="w-24 h-24 mx-auto rounded-full bg-violet-100 flex items-center justify-center text-violet-500 mb-6">
                      {Icons.audio}
                    </div>
                    <audio 
                      src={`${API_BASE_URL}${previewMedia.filePath}`} 
                      controls 
                      autoPlay 
                      className="w-full" 
                    />
                  </div>
                )}
              </div>

              {/* Info bar */}
              <div className="px-6 py-4 flex items-center justify-between bg-white border-t border-surface-100">
                <div>
                  <p className="font-medium text-navy-900">{previewMedia.guestName || 'Anonymous'}</p>
                  <p className="text-sm text-surface-500">
                    {formatDate(previewMedia.createdAt, 'MMMM d, yyyy h:mm a')}
                    {previewMedia.duration && ` • ${formatDuration(previewMedia.duration)}`}
                    {previewMedia.fileSize && ` • ${formatFileSize(previewMedia.fileSize)}`}
                  </p>
                </div>
                <button 
                  onClick={() => window.open(`${API_BASE_URL}${previewMedia.filePath}`, '_blank')}
                  className="btn-outline"
                >
                  {Icons.download}
                  <span className="ml-2">Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

