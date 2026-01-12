'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';

interface Photo {
  id: string;
  fileName: string;
}

export default function BoothDownloadPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) {
      setError('Invalid download link');
      setLoading(false);
      return;
    }

    // Fetch photos info
    const fetchPhotos = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/public/booth/download/${token}/info`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Download link has expired or is invalid');
          } else {
            setError('Failed to load photos');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setPhotos(data.photos || []);
        setLoading(false);

        // Don't auto-download on mobile - let users tap to download individually
        // Auto-download causes issues on iPhone where new downloads cancel previous ones
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError('Failed to load photos. Please try again.');
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [token]);

  const downloadPhoto = async (photo: Photo) => {
    if (downloading.has(photo.id) || downloaded.has(photo.id)) {
      return;
    }

    setDownloading(prev => new Set([...Array.from(prev), photo.id]));

    try {
      const response = await fetch(`${API_BASE_URL}/api/public/booth/download/${token}/${photo.id}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = photo.fileName || `booth-photo-${photo.id}.jpg`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setDownloaded(prev => new Set([...Array.from(prev), photo.id]));
      setDownloading(prev => {
        const newSet = new Set(prev);
        newSet.delete(photo.id);
        return newSet;
      });
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error(`Failed to download ${photo.fileName}`);
      setDownloading(prev => {
        const newSet = new Set(prev);
        newSet.delete(photo.id);
        return newSet;
      });
    }
  };

  // Removed auto-download function - users will tap to download individually
  // This prevents iPhone from canceling previous downloads

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
          <p className="text-white/70 text-xl">Loading your photos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="text-center max-w-lg">
          <div className="w-24 h-24 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">{error}</h1>
          <p className="text-white/60 mb-6">The download link may have expired or all photos have already been downloaded.</p>
          <button
            onClick={() => router.push('/')}
            className="px-8 py-4 bg-white text-slate-900 rounded-full text-lg font-bold hover:bg-white/90 transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const allDownloaded = photos.length > 0 && downloaded.size === photos.length;
  const isDownloading = downloading.size > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Your Photos</h1>
          <p className="text-white/70 text-lg">
            {allDownloaded 
              ? `All ${photos.length} photo${photos.length !== 1 ? 's' : ''} downloaded!`
              : isDownloading
              ? `Downloading ${downloading.size} of ${photos.length}...`
              : `Tap any photo to download (${photos.length} photo${photos.length !== 1 ? 's' : ''})`
            }
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
          {photos.map((photo, index) => {
            const isDownloadingPhoto = downloading.has(photo.id);
            const isDownloadedPhoto = downloaded.has(photo.id);
            
            return (
              <div
                key={photo.id}
                className="relative aspect-square bg-white/10 rounded-xl overflow-hidden group cursor-pointer hover:bg-white/20 transition-all"
                onClick={() => !isDownloadingPhoto && !isDownloadedPhoto && downloadPhoto(photo)}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  {isDownloadingPhoto ? (
                    <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : isDownloadedPhoto ? (
                    <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-12 h-12 text-white/60 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 text-center">
                  <p className="text-white text-xs truncate">{photo.fileName || `Photo ${index + 1}`}</p>
                </div>
              </div>
            );
          })}
        </div>

        {allDownloaded && (
          <div className="text-center">
            <button
              onClick={() => router.push('/')}
              className="px-8 py-4 bg-white text-slate-900 rounded-full text-lg font-bold hover:bg-white/90 transition-all"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

