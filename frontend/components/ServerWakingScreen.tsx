'use client';

import { useEffect, useState } from 'react';
import { getServerStatus, pingServer, SERVER_STATUS_EVENT, type ServerStatus } from '@/lib/serverStatus';

type Props = {
  /** Optional heading override, e.g. the event name. */
  title?: string;
};

/**
 * Full-page state for when a page could not load because the API is asleep,
 * still booting or unreachable. It keeps checking in the background and asks
 * the guest to refresh once things are ready. No status codes, no jargon.
 */
export default function ServerWakingScreen({ title }: Props) {
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const sync = (status: ServerStatus) => {
      setOffline(status === 'offline');
      if (status === 'ready') setReady(true);
    };
    sync(getServerStatus());
    const onChange = (event: Event) => sync((event as CustomEvent<ServerStatus>).detail);
    window.addEventListener(SERVER_STATUS_EVENT, onChange);

    const poll = async () => {
      if (cancelled) return;
      if (await pingServer()) {
        if (!cancelled) setReady(true);
        return;
      }
      timer = setTimeout(poll, 5_000);
    };
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(SERVER_STATUS_EVENT, onChange);
    };
  }, []);

  const heading = offline ? 'You are offline' : ready ? 'All set' : title || 'Getting things ready';
  const body = offline
    ? 'Check your connection, then refresh the page.'
    : ready
      ? 'Everything is ready now. Refresh the page to continue.'
      : 'This can take up to a minute on the first visit. Please refresh the page shortly.';

  return (
    <div
      data-ep-waking-screen
      className="flex min-h-screen items-center justify-center bg-surface-100 px-4 py-10"
    >
      {/* The floating notice would only repeat this message. */}
      <style>{'[data-ep-status-notice]{display:none!important}'}</style>
      <div className="w-full max-w-md">
        <div className="panel p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
            {ready || offline ? (
              <span className={`h-3 w-3 rounded-full ${ready ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />
            ) : (
              <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-surface-300 border-t-brand-900" aria-hidden />
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-brand-900">{heading}</h1>
          <p className="mt-1.5 text-[14px] leading-6 text-surface-600" role="status" aria-live="polite">
            {body}
          </p>
          <div className="mt-5 flex justify-center">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary">
              Refresh page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
