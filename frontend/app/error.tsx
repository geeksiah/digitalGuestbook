'use client';

import { useEffect } from 'react';
import ServerWakingScreen from '@/components/ServerWakingScreen';
import { isServerUnavailableError } from '@/lib/serverStatus';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: Props) {
  useEffect(() => {
    console.error('[App Error Boundary]', error);
  }, [error]);

  if (isServerUnavailableError(error)) return <ServerWakingScreen />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="panel p-5 text-center sm:p-6">
          <h1 className="text-xl font-bold tracking-tight text-brand-900">This page did not load</h1>
          <p className="mt-1.5 text-[13px] leading-5 text-surface-600">
            Something went wrong on our side. Refreshing the page usually fixes it.
          </p>
          {error?.digest ? (
            <p className="mt-2 font-mono text-[12px] text-surface-500">Error reference {error.digest}</p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <a href="/" className="btn-outline">
              Go home
            </a>
            <button
              type="button"
              onClick={() => {
                // A full reload also picks up a fresh build after a deploy.
                if (typeof window !== 'undefined') window.location.reload();
                else reset();
              }}
              className="btn-primary"
            >
              Refresh page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
