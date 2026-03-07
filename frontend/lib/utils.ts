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

// Format date
export function formatDate(date: string | Date, formatStr: string = 'PPP') {
  return format(new Date(date), formatStr);
}

// Format relative time
export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
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
    PRE_EVENT: 'Pre-Event',
    LIVE: 'Live',
    POST_EVENT: 'Post-Event',
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
