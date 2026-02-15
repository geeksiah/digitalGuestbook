export const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

export const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

export const formatCurrency = (currency: string, amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);
};

export const phaseLabel = (phase: string): string => {
  if (phase === 'PRE_EVENT') return 'Upcoming';
  if (phase === 'POST_EVENT') return 'Past';
  if (phase === 'LIVE') return 'Live';
  return phase.replace('_', ' ');
};

export const statusToneClass = (status: string): string => {
  if (status === 'APPROVED' || status === 'FULFILLED' || status === 'RESPONDED' || status === 'ACTIVE') {
    return 'tone-success';
  }
  if (status === 'REJECTED' || status === 'FAILED' || status === 'EXPIRED') return 'tone-danger';
  if (status === 'PENDING' || status === 'PROCESSING' || status === 'SENT') return 'tone-warning';
  if (status === 'OPENED' || status === 'VERIFIED') return 'tone-info';
  return 'tone-neutral';
};

export const copyText = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};
