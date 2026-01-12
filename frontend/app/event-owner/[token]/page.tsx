'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { eventOwnerApi, API_BASE_URL } from '@/lib/api';
import MediaGallery from '@/components/media/MediaGallery';
import { formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// Types
interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string | null;
  currentPhase: string;
  invitationOnly: boolean;
  reelEnabled?: boolean;
  rsvpMode?: 'free' | 'paid';
  _count: { rsvps: number; invitations: number; checkIns: number; mediaAssets: number };
}

interface RSVP {
  id: string;
  primaryName: string;
  secondaryName: string | null;
  email: string | null;
  phone: string | null;
  attendance: string;
  guestCount: number;
  mealPreference: string | null;
  dietaryNotes: string | null;
  note: string | null;
  customFields: string | null;
  status: string;
  submittedAt: string;
  invitation?: { accessCode: string; qrCodeData: string | null; isCheckedIn: boolean } | null;
}

interface MediaAsset {
  id: string;
  type: 'VIDEO' | 'AUDIO' | 'PHOTO';
  guestName: string | null;
  filePath: string;
  fileName: string;
  fileSize?: number;
  duration: number | null;
  thumbnailPath: string | null;
  createdAt: string;
}

interface CheckIn {
  id: string;
  invitation: { accessCode: string; rsvp: { primaryName: string; secondaryName: string | null; guestCount: number } };
  checkedInAt: string;
}

type Tab = 'dashboard' | 'rsvps' | 'media' | 'reels' | 'checkins' | 'sales' | 'wallet';

interface ReelJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputPath: string | null;
  outputSize: number | null;
  duration: number | null;
  videoCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface SalesSummary {
  totalGross: number;
  totalPlatformFees: number;
  totalProcessingFees: number;
  totalNet: number;
  totalRefunds: number;
  totalPayouts: number;
  availableBalance: number;
  transactionCount: number;
  ticketsSold: number;
}

interface Transaction {
  id: string;
  type: string;
  grossAmount: number;
  platformFee: number;
  processingFee: number;
  netAmount: number;
  currency: string;
  ticketTypeName: string | null;
  ticketQuantity: number;
  buyerName: string | null;
  buyerEmail: string | null;
  status: string;
  createdAt: string;
}

interface PayoutWallet {
  id: string;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  mobileProvider: string | null;
  mobileNumber: string | null;
  paypalEmail: string | null;
  preferredMethod: string;
  currency: string;
  autoPayoutEnabled: boolean;
  autoPayoutThreshold: number;
  isVerified: boolean;
}

interface PayoutRequest {
  id: string;
  requestedAmount: number;
  currency: string;
  payoutMethod: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

// SVG Icons
const Icons = {
  video: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  audio: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
  photo: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  download: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  play: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
  pause: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>,
  close: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  x: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  export: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  rsvp: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  users: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  checkin: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  message: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  reel: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
  chevronDown: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  wallet: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  sales: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  plus: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  bank: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>,
  check: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  clock: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

// Export helper
function exportToCSV(data: any[], filename: string, columns: { key: string; label: string }[]) {
  const getValue = (row: any, key: string) => key.split('.').reduce((obj, k) => obj?.[k], row);
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => columns.map(c => {
    const val = getValue(row, c.key);
    return typeof val === 'string' && val.includes(',') ? `"${val}"` : val ?? '';
  }).join(','));
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export default function EventOwnerPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [rsvpFilter, setRsvpFilter] = useState('all');
  const [viewingRsvpDetails, setViewingRsvpDetails] = useState<RSVP | null>(null);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState<PayoutWallet | null>(null);
  const [walletConfigured, setWalletConfigured] = useState(false);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [reels, setReels] = useState<ReelJob[]>([]);
  const [activeReelJob, setActiveReelJob] = useState<ReelJob | null>(null);
  const [dismissedFailedReels, setDismissedFailedReels] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [exportOpen, setExportOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletForm, setWalletForm] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    routingNumber: '',
    mobileProvider: '',
    mobileNumber: '',
    paypalEmail: '',
    preferredMethod: 'bank',
    currency: 'USD',
    autoPayoutEnabled: false,
    autoPayoutThreshold: 100,
  });

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchEvent();
    pollRef.current = setInterval(() => {
      fetchEvent(true);
      if (activeTab === 'rsvps') fetchRsvps(true);
      if (activeTab === 'media') fetchMedia(true);
      // if (activeTab === 'reels') fetchReels(true); // Reels feature hidden
      if (activeTab === 'checkins') fetchCheckIns(true);
    }, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [token]);

  // Poll for active reel job progress more frequently
  useEffect(() => {
    if (!activeReelJob || (activeReelJob.status !== 'pending' && activeReelJob.status !== 'processing')) return;
    
    const reelPoll = setInterval(async () => {
      try {
        const response = await eventOwnerApi.getReelStatus(token, activeReelJob.id);
        const status = response.data.status;
        if (status.status === 'completed' || status.status === 'failed') {
          setActiveReelJob(null);
          fetchReels();
        } else {
          setActiveReelJob(prev => prev ? { ...prev, progress: status.progress, status: status.status } : null);
        }
      } catch { /* ignore polling errors */ }
    }, 2000);
    
    return () => clearInterval(reelPoll);
  }, [activeReelJob?.id]);

  useEffect(() => {
    if (event) {
      if (activeTab === 'rsvps') fetchRsvps();
      if (activeTab === 'media') fetchMedia();
      // if (activeTab === 'reels') fetchReels(); // Reels feature hidden
      if (activeTab === 'checkins') fetchCheckIns();
      if (activeTab === 'sales') fetchSales();
      if (activeTab === 'wallet') { fetchWallet(); fetchPayouts(); }
    }
  }, [activeTab, event]);

  const fetchEvent = async (silent = false) => {
    try {
      const response = await eventOwnerApi.getEvent(token);
      setEvent(response.data.event);
      if (!silent) setLoading(false);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (!silent) { setError(err.response?.data?.error || 'Invalid access token'); setLoading(false); }
    }
  };

  const fetchRsvps = async (silent = false) => {
    try {
      const response = await eventOwnerApi.getRsvps(token, rsvpFilter !== 'all' ? { status: rsvpFilter } : undefined);
      setRsvps(response.data.rsvps);
    } catch { if (!silent) toast.error('Failed to load RSVPs'); }
  };

  const fetchMedia = async (silent = false) => {
    try { const response = await eventOwnerApi.getMedia(token); setMedia(response.data.media); }
    catch { if (!silent) toast.error('Failed to load media'); }
  };

  const fetchCheckIns = async (silent = false) => {
    try { const response = await eventOwnerApi.getCheckIns(token); setCheckIns(response.data.checkIns); }
    catch { if (!silent) toast.error('Failed to load check-ins'); }
  };

  const fetchSales = async (silent = false) => {
    try {
      const response = await eventOwnerApi.getSales(token);
      setSalesSummary(response.data.summary);
      setTransactions(response.data.transactions);
    } catch { if (!silent) toast.error('Failed to load sales'); }
  };

  const fetchWallet = async (silent = false) => {
    try {
      const response = await eventOwnerApi.getWallet(token);
      setWallet(response.data.wallet);
      setWalletConfigured(response.data.configured);
      if (response.data.wallet) {
        setWalletForm({
          bankName: response.data.wallet.bankName || '',
          accountName: response.data.wallet.accountName || '',
          accountNumber: '',
          routingNumber: '',
          mobileProvider: response.data.wallet.mobileProvider || '',
          mobileNumber: '',
          paypalEmail: response.data.wallet.paypalEmail || '',
          preferredMethod: response.data.wallet.preferredMethod || 'bank',
          currency: response.data.wallet.currency || 'USD',
          autoPayoutEnabled: response.data.wallet.autoPayoutEnabled || false,
          autoPayoutThreshold: response.data.wallet.autoPayoutThreshold || 100,
        });
      }
    } catch { if (!silent) toast.error('Failed to load wallet'); }
  };

  const fetchPayouts = async (silent = false) => {
    try {
      const response = await eventOwnerApi.getPayouts(token);
      setPayouts(response.data.payouts);
    } catch { if (!silent) toast.error('Failed to load payouts'); }
  };

  const fetchReels = async (silent = false) => {
    try {
      const response = await eventOwnerApi.getReels(token);
      setReels(response.data.reels);
      // Check for any active processing jobs
      const processingJob = response.data.reels.find((r: ReelJob) => r.status === 'processing' || r.status === 'pending');
      setActiveReelJob(processingJob || null);
    } catch { if (!silent) toast.error('Failed to load reels'); }
  };

  const handleSaveWallet = async () => {
    try {
      await eventOwnerApi.updateWallet(token, walletForm);
      toast.success('Wallet saved successfully');
      setShowWalletForm(false);
      fetchWallet();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save wallet');
    }
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount < 10) {
      toast.error('Minimum payout amount is $10');
      return;
    }
    try {
      await eventOwnerApi.requestPayout(token, amount, payoutNotes || undefined);
      toast.success('Payout request submitted');
      setPayoutAmount('');
      setPayoutNotes('');
      fetchPayouts();
      fetchSales();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to request payout');
    }
  };

  const handleCancelPayout = async (payoutId: string) => {
    try {
      await eventOwnerApi.cancelPayout(token, payoutId);
      toast.success('Payout request cancelled');
      fetchPayouts();
      fetchSales();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel payout');
    }
  };

  const handleReviewRsvp = async (rsvpId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await eventOwnerApi.reviewRsvp(token, rsvpId, status);
      toast.success(`RSVP ${status.toLowerCase()}`);
      fetchRsvps(); fetchEvent();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const exportRsvps = (filter: string) => {
    const filtered = filter === 'all' ? rsvps : rsvps.filter(r => r.status === filter);
    exportToCSV(filtered, `rsvps-${event?.slug || 'event'}-${filter}-${new Date().toISOString().split('T')[0]}.csv`, [
      { key: 'primaryName', label: 'Primary Name' },
      { key: 'secondaryName', label: 'Secondary Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'attendance', label: 'Attendance' },
      { key: 'guestCount', label: 'Guest Count' },
      { key: 'mealPreference', label: 'Meal Preference' },
      { key: 'dietaryNotes', label: 'Dietary Notes' },
      { key: 'note', label: 'Note' },
      { key: 'status', label: 'Status' },
      { key: 'invitation.accessCode', label: 'Access Code' },
      { key: 'invitation.isCheckedIn', label: 'Checked In' },
      { key: 'submittedAt', label: 'Submitted At' },
    ]);
    toast.success(`Exported ${filtered.length} RSVPs`);
    setExportOpen(false);
  };

  const exportCheckIns = () => {
    exportToCSV(checkIns, 'checkins.csv', [
      { key: 'invitation.rsvp.primaryName', label: 'Guest' },
      { key: 'invitation.rsvp.guestCount', label: 'Party Size' },
      { key: 'checkedInAt', label: 'Checked In' },
    ]);
    toast.success(`Exported ${checkIns.length} check-ins`);
  };

  const pendingCount = rsvps.filter(r => r.status === 'PENDING').length;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
      APPROVED: 'bg-green-50 text-green-700 border-green-200',
      REJECTED: 'bg-red-50 text-red-700 border-red-200',
      YES: 'bg-green-50 text-green-700 border-green-200',
      NO: 'bg-red-50 text-red-700 border-red-200',
      MAYBE: 'bg-blue-50 text-blue-700 border-blue-200',
    };
    return `px-2 py-0.5 rounded border text-xs font-medium ${styles[status] || 'bg-surface-50 text-surface-600 border-surface-200'}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4 text-red-500">{Icons.close}</div>
          <h1 className="text-xl font-semibold text-navy-900 mb-2">Access Denied</h1>
          <p className="text-surface-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-navy-900 truncate">{event.name}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-surface-400 hidden sm:block">Updated {formatDate(lastUpdated.toISOString(), 'h:mm a')}</span>
              <span className={cn(
                'px-2 py-1 rounded text-xs font-medium',
                event.currentPhase === 'LIVE' ? 'bg-green-50 text-green-700' : 'bg-surface-100 text-surface-600'
              )}>
                {event.currentPhase === 'LIVE' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                {event.currentPhase.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-surface-200 sticky top-14 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 -mb-px overflow-x-auto py-1">
            {([
              { id: 'dashboard', label: 'Overview', icon: Icons.rsvp },
              { id: 'rsvps', label: 'RSVPs', icon: Icons.users, badge: pendingCount },
              { id: 'media', label: 'Media', icon: Icons.message },
              // Reels tab - HIDDEN for now (feature under development)
              // ...(event?.reelEnabled ? [
              //   { id: 'reels' as Tab, label: 'Reels', icon: Icons.reel },
              // ] : []),
              { id: 'checkins', label: 'Check-ins', icon: Icons.checkin },
              // Sales & Wallet tabs only visible for paid RSVP events
              ...(event?.rsvpMode === 'paid' ? [
                { id: 'sales' as Tab, label: 'Sales', icon: Icons.sales },
                { id: 'wallet' as Tab, label: 'Wallet', icon: Icons.wallet },
              ] : []),
            ] as { id: Tab; label: string; icon: JSX.Element; badge?: number }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap',
                  activeTab === tab.id ? 'bg-navy-900 text-white' : 'text-surface-600 hover:bg-surface-100'
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={cn('px-1.5 py-0.5 rounded-full text-xs', activeTab === tab.id ? 'bg-white/20' : 'bg-amber-100 text-amber-700')}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total RSVPs', value: event._count.rsvps, icon: Icons.rsvp },
              { label: 'Approved', value: event._count.invitations, icon: Icons.users },
              { label: 'Checked In', value: event._count.checkIns, icon: Icons.checkin },
              { label: 'Messages', value: event._count.mediaAssets, icon: Icons.message },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl border border-surface-200 p-5 hover:border-surface-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-surface-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-navy-900">{stat.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-surface-50 flex items-center justify-center text-surface-400">{stat.icon}</div>
                </div>
              </div>
            ))}

            <div className="sm:col-span-2 lg:col-span-4 bg-white rounded-xl border border-surface-200 p-5">
                <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-navy-900">Recent Messages</h3>
                <button onClick={() => setActiveTab('media')} className="text-sm text-surface-500 hover:text-navy-900 transition-colors">View all</button>
              </div>
              {media.length === 0 ? (
                <p className="text-surface-400 text-center py-8">No messages yet</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {media.slice(0, 6).map(m => (
                    <div key={m.id} onClick={() => setActiveTab('media')} className="aspect-square bg-surface-100 rounded-lg cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center overflow-hidden">
                      {m.type === 'PHOTO' ? (
                        <img src={`${API_BASE_URL}${m.filePath}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-surface-400">{m.type === 'VIDEO' ? Icons.video : Icons.audio}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* RSVPs */}
        {activeTab === 'rsvps' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-1 bg-white rounded-lg p-1 border border-surface-200">
              {['all', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                  <button key={s} onClick={() => { setRsvpFilter(s); fetchRsvps(); }} className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    rsvpFilter === s ? 'bg-navy-900 text-white' : 'text-surface-600 hover:bg-surface-50'
                  )}>
                  {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button onClick={() => setExportOpen(!exportOpen)} className="btn-outline flex items-center gap-2">
                  {Icons.export} Export {Icons.chevronDown}
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-surface-200 py-1 min-w-[140px] z-10">
                    {['all', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                      <button key={f} onClick={() => exportRsvps(f)} className="w-full px-4 py-2 text-left text-sm hover:bg-surface-50 transition-colors">
                        {f === 'all' ? 'All RSVPs' : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-surface-100 bg-surface-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Guest</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Contact</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Response</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Details</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {rsvps.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-surface-400">No RSVPs</td></tr> : rsvps.map(r => (
                      <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-navy-900">{r.primaryName}</p>
                          {r.secondaryName && <p className="text-sm text-surface-500">+ {r.secondaryName}</p>}
                          <p className="text-xs text-surface-400 mt-1">{r.guestCount} guest(s)</p>
                        </td>
                        <td className="py-3 px-4">
                          {r.email && <p className="text-surface-600">{r.email}</p>}
                          {r.phone && <p className="text-surface-500">{r.phone}</p>}
                          {!r.email && !r.phone && <span className="text-surface-400">-</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={getStatusBadge(r.attendance)}>{r.attendance}</span>
                          <p className="text-xs text-surface-400 mt-1">{formatDate(r.submittedAt)}</p>
                        </td>
                        <td className="py-3 px-4 max-w-[200px]">
                          {r.mealPreference && (
                            <p className="text-surface-600 truncate" title={r.mealPreference}>
                              <span className="text-surface-400">Meal:</span> {r.mealPreference}
                            </p>
                          )}
                          {r.dietaryNotes && (
                            <p className="text-surface-600 truncate" title={r.dietaryNotes}>
                              <span className="text-surface-400">Diet:</span> {r.dietaryNotes}
                            </p>
                          )}
                          {r.note && (
                            <p className="text-surface-500 text-xs truncate italic" title={r.note}>{r.note}</p>
                          )}
                          {!r.mealPreference && !r.dietaryNotes && !r.note && <span className="text-surface-400">-</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={getStatusBadge(r.status)}>{r.status}</span>
                          {r.invitation?.isCheckedIn && <p className="text-xs text-green-600 mt-1">Checked in</p>}
                          {r.invitation && !r.invitation.isCheckedIn && (
                            <p className="text-xs text-surface-400 mt-1">Code: {r.invitation.accessCode}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2 items-center flex-wrap">
                            <button
                              onClick={() => setViewingRsvpDetails(r)}
                              className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                              title="View Details"
                            >
                              Details
                            </button>
                            {r.status !== 'APPROVED' && (
                              <button 
                                onClick={() => handleReviewRsvp(r.id, 'APPROVED')} 
                                className="px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
                              >
                                {r.status === 'PENDING' ? 'Approve' : 'Re-approve'}
                              </button>
                            )}
                            {r.status !== 'REJECTED' && (
                              <button 
                                onClick={() => handleReviewRsvp(r.id, 'REJECTED')} 
                                className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RSVP Details Modal */}
            {viewingRsvpDetails && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingRsvpDetails(null)}>
                <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="p-6 border-b border-surface-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-navy-900">RSVP Details</h3>
                      <button onClick={() => setViewingRsvpDetails(null)} className="p-2 rounded-lg hover:bg-surface-100">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-surface-500">Primary Name</label>
                        <p className="text-navy-900 font-medium">{viewingRsvpDetails.primaryName}</p>
                      </div>
                      {viewingRsvpDetails.secondaryName && (
                        <div>
                          <label className="text-sm font-medium text-surface-500">Secondary Name</label>
                          <p className="text-navy-900 font-medium">{viewingRsvpDetails.secondaryName}</p>
                        </div>
                      )}
                      {viewingRsvpDetails.email && (
                        <div>
                          <label className="text-sm font-medium text-surface-500">Email</label>
                          <p className="text-navy-900">{viewingRsvpDetails.email}</p>
                        </div>
                      )}
                      {viewingRsvpDetails.phone && (
                        <div>
                          <label className="text-sm font-medium text-surface-500">Phone</label>
                          <p className="text-navy-900">{viewingRsvpDetails.phone}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-surface-500">Attendance</label>
                        <p className="text-navy-900">
                          <span className={getStatusBadge(viewingRsvpDetails.attendance)}>{viewingRsvpDetails.attendance}</span>
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-surface-500">Guest Count</label>
                        <p className="text-navy-900">{viewingRsvpDetails.guestCount}</p>
                      </div>
                      {viewingRsvpDetails.mealPreference && (
                        <div>
                          <label className="text-sm font-medium text-surface-500">Meal Preference</label>
                          <p className="text-navy-900">{viewingRsvpDetails.mealPreference}</p>
                        </div>
                      )}
                      {viewingRsvpDetails.dietaryNotes && (
                        <div>
                          <label className="text-sm font-medium text-surface-500">Dietary Notes</label>
                          <p className="text-navy-900">{viewingRsvpDetails.dietaryNotes}</p>
                        </div>
                      )}
                      {viewingRsvpDetails.note && (
                        <div className="sm:col-span-2">
                          <label className="text-sm font-medium text-surface-500">Note</label>
                          <p className="text-navy-900">{viewingRsvpDetails.note}</p>
                        </div>
                      )}
                      {viewingRsvpDetails.submittedAt && (
                        <div>
                          <label className="text-sm font-medium text-surface-500">Submitted At</label>
                          <p className="text-navy-900">{formatDate(viewingRsvpDetails.submittedAt, 'MMM d, yyyy h:mm a')}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-surface-500">Status</label>
                        <p className="text-navy-900">
                          <span className={getStatusBadge(viewingRsvpDetails.status)}>{viewingRsvpDetails.status}</span>
                        </p>
                      </div>
                      {viewingRsvpDetails.invitation?.accessCode && (
                        <div>
                          <label className="text-sm font-medium text-surface-500">Access Code</label>
                          <p className="text-navy-900 font-mono">{viewingRsvpDetails.invitation.accessCode}</p>
                        </div>
                      )}
                      {viewingRsvpDetails.invitation?.isCheckedIn !== undefined && (
                        <div>
                          <label className="text-sm font-medium text-surface-500">Checked In</label>
                          <p className="text-navy-900">
                            {viewingRsvpDetails.invitation.isCheckedIn ? (
                              <span className="text-green-600 font-medium">Yes</span>
                            ) : (
                              <span className="text-surface-400">No</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* QR Code Display */}
                    {viewingRsvpDetails.invitation?.qrCodeData && (
                      <div className="border-t border-surface-200 pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-navy-900 mb-3">QR Code</h4>
                        <div className="flex flex-col items-center gap-3">
                          <img
                            src={viewingRsvpDetails.invitation.qrCodeData}
                            alt="QR Code"
                            className="w-48 h-48 bg-white p-2 rounded-lg border border-surface-200"
                          />
                          <p className="text-xs text-surface-500 text-center">
                            Scan this QR code for check-in
                          </p>
                        </div>
                      </div>
                    )}
                    </div>
                    
                    {viewingRsvpDetails.customFields && (() => {
                      try {
                        const customFields = JSON.parse(viewingRsvpDetails.customFields);
                        if (Object.keys(customFields).length > 0) {
                          return (
                            <div className="border-t border-surface-200 pt-4 mt-4">
                              <h4 className="text-sm font-semibold text-navy-900 mb-3">Custom Fields</h4>
                              <div className="grid sm:grid-cols-2 gap-4">
                                {Object.entries(customFields).map(([key, value]) => (
                                  <div key={key}>
                                    <label className="text-sm font-medium text-surface-500">{key}</label>
                                    <p className="text-navy-900">{String(value)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                      } catch {}
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Media */}
        {activeTab === 'media' && (
          <MediaGallery
            eventId={event.id}
            eventSlug={event.slug}
            media={media.map(m => ({ ...m, fileName: m.filePath.split('/').pop() || '', fileSize: undefined }))}
            reelEnabled={event.reelEnabled}
            onRefresh={fetchMedia}
            isAdmin={false}
            ownerToken={token as string}
          />
        )}

        {/* Reels - HIDDEN for now (feature under development) */}
        {false && activeTab === 'reels' && event?.reelEnabled && (
          <div className="space-y-6">
            {/* Active Job Progress */}
            {activeReelJob && (activeReelJob?.status === 'pending' || activeReelJob?.status === 'processing') && (
              <div className="bg-navy-50 border border-navy-200 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-navy-100 flex items-center justify-center animate-pulse">
                    {Icons.reel}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-navy-900">Generating Reel...</h3>
                    <p className="text-sm text-surface-600">
                      {activeReelJob?.videoCount} video{activeReelJob?.videoCount !== 1 ? 's' : ''} being processed
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-navy-900">{activeReelJob?.progress}%</span>
                </div>
                <div className="w-full bg-surface-200 rounded-full h-2">
                  <div
                    className="bg-navy-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${activeReelJob?.progress ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Completed Reels */}
            <div>
              <h3 className="text-lg font-semibold text-navy-900 mb-4">Your Reels</h3>
              {reels.filter(r => r.status === 'completed').length === 0 ? (
                <div className="text-center py-12 bg-surface-50 rounded-xl">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 flex items-center justify-center text-surface-400">
                    {Icons.reel}
                  </div>
                  <p className="text-surface-600 mb-2">No reels generated yet</p>
                  <p className="text-sm text-surface-400">Go to the Media tab to generate a reel from your videos</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reels.filter(r => r.status === 'completed').map(reel => (
                    <div key={reel.id} className="bg-white rounded-xl border border-surface-200 overflow-hidden group">
                      <div className="aspect-video bg-surface-100 relative">
                        <video
                          src={`${API_BASE_URL}/api/event-owner/${token}/reel/${reel.id}/download`}
                          className="w-full h-full object-cover"
                          controls
                          preload="metadata"
                        />
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-navy-900">
                            {reel.duration ? `${Math.floor(reel.duration / 60)}:${String(reel.duration % 60).padStart(2, '0')}` : 'Unknown duration'}
                          </span>
                          <span className="text-xs text-surface-500">
                            {reel.videoCount} video{reel.videoCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-surface-400 mb-3">
                          Created {formatDate(reel.completedAt || reel.createdAt)}
                        </p>
                        <a
                          href={`${API_BASE_URL}/api/event-owner/${token}/reel/${reel.id}/download`}
                          download
                          className="w-full btn-primary text-sm py-2 flex items-center justify-center gap-2"
                        >
                          {Icons.export} Download Reel
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Failed Jobs */}
            {reels.filter(r => r.status === 'failed' && !dismissedFailedReels.has(r.id)).length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-surface-600 mb-3">Failed Attempts</h4>
                <div className="space-y-2">
                  {reels.filter(r => r.status === 'failed' && !dismissedFailedReels.has(r.id)).map(reel => {
                    const errorMsg = reel.errorMessage || 'No valid video files found';
                    return (
                      <div 
                        key={reel.id} 
                        className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3"
                      >
                        <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                          {Icons.x}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-red-800">{errorMsg}</p>
                          <p className="text-xs text-red-600">{formatDate(reel.createdAt)}</p>
                        </div>
                        <button
                          onClick={() => {
                            setDismissedFailedReels(prev => new Set([...Array.from(prev), reel.id]));
                          }}
                          className="ml-2 p-1 rounded text-red-600 hover:bg-red-100 flex-shrink-0"
                          aria-label="Close"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Check-ins */}
        {activeTab === 'checkins' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-surface-500">{checkIns.length} guest(s) checked in</p>
              {checkIns.length > 0 && (
                <button onClick={exportCheckIns} className="btn-outline flex items-center gap-2">{Icons.export} Export</button>
              )}
            </div>
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-surface-100 bg-surface-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Guest</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Party</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Time</th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {checkIns.length === 0 ? <tr><td colSpan={3} className="py-12 text-center text-surface-400">No check-ins yet</td></tr> : checkIns.map(c => (
                      <tr key={c.id} className="hover:bg-surface-50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-navy-900">{c.invitation.rsvp.primaryName}</p>
                          {c.invitation.rsvp.secondaryName && <p className="text-sm text-surface-500">& {c.invitation.rsvp.secondaryName}</p>}
                        </td>
                        <td className="py-3 px-4 text-surface-600">{c.invitation.rsvp.guestCount}</td>
                        <td className="py-3 px-4 text-surface-600">{formatDate(c.checkedInAt, 'MMM d, h:mm a')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Sales */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            {/* Sales Summary */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-surface-200 p-5">
                <p className="text-sm text-surface-500 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-navy-900">${salesSummary?.totalGross?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-white rounded-xl border border-surface-200 p-5">
                <p className="text-sm text-surface-500 mb-1">Your Earnings</p>
                <p className="text-2xl font-bold text-green-600">${salesSummary?.totalNet?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-white rounded-xl border border-surface-200 p-5">
                <p className="text-sm text-surface-500 mb-1">Available Balance</p>
                <p className="text-2xl font-bold text-navy-900">${salesSummary?.availableBalance?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-white rounded-xl border border-surface-200 p-5">
                <p className="text-sm text-surface-500 mb-1">Tickets Sold</p>
                <p className="text-2xl font-bold text-navy-900">{salesSummary?.ticketsSold || 0}</p>
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="bg-white rounded-xl border border-surface-200 p-5">
              <h3 className="font-medium text-navy-900 mb-4">Fee Breakdown</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-surface-500">Platform Fees</p>
                  <p className="text-lg font-semibold text-surface-700">${salesSummary?.totalPlatformFees?.toFixed(2) || '0.00'}</p>
                </div>
                <div>
                  <p className="text-sm text-surface-500">Processing Fees</p>
                  <p className="text-lg font-semibold text-surface-700">${salesSummary?.totalProcessingFees?.toFixed(2) || '0.00'}</p>
                </div>
                <div>
                  <p className="text-sm text-surface-500">Total Payouts</p>
                  <p className="text-lg font-semibold text-surface-700">${salesSummary?.totalPayouts?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-100">
                <h3 className="font-medium text-navy-900">Recent Transactions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-surface-100 bg-surface-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Type</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Details</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {transactions.length === 0 ? (
                      <tr><td colSpan={5} className="py-12 text-center text-surface-400">No transactions yet</td></tr>
                    ) : transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-surface-50 transition-colors">
                        <td className="py-3 px-4 text-surface-600">{formatDate(tx.createdAt, 'MMM d, h:mm a')}</td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            tx.type === 'ticket_sale' ? 'bg-green-50 text-green-700' :
                            tx.type === 'refund' ? 'bg-red-50 text-red-700' :
                            tx.type === 'payout' ? 'bg-blue-50 text-blue-700' : 'bg-surface-100 text-surface-600'
                          )}>
                            {tx.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-navy-900">{tx.buyerName || tx.ticketTypeName || '-'}</p>
                          {tx.buyerEmail && <p className="text-xs text-surface-500">{tx.buyerEmail}</p>}
                          {tx.ticketQuantity > 1 && <p className="text-xs text-surface-500">{tx.ticketQuantity} tickets</p>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <p className={cn('font-medium', tx.type === 'refund' || tx.type === 'payout' ? 'text-red-600' : 'text-green-600')}>
                            {tx.type === 'refund' || tx.type === 'payout' ? '-' : '+'}${Math.abs(tx.netAmount).toFixed(2)}
                          </p>
                          {tx.grossAmount !== tx.netAmount && (
                            <p className="text-xs text-surface-400">Gross: ${tx.grossAmount.toFixed(2)}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            tx.status === 'completed' ? 'bg-green-50 text-green-700' :
                            tx.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                            tx.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-surface-100 text-surface-600'
                          )}>
                            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Wallet */}
        {activeTab === 'wallet' && (
          <div className="space-y-6">
            {/* Available Balance Card */}
            <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-xl p-6 text-white">
              <p className="text-sm opacity-80 mb-1">Available Balance</p>
              <p className="text-3xl font-bold mb-4">${salesSummary?.availableBalance?.toFixed(2) || '0.00'}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveTab('sales')}
                  className="px-4 py-2 bg-white/10 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  View Sales
                </button>
              </div>
            </div>

            {/* Wallet Configuration */}
            <div className="bg-white rounded-xl border border-surface-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-navy-900">Payout Wallet</h3>
                <button
                  onClick={() => setShowWalletForm(!showWalletForm)}
                  className="btn-outline text-sm"
                >
                  {walletConfigured ? 'Edit' : 'Configure'}
                </button>
              </div>

              {!showWalletForm && walletConfigured && wallet && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-50 flex items-center justify-center text-surface-600">
                      {wallet.preferredMethod === 'bank' ? Icons.bank : Icons.wallet}
                    </div>
                    <div>
                      <p className="font-medium text-navy-900">
                        {wallet.preferredMethod === 'bank' ? wallet.bankName : 
                         wallet.preferredMethod === 'paypal' ? 'PayPal' :
                         wallet.preferredMethod === 'mobile' ? wallet.mobileProvider : wallet.preferredMethod}
                      </p>
                      <p className="text-sm text-surface-500">
                        {wallet.preferredMethod === 'bank' ? `${wallet.accountName} - ${wallet.accountNumber}` :
                         wallet.preferredMethod === 'paypal' ? wallet.paypalEmail :
                         wallet.preferredMethod === 'mobile' ? wallet.mobileNumber : ''}
                      </p>
                    </div>
                    {wallet.isVerified && (
                      <span className="ml-auto px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                        {Icons.check} Verified
                      </span>
                    )}
                  </div>
                  <div className="pt-3 border-t border-surface-100 flex items-center gap-4 text-sm">
                    <span className="text-surface-500">Currency: <span className="font-medium text-navy-900">{wallet.currency}</span></span>
                    {wallet.autoPayoutEnabled && (
                      <span className="text-surface-500">Auto-payout at: <span className="font-medium text-navy-900">${wallet.autoPayoutThreshold}</span></span>
                    )}
                  </div>
                </div>
              )}

              {!showWalletForm && !walletConfigured && (
                <p className="text-surface-500 text-center py-8">No payout wallet configured. Click Configure to set up.</p>
              )}

              {showWalletForm && (
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Preferred Method</label>
                    <select
                      value={walletForm.preferredMethod}
                      onChange={e => setWalletForm({ ...walletForm, preferredMethod: e.target.value })}
                      className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                    >
                      <option value="bank">Bank Transfer</option>
                      <option value="paypal">PayPal</option>
                      <option value="mobile">Mobile Money</option>
                      <option value="stripe">Stripe Connect</option>
                      <option value="paystack">Paystack</option>
                    </select>
                  </div>

                  {walletForm.preferredMethod === 'bank' && (
                    <>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-surface-700 mb-1">Bank Name</label>
                          <input
                            type="text"
                            value={walletForm.bankName}
                            onChange={e => setWalletForm({ ...walletForm, bankName: e.target.value })}
                            className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-surface-700 mb-1">Account Name</label>
                          <input
                            type="text"
                            value={walletForm.accountName}
                            onChange={e => setWalletForm({ ...walletForm, accountName: e.target.value })}
                            className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-surface-700 mb-1">Account Number</label>
                          <input
                            type="text"
                            value={walletForm.accountNumber}
                            onChange={e => setWalletForm({ ...walletForm, accountNumber: e.target.value })}
                            className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-surface-700 mb-1">Routing Number</label>
                          <input
                            type="text"
                            value={walletForm.routingNumber}
                            onChange={e => setWalletForm({ ...walletForm, routingNumber: e.target.value })}
                            className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {walletForm.preferredMethod === 'paypal' && (
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">PayPal Email</label>
                      <input
                        type="email"
                        value={walletForm.paypalEmail}
                        onChange={e => setWalletForm({ ...walletForm, paypalEmail: e.target.value })}
                        className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                      />
                    </div>
                  )}

                  {walletForm.preferredMethod === 'mobile' && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Provider</label>
                        <select
                          value={walletForm.mobileProvider}
                          onChange={e => setWalletForm({ ...walletForm, mobileProvider: e.target.value })}
                          className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                        >
                          <option value="">Select provider</option>
                          <option value="mpesa">M-Pesa</option>
                          <option value="mtn">MTN Mobile Money</option>
                          <option value="airtel">Airtel Money</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Mobile Number</label>
                        <input
                          type="tel"
                          value={walletForm.mobileNumber}
                          onChange={e => setWalletForm({ ...walletForm, mobileNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">Currency</label>
                      <select
                        value={walletForm.currency}
                        onChange={e => setWalletForm({ ...walletForm, currency: e.target.value })}
                        className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                      >
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="NGN">NGN - Nigerian Naira</option>
                        <option value="KES">KES - Kenyan Shilling</option>
                        <option value="GHS">GHS - Ghanaian Cedi</option>
                        <option value="ZAR">ZAR - South African Rand</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">Auto-Payout Threshold</label>
                      <input
                        type="number"
                        value={walletForm.autoPayoutThreshold}
                        onChange={e => setWalletForm({ ...walletForm, autoPayoutThreshold: parseFloat(e.target.value) || 100 })}
                        className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={walletForm.autoPayoutEnabled}
                      onChange={e => setWalletForm({ ...walletForm, autoPayoutEnabled: e.target.checked })}
                      className="w-4 h-4 text-navy-600 rounded border-surface-300 focus:ring-navy-500"
                    />
                    <span className="text-sm text-surface-700">Enable automatic payouts when balance exceeds threshold</span>
                  </label>

                  <div className="flex gap-3 pt-4">
                    <button onClick={handleSaveWallet} className="btn-primary">Save Wallet</button>
                    <button onClick={() => setShowWalletForm(false)} className="btn-outline">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Request Payout */}
            {walletConfigured && (
              <div className="bg-white rounded-xl border border-surface-200 p-5">
                <h3 className="font-medium text-navy-900 mb-4">Request Payout</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">$</span>
                      <input
                        type="number"
                        value={payoutAmount}
                        onChange={e => setPayoutAmount(e.target.value)}
                        placeholder="0.00"
                        min="10"
                        max={salesSummary?.availableBalance || 0}
                        className="w-full pl-7 pr-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                      />
                    </div>
                    <p className="text-xs text-surface-400 mt-1">Min: $10.00</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-surface-700 mb-1">Notes (optional)</label>
                    <input
                      type="text"
                      value={payoutNotes}
                      onChange={e => setPayoutNotes(e.target.value)}
                      placeholder="e.g., Monthly withdrawal"
                      className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleRequestPayout}
                  disabled={(salesSummary?.availableBalance || 0) < 10}
                  className="btn-primary mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Request Payout
                </button>
              </div>
            )}

            {/* Payout History */}
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-100">
                <h3 className="font-medium text-navy-900">Payout History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-surface-100 bg-surface-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Method</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {payouts.length === 0 ? (
                      <tr><td colSpan={5} className="py-12 text-center text-surface-400">No payout requests yet</td></tr>
                    ) : payouts.map(p => (
                      <tr key={p.id} className="hover:bg-surface-50 transition-colors">
                        <td className="py-3 px-4 text-surface-600">{formatDate(p.createdAt, 'MMM d, yyyy')}</td>
                        <td className="py-3 px-4 font-medium text-navy-900">${p.requestedAmount.toFixed(2)} {p.currency}</td>
                        <td className="py-3 px-4 text-surface-600 capitalize">{p.payoutMethod}</td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1',
                            p.status === 'completed' ? 'bg-green-50 text-green-700' :
                            p.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                            p.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                            p.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-surface-100 text-surface-600'
                          )}>
                            {p.status === 'pending' && Icons.clock}
                            {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {p.status === 'pending' && (
                            <button
                              onClick={() => handleCancelPayout(p.id)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
