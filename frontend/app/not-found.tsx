'use client';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="panel p-5 text-center sm:p-6">
          <h1 className="text-xl font-bold tracking-tight text-brand-900">Page not found</h1>
          <p className="mt-1.5 text-[13px] leading-5 text-surface-600">
            This address does not exist, or it has moved.
          </p>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => window.history.back()} className="btn-outline">
              Go back
            </button>
            <a href="/" className="btn-primary">
              Go home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
