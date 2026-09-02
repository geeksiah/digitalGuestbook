'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api';
import {
  EmptyState,
  ListSkeleton,
  PageHeader,
  StatRow,
  StatusBadge,
} from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Overlay';
import { Plus } from '@/components/ui/icons';
import { formatCount, formatDate, humanizeEnum, getErrorMessage } from '@/lib/utils';
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
  const [showCompose, setShowCompose] = useState(false);
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
      toast.error(getErrorMessage(error, 'Failed to load campaigns'));
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
      toast.error(getErrorMessage(error, 'Failed to create campaign'));
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
      toast.error(getErrorMessage(error, 'Failed to send campaign'));
    } finally {
      setSendingId(null);
    }
  };

  const scheduledCount = useMemo(
    () => campaigns.filter((campaign) => campaign.status === 'SCHEDULED').length,
    [campaigns]
  );

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowCompose(true)}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            New campaign
          </button>
        }
        mobileActions={
          <button type="button" className="icon-btn" onClick={() => setShowCompose(true)} aria-label="New campaign">
            <Plus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        }
      />

      <StatRow
        items={[
          { label: 'Campaigns', value: formatCount(campaigns.length) },
          { label: 'Scheduled', value: formatCount(scheduledCount) },
          { label: 'Sent', value: formatCount(campaigns.filter((c) => c.status === 'SENT').length), tone: 'positive' },
          { label: 'Draft', value: formatCount(campaigns.filter((c) => c.status === 'DRAFT').length) },
        ]}
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          hint="Push notifications reach owners in the EventPeepo mobile app."
          action={
            <button type="button" className="btn-primary btn-sm" onClick={() => setShowCompose(true)}>
              New campaign
            </button>
          }
        />
      ) : (
        <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-brand-900">{campaign.title}</span>
                  <StatusBadge tone={campaignTone(campaign.status)}>{humanizeEnum(campaign.status)}</StatusBadge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-surface-700">{campaign.body}</p>
                {campaign.scheduledAt ? (
                  <p className="mt-0.5 meta">Scheduled {formatDate(campaign.scheduledAt, 'MMM d, yyyy p')}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="btn-outline btn-sm shrink-0"
                disabled={sendingId === campaign.id || campaign.status === 'SENT'}
                onClick={() => sendNow(campaign.id)}
              >
                {sendingId === campaign.id ? 'Sending…' : 'Send now'}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showCompose}
        onClose={() => setShowCompose(false)}
        title="New campaign"
        size="md"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowCompose(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!form.title.trim() || !form.body.trim()}
              onClick={async () => {
                await createCampaign();
                setShowCompose(false);
              }}
            >
              Create campaign
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="campaign-title">
              Title
            </label>
            <input
              id="campaign-title"
              data-autofocus
              className="input"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="campaign-body">
              Message
            </label>
            <textarea
              id="campaign-body"
              className="input"
              rows={4}
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="campaign-audience">
              Audience
            </label>
            <select
              id="campaign-audience"
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
          </div>

          {form.audienceType === 'CUSTOM_OWNER_IDS' ? (
            <div>
              <label className="label" htmlFor="campaign-owners">
                Owner IDs
              </label>
              <input
                id="campaign-owners"
                className="input font-mono"
                value={form.ownerIds}
                onChange={(event) => setForm((prev) => ({ ...prev, ownerIds: event.target.value }))}
                placeholder="id-1, id-2"
              />
              <p className="field-hint">Separate with commas.</p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="campaign-schedule">
                Send at <span className="font-normal text-surface-600">(optional)</span>
              </label>
              <input
                id="campaign-schedule"
                className="input"
                type="datetime-local"
                value={form.scheduleAt}
                onChange={(event) => setForm((prev) => ({ ...prev, scheduleAt: event.target.value }))}
              />
              <p className="field-hint">Leave empty to save as a draft you send by hand.</p>
            </div>
            <div>
              <label className="label" htmlFor="campaign-link">
                Deep link <span className="font-normal text-surface-600">(optional)</span>
              </label>
              <input
                id="campaign-link"
                className="input"
                value={form.deepLink}
                onChange={(event) => setForm((prev) => ({ ...prev, deepLink: event.target.value }))}
                placeholder="eventpeepo://events"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Campaign states mapped onto the shared status tones. */
function campaignTone(status: string): 'success' | 'info' | 'neutral' {
  if (status === 'SENT') return 'success';
  if (status === 'SCHEDULED') return 'info';
  return 'neutral';
}
