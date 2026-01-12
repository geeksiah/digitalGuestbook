'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl text-center">
        {/* 404 Number */}
        <div className="mb-8">
          <h1 className="text-9xl sm:text-[12rem] font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-primary-500 to-primary-400 leading-none">
            404
          </h1>
        </div>

        {/* Error Message */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 sm:p-12 border border-white/10 shadow-elegant">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">
            Page Not Found
          </h2>
          <p className="text-lg text-surface-300 mb-8 max-w-md mx-auto">
            Oops! The page you're looking for seems to have wandered off. 
            Don't worry, we'll help you find your way back.
          </p>

          {/* Illustration */}
          <div className="mb-8 flex justify-center">
            <div className="w-32 h-32 rounded-full bg-primary-500/20 flex items-center justify-center">
              <svg 
                className="w-16 h-16 text-primary-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/"
              className="btn-primary px-8 py-3 text-base w-full sm:w-auto"
            >
              Go Home
            </Link>
            <button
              onClick={() => router.back()}
              className="btn-secondary px-8 py-3 text-base w-full sm:w-auto"
            >
              Go Back
            </button>
          </div>

          {/* Helpful Links */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-sm text-surface-400 mb-4">Or try these:</p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link 
                href="/" 
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                Home
              </Link>
              <Link 
                href="/admin/login" 
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                Admin Login
              </Link>
              <Link 
                href="/owner/login" 
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                Owner Login
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-2">
          <img 
            src="/img/logo-light.svg" 
            alt="EventPeepo" 
            className="h-6 w-auto mx-auto opacity-80"
          />
          <p className="text-surface-500 text-sm">
            Powered by EventPeepo
          </p>
          <p className="text-surface-400 text-xs">
            © {new Date().getFullYear()} EventPeepo. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

