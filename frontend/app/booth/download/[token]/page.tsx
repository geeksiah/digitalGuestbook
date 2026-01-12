'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';

export default function BoothDownloadPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid download link');
      setLoading(false);
      return;
    }

    // Download the file(s)
    const downloadFile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/public/booth/download/${token}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Download link has expired or is invalid');
          } else {
            setError('Failed to download photos');
          }
          setLoading(false);
          return;
        }

        // Get the file blob (could be a single photo or ZIP file)
        const blob = await response.blob();
        
        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'booth-photos.zip';
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

        toast.success('Photos downloaded successfully!');
        
        // Redirect after a short delay
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } catch (err: any) {
        console.error('Download error:', err);
        setError('Failed to download photos. Please try again.');
        setLoading(false);
      }
    };

    downloadFile();
  }, [token, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
          <p className="text-white/70 text-xl">Downloading your photos...</p>
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

  return null;
}

