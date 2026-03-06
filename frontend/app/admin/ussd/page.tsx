'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { eventsApi, ussdApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  DashboardHeroHeader,
  DashboardSection,
  DashboardKpiCard,
  EntityListRow,
  InsightPanel,
  MetricStrip,
  SplitPanelLayout,
} from '@/components/dashboard/ui';

type Channel = {
  id: string;
  codeLabel: string;
  shortcode?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  bindings?: Array<{
    id: string;
    eventId: string;
    isActive: boolean;
    event?: { id: string; name: string; slug: string } | null;
  }>;
};

type EventLite = {
  id: string;
  name: string;
  slug: string;
};

type WalletResponse = {
  wallet: {
    id: string;
    eventId: string;
    balanceUnits: number;
  };
  ledger: Array<{
    id: string;
    amountUnits: number;
    entryType: string;
    reference: string;
    createdAt: string;
  }>;
};

export default function AdminUssdPage() {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [walletData, setWalletData] = useState<WalletResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [newShortcode, setNewShortcode] = useState('');
  const [topupUnits, setTopupUnits] = useState(100);
  const [topupReference, setTopupReference] = useState('');
  const [topupNote, setTopupNote] = useState('');

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const activeBindingCount = channels.reduce((sum, channel) => sum + (channel.bindings || []).filter((binding) => binding.isActive).length, 0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [channelsRes, eventsRes] = await Promise.all([
        ussdApi.listChannels(),
        eventsApi.list(),
      ]);
      const eventRows = Array.isArray(eventsRes.data?.events) ? eventsRes.data.events : [];
      const channelRows = Array.isArray(channelsRes.data?.channels) ? channelsRes.data.channels : [];

      setEvents(eventRows.map((event: any) => ({
        id: String(event.id),
        name: String(event.name || 'Untitled event'),
        slug: String(event.slug || ''),
      })));
      setChannels(channelRows as Channel[]);

      setSelectedEventId((current) => current && eventRows.some((event: any) => event.id === current) ? current : eventRows[0]?.id || '');
      setSelectedChannelId((current) => current && channelRows.some((channel: any) => channel.id === current) ? current : channelRows[0]?.id || '');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to load USSD controls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const loadWallet = async (eventId: string) => {
    if (!eventId) {
      setWalletData(null);
      return;
    }
    try {
      const response = await ussdApi.getEventWallet(eventId);
      setWalletData(response.data as WalletResponse);
    } catch (error: any) {
      setWalletData(null);
      toast.error(error?.response?.data?.error || 'Unable to load wallet');
    }
  };

  useEffect(() => {
    void loadWallet(selectedEventId);
  }, [selectedEventId]);

  const createChannel = async () => {
    if (!newCodeLabel.trim()) {
      toast.error('Enter channel label');
      return;
    }
    setSaving(true);
    try {
      await ussdApi.createChannel({
        codeLabel: newCodeLabel.trim(),
        shortcode: newShortcode.trim() || undefined,
      });
      setNewCodeLabel('');
      setNewShortcode('');
      await loadData();
      toast.success('USSD channel created');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to create channel');
    } finally {
      setSaving(false);
    }
  };

  const bindChannel = async () => {
    if (!selectedEventId || !selectedChannelId) {
      toast.error('Select event and channel');
      return;
    }
    setSaving(true);
    try {
      await ussdApi.bindChannel({
        eventId: selectedEventId,
        ussdChannelId: selectedChannelId,
        isActive: true,
      });
      await Promise.all([loadData(), loadWallet(selectedEventId)]);
      toast.success('USSD channel connected to event');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Unable to connect channel');
    } finally {
      setSaving(false);
    }
  };

  const toggleBinding = async (bindingId: string, nextState: boolean) => {
    setSaving(true);
    try {
      await ussdApi.toggleBinding(bindingId, nextState);
      await loadData();
      toast.success(nextState ? 'Binding activated' : 'Binding paused');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Unable to update binding');
    } finally {
      setSaving(false);
    }
  };

  const topupWallet = async () => {
    if (!selectedEventId) {
      toast.error('Select an event');
      return;
    }
    if (!topupReference.trim()) {
      toast.error('Enter topup reference');
      return;
    }
    setSaving(true);
    try {
      await ussdApi.topupEventWalletManual(selectedEventId, {
        units: Math.max(1, Math.floor(topupUnits)),
        reference: topupReference.trim(),
        note: topupNote.trim() || undefined,
      });
      setTopupReference('');
      setTopupNote('');
      await loadWallet(selectedEventId);
      toast.success('Wallet topped up');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to top up wallet');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="mobile-stack-section">
      <DashboardHeroHeader
        eyebrow="Admin USSD"
        title="USSD channels and credits"
        subtitle="Connect offline channels to events, keep balances topped up, and review channel activity without leaving the admin workspace."
        action={selectedEvent ? (
          <>
            <Link href={`/admin/events/${selectedEvent.id}`} className="btn-outline">Event dashboard</Link>
            <Link href={`/admin/events/${selectedEvent.id}/voting`} className="btn-primary">Voting workspace</Link>
          </>
        ) : undefined}
      />

      <MetricStrip>
        <DashboardKpiCard label="Channels" value={channels.length} hint="Offline channels registered in EventPeepo" />
        <DashboardKpiCard label="Active bindings" value={activeBindingCount} tone="emerald" hint="Event and channel connections currently active" />
        <DashboardKpiCard label="Selected balance" value={walletData?.wallet?.balanceUnits ?? 0} tone="blue" hint="Available units for the selected event" />
        <DashboardKpiCard label="Recent entries" value={walletData?.ledger?.length ?? 0} tone="violet" hint="Latest wallet ledger activity" />
      </MetricStrip>

      <SplitPanelLayout
        main={(
          <div className="space-y-4">
            <DashboardSection title="Connect a channel" subtitle="Choose an event, then attach one of the offline channels already created.">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                <select className="input" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                </select>
                <select className="input" value={selectedChannelId} onChange={(event) => setSelectedChannelId(event.target.value)}>
                  {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.codeLabel} ({channel.status})</option>)}
                </select>
                <button className="btn-primary" onClick={bindChannel} disabled={saving}>Connect</button>
              </div>
            </DashboardSection>

            <DashboardSection title="Channel inventory" subtitle="Review channel status and pause or activate event bindings as needed.">
              {channels.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center text-sm text-surface-500">
                  No channels created yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {channels.map((channel) => (
                    <div key={channel.id} className="detail-card p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-base font-semibold text-brand-900">{channel.codeLabel}</p>
                            <p className="mt-1 text-sm text-surface-500">{channel.shortcode || 'No shortcode'} · {channel.status}</p>
                          </div>
                        </div>

                        {(channel.bindings || []).length === 0 ? (
                          <div className="rounded-2xl bg-surface-50 px-4 py-3 text-sm text-surface-500">No event bindings yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {channel.bindings?.map((binding) => (
                              <EntityListRow
                                key={binding.id}
                                title={binding.event?.name || binding.eventId}
                                subtitle={<span className="text-sm text-surface-500">/{binding.event?.slug || ''}</span>}
                                meta={<span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', binding.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-600')}>{binding.isActive ? 'Active' : 'Paused'}</span>}
                                actions={<button className="btn-outline" disabled={saving} onClick={() => toggleBinding(binding.id, !binding.isActive)}>{binding.isActive ? 'Pause' : 'Activate'}</button>}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DashboardSection>
          </div>
        )}
        side={(
          <div className="space-y-4">
            <InsightPanel title="Create an offline channel" subtitle="Record channels that were purchased or provisioned outside the platform.">
              <div className="space-y-3">
                <input className="input" placeholder="Channel label" value={newCodeLabel} onChange={(event) => setNewCodeLabel(event.target.value)} />
                <input className="input" placeholder="Shortcode (optional)" value={newShortcode} onChange={(event) => setNewShortcode(event.target.value)} />
                <button className="btn-primary w-full" onClick={createChannel} disabled={saving}>Create channel</button>
              </div>
            </InsightPanel>

            <InsightPanel title="Credit wallet" subtitle="Top up the selected event wallet and review recent credit activity.">
              <div className="space-y-3">
                <div className="rounded-2xl bg-surface-50 px-4 py-4">
                  <p className="text-sm text-surface-500">Selected event</p>
                  <p className="mt-1 font-semibold text-brand-900">{selectedEvent?.name || '-'}</p>
                  <p className="mt-3 text-sm text-surface-500">Balance</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-brand-900">{walletData?.wallet?.balanceUnits ?? 0} units</p>
                </div>
                <input className="input" type="number" min={1} value={topupUnits} onChange={(event) => setTopupUnits(Number(event.target.value || 1))} />
                <input className="input" placeholder="Reference" value={topupReference} onChange={(event) => setTopupReference(event.target.value)} />
                <input className="input" placeholder="Note (optional)" value={topupNote} onChange={(event) => setTopupNote(event.target.value)} />
                <button className="btn-primary w-full" onClick={topupWallet} disabled={saving}>Top up credits</button>
                <div className="space-y-2">
                  {(walletData?.ledger || []).slice(0, 8).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-brand-900">{entry.entryType}</p>
                        <p className="truncate text-xs text-surface-500">{entry.reference}</p>
                      </div>
                      <span className={entry.amountUnits >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                        {entry.amountUnits >= 0 ? '+' : ''}{entry.amountUnits}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </InsightPanel>
          </div>
        )}
      />
    </div>
  );
}
