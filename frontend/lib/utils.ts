import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

const getPublicApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
  }
  return 'http://localhost:3001';
};

const getPublicSupabaseUrl = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');

// Merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date. Missing or unparseable values render as an em dash rather than
// throwing and taking the whole screen down.
export function formatDate(date: string | Date | null | undefined, formatStr: string = 'PPP') {
  if (!date) return '—';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '—';
  try {
    return format(value, formatStr);
  } catch {
    return '—';
  }
}

// Format relative time
export function formatRelativeTime(date: string | Date | null | undefined) {
  if (!date) return '—';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '—';
  try {
    return formatDistanceToNow(value, { addSuffix: true });
  } catch {
    return '—';
  }
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format duration
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatCurrencyAmount(amount: number | null | undefined, currency?: string | null): string {
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return '-';
  const code = String(currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

export function formatAggregateCurrency(
  amount: number | null | undefined,
  currencies: string[] = []
): string {
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return '-';
  const unique = Array.from(new Set(currencies.map((currency) => String(currency || '').toUpperCase()).filter(Boolean)));
  if (unique.length === 1) {
    return formatCurrencyAmount(value, unique[0]);
  }
  return `${value.toFixed(2)} (multi-currency)`;
}

export function resolvePublicAssetUrl(
  value: string | null | undefined,
  bucket = 'media-assets'
): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;

  const apiBaseUrl = getPublicApiBaseUrl();
  const supabaseUrl = getPublicSupabaseUrl();

  if (raw.startsWith('/storage/v1/object/public/')) {
    return supabaseUrl ? `${supabaseUrl}${raw}` : `${apiBaseUrl}${raw}`;
  }

  if (raw.startsWith('/uploads/') || raw.startsWith('/generated/') || raw.startsWith('/api/')) {
    return `${apiBaseUrl}${raw}`;
  }

  const normalized = raw.replace(/^\/+/, '');
  if (normalized.includes('/') && supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${normalized}`;
  }

  return `${apiBaseUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

// Generate slug from string
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

// Generate device ID for tracking uploads
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

// Get status badge color
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'badge-warning',
    APPROVED: 'badge-success',
    REJECTED: 'badge-error',
    YES: 'badge-success',
    NO: 'badge-error',
    MAYBE: 'badge-warning',
    PRE_EVENT: 'badge-info',
    LIVE: 'badge-success',
    POST_EVENT: 'badge-neutral',
  };
  return colors[status] || 'badge-neutral';
}

// Phase display labels
export function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    PRE_EVENT: 'Upcoming',
    LIVE: 'Live',
    POST_EVENT: 'Ended',
  };
  return labels[phase] || phase;
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Download blob as file
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/* ==========================================================================
   Shared presentation helpers.
   These previously lived as private copies inside individual screens.
   ========================================================================== */

/** Grouped integer formatting so counts stay scannable at any magnitude. */
export function formatCount(value: number | null | undefined): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('en-US').format(n);
}

/** Short form for tight spaces (stat tiles, mobile rows). 12.4K, 3.1M. */
export function formatCompactCount(value: number | null | undefined): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) < 10000) return new Intl.NumberFormat('en-US').format(n);
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Semantic tone for an event phase. Keeps status colour meaning consistent. */
export function getPhaseTone(phase: string): 'success' | 'info' | 'neutral' {
  if (phase === 'LIVE') return 'success';
  if (phase === 'PRE_EVENT') return 'info';
  return 'neutral';
}

/** Semantic tone for the shared record statuses used across the product. */
export function getStatusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    APPROVED: 'success',
    COMPLETED: 'success',
    PAID: 'success',
    SUCCESS: 'success',
    ACTIVE: 'success',
    YES: 'success',
    PENDING: 'warning',
    PROCESSING: 'warning',
    MAYBE: 'warning',
    REJECTED: 'danger',
    FAILED: 'danger',
    CANCELLED: 'danger',
    NO: 'danger',
    DRAFT: 'neutral',
    ARCHIVED: 'neutral',
  };
  return map[String(status || '').toUpperCase()] || 'neutral';
}

/** Turn an UPPER_SNAKE enum into readable text. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const API_ROOTED_PREFIXES = [
  '/storage/v1/object/public/',
  '/uploads/',
  '/api/',
  '/media/',
  '/generated/',
];

/** Absolute URL for an image path returned by the API, or null. */
export function toAbsoluteMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;
  if (API_ROOTED_PREFIXES.some((prefix) => raw.startsWith(prefix))) {
    return `${getPublicApiBaseUrl()}${raw}`;
  }
  return null;
}

/** Cover image for an event record, preferring the resolved URL field. */
export function resolveEventCover(event: {
  coverImageUrl?: string | null;
  coverImagePath?: string | null;
}): string | null {
  return toAbsoluteMediaUrl(event.coverImageUrl) || toAbsoluteMediaUrl(event.coverImagePath);
}

/** Strings that leak plumbing rather than telling the user anything useful. */
const OPAQUE_ERROR_MESSAGES = [
  'network error',
  'request failed',
  'failed to fetch',
  'load failed',
  'internal server error',
  'an error occurred',
];

const isUsableMessage = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length < 200 &&
  !value.includes('\n') &&
  !OPAQUE_ERROR_MESSAGES.includes(value.trim().toLowerCase());

/**
 * Turn any thrown value into one readable sentence.
 *
 * Order matters: an explicit message from the API or from local validation is
 * the most useful thing we can show, so it wins over the status-code wording.
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const response = (error as any)?.response;
  const data = response?.data;

  const apiMessage = data?.error || data?.message;
  if (isUsableMessage(apiMessage)) return apiMessage;

  if (response?.status === 401) return 'Your session expired. Sign in again to continue.';
  if (response?.status === 403) return 'You do not have permission to do that.';
  if (response?.status === 404) return 'That record no longer exists.';
  if (response?.status === 409) return 'That change conflicts with the current data. Reload and try again.';
  if (typeof response?.status === 'number' && response.status >= 500) {
    return 'The server could not complete that request. Try again shortly.';
  }
  if ((error as any)?.code === 'ERR_NETWORK') return 'No connection. Check your network and try again.';

  // Locally thrown validation errors carry the only useful text they will ever have.
  if (!response && isUsableMessage((error as any)?.message)) return (error as any).message;

  return fallback;
}
