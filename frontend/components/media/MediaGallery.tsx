'use client';

import { useState, useEffect, useCallback } from 'react';
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
  close: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  back: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  trash: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  reel: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
  chevronLeft: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  chevronRight: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
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
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
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

  const getCurrentMedia = useCallback(() => {
    switch (viewMode) {
      case 'videos': return videos;
      case 'audio': return audioFiles;
      case 'photos': return photos;
      default: return media;
    }
  }, [viewMode, videos, audioFiles, photos, media]);

  const currentMedia = getCurrentMedia();
  const previewMedia = previewIndex !== null ? currentMedia[previewIndex] : null;

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (previewIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewIndex(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIndex, currentMedia.length]);

  const navigatePrev = () => {
    if (previewIndex !== null && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  };

  const navigateNext = () => {
    if (previewIndex !== null && previewIndex < currentMedia.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  };

  const handleFolderClick = (folderId: string) => {
    setViewMode(folderId as ViewMode);
  };

  const handleBack = () => {
    setViewMode('folders');
  };

  const handleDownload = async (item: MediaAsset, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      toast.loading('Downloading...', { id: `dl-${item.id}` });
      
      // Fetch the file as blob to handle cross-origin
      const response = await fetch(`${API_BASE_URL}${item.filePath}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = item.fileName || `media-${item.id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      URL.revokeObjectURL(url);
      
      toast.dismiss(`dl-${item.id}`);
      toast.success('Downloaded!');
    } catch (error) {
      toast.dismiss(`dl-${item.id}`);
      toast.error('Failed to download');
      console.error('Download error:', error);
    }
  };

  const handleDownloadAll = async () => {
    try {
      toast.loading('Preparing ZIP archive...', { id: 'download-all' });
      
      // Get auth token for protected endpoint
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      
      const response = await fetch(`${API_BASE_URL}/api/media/event/${eventId}/download-all`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(error.error || 'Download failed');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${eventSlug || eventId}-media.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.dismiss('download-all');
      toast.success('Download started!');
    } catch (error: any) {
      toast.dismiss('download-all');
      toast.error(error.message || 'Failed to download');
      console.error('Download all error:', error);
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

  const handleDeleteMedia = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Delete this media permanently?')) return;
    
    try {
      await mediaApi.delete(id);
      toast.success('Media deleted');
      setPreviewIndex(null);
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

        {/* Reel Generation */}
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
                ) : 'Generate Reel'}
              </button>
            </div>
            {isGenerating && (
              <div className="mt-4">
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${reelProgress}%` }} />
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
          {currentMedia.map((item, index) => (
            <div key={item.id} className="group bg-white rounded-xl border border-surface-200 overflow-hidden hover:border-surface-300 hover:shadow-md transition-all">
              {/* Thumbnail/Preview */}
              <div 
                onClick={() => setPreviewIndex(index)}
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
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {/* Download button */}
                    <button 
                      onClick={(e) => handleDownload(item, e)}
                      className="p-1.5 rounded text-surface-500 hover:text-navy-900 hover:bg-surface-100 transition-colors"
                      title="Download"
                    >
                      {Icons.download}
                    </button>
                    {/* Delete button (admin only) */}
                    {isAdmin && (
                      <button 
                        onClick={(e) => handleDeleteMedia(item.id, e)}
                        className="p-1.5 rounded text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        {Icons.trash}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {previewMedia && previewIndex !== null && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" 
          onClick={() => setPreviewIndex(null)}
        >
          {/* Close button */}
          <button 
            onClick={() => setPreviewIndex(null)}
            className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {Icons.close}
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 z-10 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium">
            {previewIndex + 1} / {currentMedia.length}
          </div>

          {/* Navigation arrows */}
          {currentMedia.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); navigatePrev(); }}
                disabled={previewIndex === 0}
                className={cn(
                  'absolute left-4 z-10 p-3 rounded-full bg-white/10 text-white transition-all',
                  previewIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'
                )}
              >
                {Icons.chevronLeft}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); navigateNext(); }}
                disabled={previewIndex === currentMedia.length - 1}
                className={cn(
                  'absolute right-4 z-10 p-3 rounded-full bg-white/10 text-white transition-all',
                  previewIndex === currentMedia.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'
                )}
              >
                {Icons.chevronRight}
              </button>
            </>
          )}

          {/* Content container */}
          <div onClick={e => e.stopPropagation()} className="relative max-w-6xl w-full mx-4">
            {/* Media display */}
            <div className="flex items-center justify-center min-h-[60vh]">
              {previewMedia.type === 'PHOTO' && (
                <img 
                  src={`${API_BASE_URL}${previewMedia.filePath}`} 
                  alt="" 
                  className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl" 
                />
              )}
              {previewMedia.type === 'VIDEO' && (
                <video 
                  key={previewMedia.id}
                  src={`${API_BASE_URL}${previewMedia.filePath}`} 
                  controls 
                  autoPlay 
                  className="max-h-[80vh] max-w-full rounded-lg shadow-2xl" 
                />
              )}
              {previewMedia.type === 'AUDIO' && (
                <div className="bg-white rounded-2xl p-10 shadow-2xl max-w-md w-full">
                  <div className="w-24 h-24 mx-auto rounded-full bg-violet-100 flex items-center justify-center text-violet-500 mb-6">
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <p className="text-center font-medium text-navy-900 mb-4">{previewMedia.guestName || 'Anonymous'}</p>
                  <audio 
                    key={previewMedia.id}
                    src={`${API_BASE_URL}${previewMedia.filePath}`} 
                    controls 
                    autoPlay 
                    className="w-full" 
                  />
                </div>
              )}
            </div>

            {/* Bottom info bar */}
            <div className="absolute bottom-0 left-0 right-0 transform translate-y-full pt-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl px-6 py-4 flex items-center justify-between">
                <div className="text-white">
                  <p className="font-medium">{previewMedia.guestName || 'Anonymous'}</p>
                  <p className="text-sm text-white/70">
                    {formatDate(previewMedia.createdAt, 'MMMM d, yyyy h:mm a')}
                    {previewMedia.duration && ` • ${formatDuration(previewMedia.duration)}`}
                    {previewMedia.fileSize && ` • ${formatFileSize(previewMedia.fileSize)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Download button */}
                  <button 
                    onClick={() => handleDownload(previewMedia)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-navy-900 rounded-lg font-medium hover:bg-white/90 transition-colors"
                  >
                    {Icons.download}
                    <span>Download</span>
                  </button>
                  {/* Delete button (admin only) */}
                  {isAdmin && (
                    <button 
                      onClick={() => handleDeleteMedia(previewMedia.id)}
                      className="p-2.5 bg-white/10 text-white rounded-lg hover:bg-red-500 transition-colors"
                      title="Delete"
                    >
                      {Icons.trash}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Thumbnail strip */}
          {currentMedia.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 p-2 bg-white/10 backdrop-blur-lg rounded-xl max-w-[80vw] overflow-x-auto">
              {currentMedia.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); setPreviewIndex(idx); }}
                  className={cn(
                    'w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all',
                    idx === previewIndex ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'
                  )}
                >
                  {item.type === 'PHOTO' ? (
                    <img src={`${API_BASE_URL}${item.filePath}`} alt="" className="w-full h-full object-cover" />
                  ) : item.type === 'VIDEO' && item.thumbnailPath ? (
                    <img src={`${API_BASE_URL}${item.thumbnailPath}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className={cn(
                      'w-full h-full flex items-center justify-center',
                      item.type === 'VIDEO' ? 'bg-rose-500' : 'bg-violet-500'
                    )}>
                      {item.type === 'VIDEO' ? Icons.video : Icons.audio}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
