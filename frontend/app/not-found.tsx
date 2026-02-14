'use client';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-surface-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-surface-200 bg-white shadow-xl p-8 text-center">
        <div className="inline-flex items-center rounded-full border border-surface-200 px-3 py-1 text-xs font-semibold text-surface-600">
          HTTP 404
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-brand-900">Page Not Found</h1>
        <p className="mt-3 text-surface-600">
          The page you requested does not exist or was moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 transition-colors"
          >
            Go Home
          </a>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

