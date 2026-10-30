/**
 * Server wake-up handling.
 *
 * The API runs on a free host that sleeps when idle. The first request after a
 * quiet spell can hang for up to a minute, or fail outright with a gateway
 * error (502/503/504) that carries no CORS headers, which the browser reports
 * as a bare "Network Error". None of that should ever reach a guest.
 *
 * This module:
 *   - recognises "server is asleep / unreachable" failures,
 *   - retries safe (GET) requests quietly while the server boots,
 *   - replaces the technical error with one friendly sentence,
 *   - broadcasts a status the <ServerStatusNotice /> banner listens to, so the
 *     guest is told what is happening and asked to refresh.
 *
 * It patches the global axios instance and window.fetch (API calls only), so
 * every page benefits without changing each call site.
 */
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export const SERVER_WAKING_MESSAGE =
  'We are getting things ready. This can take up to a minute. Please refresh the page shortly.';
export const OFFLINE_MESSAGE = 'You appear to be offline. Check your connection, then refresh the page.';
export const SERVER_UNAVAILABLE_CODE = 'SERVER_UNAVAILABLE';

export type ServerStatus = 'ok' | 'slow' | 'down' | 'ready' | 'offline';
export const SERVER_STATUS_EVENT = 'eventpeepo:server-status';

const isBrowser = typeof window !== 'undefined';

export const getApiBaseUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

/** How long a request may hang before we tell the guest the server is waking. */
const SLOW_REQUEST_MS = 6_000;
/** Delays between quiet retries of a GET while the server boots (~55s total). */
const RETRY_DELAYS_MS = [2_000, 4_000, 7_000, 10_000, 15_000, 17_000];
const HEALTH_POLL_MS = 5_000;

const GATEWAY_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 529]);

// ─── Status broadcasting ──────────────────────────────────────────────────────

let currentStatus: ServerStatus = 'ok';
let healthTimer: ReturnType<typeof setTimeout> | null = null;

export const getServerStatus = () => currentStatus;

function setStatus(next: ServerStatus) {
  if (!isBrowser || next === currentStatus) return;
  currentStatus = next;
  window.dispatchEvent(new CustomEvent<ServerStatus>(SERVER_STATUS_EVENT, { detail: next }));
}

/** A request failed because the server is unreachable. */
export function reportServerUnavailable() {
  if (!isBrowser) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus('offline');
    return;
  }
  setStatus('down');
  startHealthPolling();
}

/** A request succeeded. Clears a "slow" notice; a "down" notice turns into "ready". */
function reportServerReachable() {
  if (currentStatus === 'slow' || currentStatus === 'offline') setStatus('ok');
  else if (currentStatus === 'down') setStatus('ready');
}

function startHealthPolling() {
  if (!isBrowser || healthTimer) return;
  const tick = async () => {
    healthTimer = null;
    if (currentStatus !== 'down' && currentStatus !== 'offline') return;
    if (await pingServer()) {
      setStatus('ready');
      return;
    }
    healthTimer = setTimeout(tick, HEALTH_POLL_MS);
  };
  healthTimer = setTimeout(tick, HEALTH_POLL_MS);
}

/** Cheap liveness probe. Also what wakes a sleeping server. */
export async function pingServer(timeoutMs = 8_000): Promise<boolean> {
  if (!isBrowser) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await nativeFetch(`${getApiBaseUrl()}/healthz?_t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Start waking the server as early as possible, without waiting on it. */
let warmedUp = false;
export function warmUpServer() {
  if (!isBrowser || warmedUp) return;
  warmedUp = true;
  void pingServer(60_000);
}

/** Flag the request as "slow" (server probably waking) if it hangs. */
function trackSlow<T>(work: Promise<T>): Promise<T> {
  if (!isBrowser) return work;
  const timer = setTimeout(() => {
    if (currentStatus === 'ok') setStatus('slow');
  }, SLOW_REQUEST_MS);
  return work.finally(() => clearTimeout(timer));
}

// ─── Error classification ─────────────────────────────────────────────────────

const looksLikeHtml = (value: unknown) =>
  typeof value === 'string' && /<(!doctype|html|head|body)\b/i.test(value.slice(0, 500));

/** True when the failure means "server asleep, booting or unreachable". */
export function isServerUnavailableError(error: unknown): boolean {
  const err = error as any;
  if (!err) return false;
  if (err.isServerUnavailable || err?.response?.data?.code === SERVER_UNAVAILABLE_CODE) return true;
  if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.name === 'AbortError') return false;

  const response = err.response;
  if (!response) {
    // axios: no response at all (CORS-less gateway page, DNS, timeout, reset)
    if (['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'].includes(err.code)) return true;
    if (err.isAxiosError && err.request) return true;
    // fetch: TypeError "Failed to fetch" / "Load failed" / "NetworkError..."
    if (err instanceof TypeError) return true;
    return false;
  }

  if (GATEWAY_STATUSES.has(response.status)) return true;
  // A 5xx answered by the host's own HTML page rather than our JSON API.
  if (response.status >= 500 && looksLikeHtml(response.data)) return true;
  return false;
}

export const isServerWakingMessage = (value: unknown) =>
  value === SERVER_WAKING_MESSAGE || value === OFFLINE_MESSAGE;

const friendlyMessage = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false ? OFFLINE_MESSAGE : SERVER_WAKING_MESSAGE;

/**
 * Rewrite a technical failure so existing handlers such as
 * `err.response?.data?.error || 'Event not found'` show the friendly sentence.
 */
function toFriendlyError(error: AxiosError): AxiosError {
  const message = friendlyMessage();
  const original = error.response;
  (error as any).isServerUnavailable = true;
  (error as any).response = {
    ...(original || {}),
    status: original?.status && original.status >= 500 ? original.status : 503,
    statusText: original?.statusText || 'Service Unavailable',
    headers: original?.headers || {},
    config: error.config,
    data: { error: message, message, code: SERVER_UNAVAILABLE_CODE },
  };
  error.message = message;
  return error;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isSafeMethod = (method?: string) => {
  const m = String(method || 'get').toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
};

// ─── axios ────────────────────────────────────────────────────────────────────

type RetryConfig = InternalAxiosRequestConfig & { __epRetry?: number; __epSlowTimer?: any };
const INSTALLED = Symbol.for('eventpeepo.serverStatus.installed');

export function installServerStatusInterceptors(instance: AxiosInstance) {
  if (!isBrowser || (instance as any)[INSTALLED]) return;
  (instance as any)[INSTALLED] = true;

  instance.interceptors.request.use((config: RetryConfig) => {
    if (config.__epSlowTimer) clearTimeout(config.__epSlowTimer);
    config.__epSlowTimer = setTimeout(() => {
      if (currentStatus === 'ok') setStatus('slow');
    }, SLOW_REQUEST_MS);
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      const config = response.config as RetryConfig;
      if (config?.__epSlowTimer) clearTimeout(config.__epSlowTimer);
      reportServerReachable();
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;
      if (config?.__epSlowTimer) clearTimeout(config.__epSlowTimer);

      if (!isServerUnavailableError(error)) {
        // The server answered (even with a 4xx), so it is awake.
        if (error.response) reportServerReachable();
        return Promise.reject(error);
      }

      const attempt = config?.__epRetry ?? 0;
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (config && isSafeMethod(config.method) && !offline && attempt < RETRY_DELAYS_MS.length) {
        if (currentStatus === 'ok') setStatus('slow');
        config.__epRetry = attempt + 1;
        await sleep(RETRY_DELAYS_MS[attempt]);
        return instance.request(config);
      }

      reportServerUnavailable();
      return Promise.reject(toFriendlyError(error));
    },
  );
}

// ─── fetch (API URLs only) ────────────────────────────────────────────────────

const nativeFetch: typeof fetch = isBrowser ? window.fetch.bind(window) : (undefined as any);

const isApiUrl = (input: RequestInfo | URL) => {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    const api = new URL(getApiBaseUrl(), window.location.href);
    if (url.pathname === '/healthz') return false;
    if (url.origin === api.origin) return true;
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

function installFetchWrapper() {
  if (!isBrowser || (window.fetch as any)[INSTALLED]) return;

  const wrapped: typeof fetch = async (input, init) => {
    if (!isApiUrl(input)) return nativeFetch(input, init);

    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    const canRetry = isSafeMethod(method) && !(input instanceof Request && input.bodyUsed);
    let attempt = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const res = await trackSlow(nativeFetch(input, init));
        const gatewayFailure =
          GATEWAY_STATUSES.has(res.status)
          || (res.status >= 500 && (res.headers.get('content-type') || '').includes('text/html'));

        if (!gatewayFailure) {
          reportServerReachable();
          return res;
        }
        if (canRetry && attempt < RETRY_DELAYS_MS.length) {
          if (currentStatus === 'ok') setStatus('slow');
          await sleep(RETRY_DELAYS_MS[attempt++]);
          continue;
        }
        reportServerUnavailable();
        // Hand back a clean JSON 503 instead of the host's technical page.
        return new Response(
          JSON.stringify({ error: friendlyMessage(), message: friendlyMessage(), code: SERVER_UNAVAILABLE_CODE }),
          { status: 503, headers: { 'content-type': 'application/json' } },
        );
      } catch (error: any) {
        if (error?.name === 'AbortError') throw error;
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (canRetry && !offline && attempt < RETRY_DELAYS_MS.length) {
          if (currentStatus === 'ok') setStatus('slow');
          await sleep(RETRY_DELAYS_MS[attempt++]);
          continue;
        }
        reportServerUnavailable();
        const friendly = new TypeError(friendlyMessage());
        (friendly as any).isServerUnavailable = true;
        throw friendly;
      }
    }
  };

  (wrapped as any)[INSTALLED] = true;
  window.fetch = wrapped;
}

// Install as soon as any client code imports this module (lib/api.ts does), so
// it is in place before the first page effect fires a request.
if (isBrowser) {
  installServerStatusInterceptors(axios);
  installFetchWrapper();
  window.addEventListener('online', () => {
    if (currentStatus === 'offline') setStatus('ready');
  });
  window.addEventListener('offline', () => setStatus('offline'));
}
