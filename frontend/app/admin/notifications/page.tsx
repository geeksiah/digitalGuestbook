'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api';
import { DashboardPageHeader, DashboardSection } from '@/components/dashboard/ui';
import toast from 'react-hot-toast';

type AudienceType = 'ALL_OWNERS' | 'ACTIVE_OWNERS' | 'PENDING_APPROVAL_OWNERS' | 'CUSTOM_OWNER_IDS';

interface Campaign {
  id: string;
  title: string;
  body: string;
  deepLink: string | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  audiences: Array<{ audienceType: AudienceType; audienceQuery?: string | null }>;
  _count?: { deliveries: number };
}

const audienceOptions: Array<{ value: AudienceType; label: string }> = [
  { value: 'ALL_OWNERS', label: 'All owners' },
  { value: 'ACTIVE_OWNERS', label: 'Active owners' },
  { value: 'PENDING_APPROVAL_OWNERS', label: 'Owners with pending approvals' },
  { value: 'CUSTOM_OWNER_IDS', label: 'Custom owner IDs' },
];

export default function AdminNotificationsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    body: '',
    deepLink: '',
    audienceType: 'ALL_OWNERS' as AudienceType,
    ownerIds: '',
    scheduleAt: '',
  });

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await adminApi.listPushCampaigns();
      setCampaigns(response.data?.campaigns || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCampaigns();
  }, []);

  const createCampaign = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and body are required');
      return;
    }
    try {
      const ownerIds = form.ownerIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      await adminApi.createPushCampaign({
        title: form.title.trim(),
        body: form.body.trim(),
        deepLink: form.deepLink.trim() || undefined,
        audienceType: form.audienceType,
        ownerIds: form.audienceType === 'CUSTOM_OWNER_IDS' ? ownerIds : undefined,
        scheduleAt: form.scheduleAt ? new Date(form.scheduleAt).toISOString() : undefined,
      });
      toast.success('Campaign created');
      setForm({
        title: '',
        body: '',
        deepLink: '',
        audienceType: 'ALL_OWNERS',
        ownerIds: '',
        scheduleAt: '',
      });
      await loadCampaigns();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to create campaign');
    }
  };

  const sendNow = async (id: string) => {
    setSendingId(id);
    try {
      const response = await adminApi.sendPushCampaignNow(id);
      const dispatch = response.data?.dispatch || {};
      toast.success(`Sent to ${dispatch.pushed || 0} devices`);
      await loadCampaigns();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to send campaign');
    } finally {
      setSendingId(null);
    }
  };

  const scheduledCount = useMemo(
    () => campaigns.filter((campaign) => campaign.status === 'SCHEDULED').length,
    [campaigns]
  );

  return (
    <div className="space-y-7">
      <DashboardPageHeader
        title="Notifications Campaigns"
        subtitle="Send marketing push notifications to owners (send now or schedule)"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Campaigns</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{campaigns.length}</p>
        </div>
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Scheduled</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{scheduledCount}</p>
        </div>
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Sent</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{campaigns.filter((campaign) => campaign.status === 'SENT').length}</p>
        </div>
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Draft</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{campaigns.filter((campaign) => campaign.status === 'DRAFT').length}</p>
        </div>
      </div>

      <DashboardSection title="Create Campaign" subtitle="Compose notification and choose audience">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <input
            className="input"
            placeholder="Deep link (optional)"
            value={form.deepLink}
            onChange={(event) => setForm((prev) => ({ ...prev, deepLink: event.target.value }))}
          />
          <textarea
            className="input md:col-span-2 min-h-[110px]"
            placeholder="Body"
            value={form.body}
            onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
          />
          <select
            className="input"
            value={form.audienceType}
            onChange={(event) => setForm((prev) => ({ ...prev, audienceType: event.target.value as AudienceType }))}
          >
            {audienceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="datetime-local"
            value={form.scheduleAt}
            onChange={(event) => setForm((prev) => ({ ...prev, scheduleAt: event.target.value }))}
          />
          {form.audienceType === 'CUSTOM_OWNER_IDS' ? (
            <input
              className="input md:col-span-2"
              placeholder="Comma separated owner IDs"
              value={form.ownerIds}
              onChange={(event) => setForm((prev) => ({ ...prev, ownerIds: event.target.value }))}
            />
          ) : null}
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" onClick={createCampaign}>
              Create campaign
            </button>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Campaign List" subtitle="Send immediately or track delivery">
        {loading ? (
          <div className="text-center py-10 text-surface-500">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-10 text-surface-500">No campaigns yet.</div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-surface-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-900">{campaign.title}</p>
                    <p className="text-sm text-surface-600 mt-1">{campaign.body}</p>
                    <p className="text-xs text-surface-500 mt-2">
                      Status: {campaign.status}
                      {campaign.scheduledAt ? ` | Scheduled: ${new Date(campaign.scheduledAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <button
                    className="btn-outline"
                    disabled={sendingId === campaign.id}
                    onClick={() => sendNow(campaign.id)}
                  >
                    {sendingId === campaign.id ? 'Sending...' : 'Send now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
