'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api';
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
  ownerToken?: string; // For event owner portal auth
}

// Icons
const Icons = {
  folder: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  video: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  audio: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
  photo: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  download: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  downloadSmall: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
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
  isAdmin = true,
  ownerToken,
}: MediaGalleryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('folders');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reelProgress, setReelProgress] = useState(0);

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
        if (previewIndex > 0) setPreviewIndex(previewIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (previewIndex < currentMedia.length - 1) setPreviewIndex(previewIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIndex, currentMedia.length]);

  // Download single file
  const handleDownload = async (item: MediaAsset, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    
    const toastId = `dl-${item.id}`;
    try {
      toast.loading('Downloading...', { id: toastId });
      
      const response = await fetch(`${API_BASE_URL}${item.filePath}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = item.fileName || `${item.type.toLowerCase()}-${item.id}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast.success('Downloaded!', { id: toastId });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed', { id: toastId });
    }
  };

  // Download all as ZIP
  const handleDownloadAll = async () => {
    const toastId = 'download-all';
    try {
      toast.loading('Creating ZIP archive...', { id: toastId });
      
      const headers: Record<string, string> = {};
      if (isAdmin) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } else if (ownerToken) {
        headers['X-Owner-Token'] = ownerToken;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/media/event/${eventId}/download-all`, { headers });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create archive');
      }
      
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Archive is empty');
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${eventSlug || eventId}-media.zip`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast.success('Download started!', { id: toastId });
    } catch (error: any) {
      console.error('Download all error:', error);
      toast.error(error.message || 'Download failed', { id: toastId });
    }
  };

  // Generate reel
  const handleGenerateReel = async () => {
    if (videos.length === 0) {
      toast.error('No videos available');
      return;
    }

    // Get auth token based on context - admin or couple
    const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    
    // Determine the API endpoint and headers based on context
    let endpoint = `${API_BASE_URL}/api/media/event/${eventId}/generate-reel`;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    } else if (ownerToken) {
      // Use couple portal endpoint
      endpoint = `${API_BASE_URL}/api/event-owner/${ownerToken}/generate-reel`;
    } else {
      toast.error('Authentication required');
      return;
    }
    
    try {
      setIsGenerating(true);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ maxDuration: 300 }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        // Handle specific errors with better messages
        if (err.error?.includes('FFmpeg')) {
          throw new Error('FFmpeg is not installed on the server. Please contact your administrator to enable reel generation.');
        }
        throw new Error(err.error || 'Failed to start generation');
      }
      
      const { jobId } = await response.json();
      toast.success('Reel generation started');

      // Determine status endpoint based on context
      const statusEndpoint = adminToken 
        ? `${API_BASE_URL}/api/media/reel/${jobId}/status`
        : `${API_BASE_URL}/api/event-owner/${ownerToken}/reel/${jobId}/status`;

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(statusEndpoint, {
            headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {},
          });
          const { status: jobStatus } = await statusRes.json();
          setReelProgress(jobStatus.progress);

          if (jobStatus.status === 'completed') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            toast.success('Reel generated successfully!');
            if (jobStatus.outputPath) {
              window.open(`${API_BASE_URL}${jobStatus.outputPath}`, '_blank');
            }
            onRefresh?.();
          } else if (jobStatus.status === 'failed') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            toast.error(jobStatus.error || 'Reel generation failed');
          }
        } catch {
          clearInterval(pollInterval);
          setIsGenerating(false);
        }
      }, 2000);
    } catch (e: any) {
      setIsGenerating(false);
      toast.error(e.message || 'Failed to start reel generation');
    }
  };

  // Delete media
  const handleDeleteMedia = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Delete this media permanently?')) return;
    
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      toast.success('Deleted');
      setPreviewIndex(null);
      onRefresh?.();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ============ FOLDER VIEW ============
  if (viewMode === 'folders') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-navy-900">Media Library</h3>
            <p className="text-sm text-surface-500">{media.length} total items</p>
          </div>
          <button onClick={handleDownloadAll} className="btn-outline" disabled={media.length === 0}>
            {Icons.downloadSmall}
            <span className="ml-2">Download All</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setViewMode(folder.id as ViewMode)}
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
              <div className="flex-1">
                <p className="font-medium text-navy-900">{folder.label}</p>
                <p className="text-sm text-surface-500">{folder.count} item{folder.count !== 1 ? 's' : ''}</p>
              </div>
            </button>
          ))}
        </div>

        {reelEnabled && videos.length > 0 && (
          <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-xl p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">{Icons.reel}</div>
                <div>
                  <h4 className="font-medium">Video Reel</h4>
                  <p className="text-sm text-white/70">
                    {videos.length} video{videos.length !== 1 ? 's' : ''} - {formatDuration(videos.reduce((s, v) => s + (v.duration || 0), 0))}
                  </p>
                </div>
              </div>
              <button
                onClick={handleGenerateReel}
                disabled={isGenerating}
                className="px-4 py-2 bg-white text-navy-900 rounded-lg font-medium hover:bg-white/90 disabled:opacity-50"
              >
                {isGenerating ? `${reelProgress}%` : 'Generate Reel'}
              </button>
            </div>
            {isGenerating && (
              <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${reelProgress}%` }} />
              </div>
            )}
          </div>
        )}

        {media.length === 0 && (
          <div className="bg-white rounded-xl border border-surface-200 p-16 text-center">
            <div className="w-14 h-14 mx-auto rounded-xl bg-surface-100 flex items-center justify-center text-surface-400 mb-4">{Icons.photo}</div>
            <h3 className="text-lg font-medium text-navy-900 mb-1">No media yet</h3>
            <p className="text-surface-500">Guest messages will appear here</p>
          </div>
        )}
      </div>
    );
  }

  // ============ MEDIA GRID VIEW ============
  const folderInfo = folders.find(f => f.id === viewMode);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('folders')} className="p-2 rounded-lg hover:bg-surface-100">{Icons.back}</button>
          <div>
            <h3 className="text-lg font-semibold text-navy-900">{folderInfo?.label}</h3>
            <p className="text-sm text-surface-500">{currentMedia.length} item{currentMedia.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {currentMedia.length === 0 ? (
        <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
          <p className="text-surface-500">No {folderInfo?.label.toLowerCase()} yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {currentMedia.map((item, index) => (
            <div key={item.id} className="group bg-white rounded-xl border border-surface-200 overflow-hidden hover:border-surface-300 hover:shadow-md transition-all">
              <div 
                onClick={() => setPreviewIndex(index)}
                className="aspect-square bg-surface-100 flex items-center justify-center relative cursor-pointer overflow-hidden"
              >
                {item.type === 'PHOTO' ? (
                  <img src={`${API_BASE_URL}${item.filePath}`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : item.type === 'VIDEO' && item.thumbnailPath ? (
                  <img src={`${API_BASE_URL}${item.thumbnailPath}`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className={cn('w-16 h-16 rounded-full flex items-center justify-center', item.type === 'VIDEO' ? 'bg-rose-100 text-rose-500' : 'bg-violet-100 text-violet-500')}>
                    {item.type === 'VIDEO' ? Icons.video : Icons.audio}
                  </div>
                )}
                <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/30 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 text-navy-900 shadow-lg">{Icons.play}</div>
                </div>
                {item.duration && (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-mono">{formatDuration(item.duration)}</div>
                )}
              </div>
              <div className="p-3">
                <p className="font-medium text-navy-900 text-sm truncate">{item.guestName || 'Anonymous'}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-surface-400">{formatDate(item.createdAt, 'MMM d')}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={(e) => handleDownload(item, e)} className="p-1.5 rounded text-surface-500 hover:text-navy-900 hover:bg-surface-100" title="Download">{Icons.downloadSmall}</button>
                    {isAdmin && <button onClick={(e) => handleDeleteMedia(item.id, e)} className="p-1.5 rounded text-surface-400 hover:text-red-500 hover:bg-red-50" title="Delete">{Icons.trash}</button>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ LIGHTBOX ============ */}
      {previewMedia && previewIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm" onClick={() => setPreviewIndex(null)}>
          {/* Top bar - responsive */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-2 sm:p-4 bg-gradient-to-b from-black/80 to-transparent safe-area-top">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <span className="text-white/80 text-xs sm:text-sm font-medium flex-shrink-0">{previewIndex + 1} / {currentMedia.length}</span>
              <span className="text-white font-medium text-sm sm:text-base truncate">{previewMedia.guestName || 'Anonymous'}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(previewMedia); }}
                className="p-2 sm:p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                title="Download"
              >
                {Icons.download}
              </button>
              {isAdmin && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteMedia(previewMedia.id); }}
                  className="p-2 sm:p-3 rounded-full bg-white/10 text-white hover:bg-red-500 transition-colors"
                  title="Delete"
                >
                  {Icons.trash}
                </button>
              )}
              <button onClick={() => setPreviewIndex(null)} className="p-2 sm:p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">{Icons.close}</button>
            </div>
          </div>

          {/* Navigation - responsive positioning */}
          {currentMedia.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); if (previewIndex > 0) setPreviewIndex(previewIndex - 1); }}
                disabled={previewIndex === 0}
                className={cn(
                  'absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-white/10 text-white transition-all',
                  previewIndex === 0 ? 'opacity-30' : 'hover:bg-white/20'
                )}
              >
                {Icons.chevronLeft}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); if (previewIndex < currentMedia.length - 1) setPreviewIndex(previewIndex + 1); }}
                disabled={previewIndex === currentMedia.length - 1}
                className={cn(
                  'absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-white/10 text-white transition-all',
                  previewIndex === currentMedia.length - 1 ? 'opacity-30' : 'hover:bg-white/20'
                )}
              >
                {Icons.chevronRight}
              </button>
            </>
          )}

          {/* Media Content - click anywhere on background to close */}
          <div className="absolute inset-0 flex items-center justify-center p-2 pt-14 pb-20 sm:p-4 sm:pt-16 sm:pb-24 md:p-8 md:pt-20 md:pb-28">
            {previewMedia.type === 'PHOTO' && (
              <img 
                src={`${API_BASE_URL}${previewMedia.filePath}`} 
                alt="" 
                className="max-h-full max-w-full object-contain rounded-lg cursor-zoom-out"
                onClick={() => setPreviewIndex(null)}
              />
            )}
            {previewMedia.type === 'VIDEO' && (
              <video 
                key={previewMedia.id} 
                src={`${API_BASE_URL}${previewMedia.filePath}`} 
                controls 
                autoPlay 
                playsInline
                className="max-h-full max-w-full rounded-lg"
                onClick={e => e.stopPropagation()}
              />
            )}
            {previewMedia.type === 'AUDIO' && (
              <div className="bg-white rounded-2xl p-6 sm:p-10 shadow-2xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto rounded-full bg-surface-100 flex items-center justify-center text-surface-500 mb-4 sm:mb-6">
                  <svg className="w-8 h-8 sm:w-12 sm:h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </div>
                <p className="text-center font-medium text-navy-900 mb-4 text-sm sm:text-base">{previewMedia.guestName || 'Anonymous'}</p>
                <audio key={previewMedia.id} src={`${API_BASE_URL}${previewMedia.filePath}`} controls autoPlay className="w-full" />
              </div>
            )}
          </div>

          {/* Thumbnail strip - responsive */}
          {currentMedia.length > 1 && (
            <div className="absolute bottom-2 sm:bottom-4 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto z-20 flex gap-1 sm:gap-2 p-1.5 sm:p-2 bg-black/60 backdrop-blur rounded-lg sm:rounded-xl overflow-x-auto sm:max-w-[80vw] safe-area-bottom">
              {currentMedia.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); setPreviewIndex(idx); }}
                  className={cn(
                    'w-10 h-10 sm:w-12 sm:h-12 rounded-md sm:rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all',
                    idx === previewIndex ? 'border-white' : 'border-transparent opacity-50 hover:opacity-100'
                  )}
                >
                  {item.type === 'PHOTO' ? (
                    <img src={`${API_BASE_URL}${item.filePath}`} alt="" className="w-full h-full object-cover" />
                  ) : item.thumbnailPath ? (
                    <img src={`${API_BASE_URL}${item.thumbnailPath}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className={cn('w-full h-full flex items-center justify-center text-white text-xs', item.type === 'VIDEO' ? 'bg-rose-500' : 'bg-violet-500')}>
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
