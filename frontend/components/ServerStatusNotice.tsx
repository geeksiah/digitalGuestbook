'use client';

import { useEffect, useState } from 'react';
import {
  getServerStatus,
  SERVER_STATUS_EVENT,
  warmUpServer,
  type ServerStatus,
} from '@/lib/serverStatus';

const COPY: Record<Exclude<ServerStatus, 'ok'>, { title: string; body: string; action: boolean }> = {
  slow: {
    title: 'Getting things ready…',
    body: 'This can take up to a minute on the first visit. Thanks for waiting.',
    action: false,
  },
  down: {
    title: 'Still waking up',
    body: 'The page could not finish loading yet. Please refresh in a few seconds.',
    action: true,
  },
  ready: {
    title: 'All set',
    body: 'Everything is ready now. Refresh the page to continue.',
    action: true,
  },
  offline: {
    title: 'You are offline',
    body: 'Check your connection, then refresh the page.',
    action: true,
  },
};

/**
 * Small floating notice shown while the API is asleep or waking. Mounted once
 * in the root layout; it listens to lib/serverStatus and never shows technical
 * details. Hidden when a page is already showing <ServerWakingScreen />.
 */
export default function ServerStatusNotice() {
  const [status, setStatus] = useState<ServerStatus>('ok');

  useEffect(() => {
    // Start waking the API the moment anyone opens the site.
    warmUpServer();
    setStatus(getServerStatus());
    const onChange = (event: Event) => setStatus((event as CustomEvent<ServerStatus>).detail);
    window.addEventListener(SERVER_STATUS_EVENT, onChange);
    return () => window.removeEventListener(SERVER_STATUS_EVENT, onChange);
  }, []);

  if (status === 'ok') return null;
  const copy = COPY[status];

  return (
    <div
      data-ep-status-notice
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center p-3 sm:bottom-4 sm:p-0"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 text-left shadow-xl">
        {status === 'slow' ? (
          <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-surface-300 border-t-brand-900" aria-hidden />
        ) : (
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${status === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'}`}
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-5 text-brand-900">{copy.title}</p>
          <p className="text-[13px] leading-5 text-surface-600">{copy.body}</p>
        </div>
        {copy.action ? (
          <button type="button" onClick={() => window.location.reload()} className="btn-primary shrink-0">
            Refresh
          </button>
        ) : null}
      </div>
    </div>
  );
}
