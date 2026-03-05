'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { eventsApi, ussdApi } from '@/lib/api';

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [channelsRes, eventsRes] = await Promise.all([
        ussdApi.listChannels(),
        eventsApi.list(),
      ]);
      const eventRows = Array.isArray(eventsRes.data?.events) ? eventsRes.data.events : [];
      const channelRows = Array.isArray(channelsRes.data?.channels) ? channelsRes.data.channels : [];
      setEvents(
        eventRows.map((event: any) => ({
          id: String(event.id),
          name: String(event.name || 'Untitled event'),
          slug: String(event.slug || ''),
        }))
      );
      setChannels(channelRows as Channel[]);

      setSelectedEventId((current) =>
        current && eventRows.some((event: any) => event.id === current)
          ? current
          : eventRows[0]?.id || ''
      );
      setSelectedChannelId((current) =>
        current && channelRows.some((channel: any) => channel.id === current)
          ? current
          : channelRows[0]?.id || ''
      );
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
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="dashboard-canvas p-4 sm:p-5 space-y-2">
        <h1 className="text-2xl font-bold text-brand-900">USSD Controls</h1>
        <p className="text-sm text-surface-600">
          Manage offline channels, connect channels to events, and handle credit wallets.
        </p>
      </section>

      <section className="dashboard-canvas p-4 sm:p-5 space-y-3">
        <h2 className="text-lg font-semibold text-brand-900">Create Offline Channel</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr,220px,auto] gap-2">
          <input
            className="input"
            placeholder="Channel label (provider username)"
            value={newCodeLabel}
            onChange={(event) => setNewCodeLabel(event.target.value)}
          />
          <input
            className="input"
            placeholder="Shortcode (optional)"
            value={newShortcode}
            onChange={(event) => setNewShortcode(event.target.value)}
          />
          <button className="btn-primary" onClick={createChannel} disabled={saving}>
            Create
          </button>
        </div>
      </section>

      <section className="dashboard-canvas p-4 sm:p-5 space-y-3">
        <h2 className="text-lg font-semibold text-brand-900">Connect Channel To Event</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-2">
          <select
            className="input"
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={selectedChannelId}
            onChange={(event) => setSelectedChannelId(event.target.value)}
          >
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.codeLabel} ({channel.status})
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={bindChannel} disabled={saving}>
            Connect
          </button>
        </div>
      </section>

      <section className="dashboard-canvas p-4 sm:p-5 space-y-3">
        <h2 className="text-lg font-semibold text-brand-900">Channels</h2>
        {channels.length === 0 ? (
          <p className="text-sm text-surface-500">No channels created yet.</p>
        ) : (
          <div className="space-y-2">
            {channels.map((channel) => (
              <article key={channel.id} className="rounded-lg border border-surface-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-brand-900">{channel.codeLabel}</p>
                    <p className="text-xs text-surface-600">
                      {channel.shortcode || 'No shortcode'} - {channel.status}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  {(channel.bindings || []).length === 0 ? (
                    <p className="text-xs text-surface-500">No active bindings.</p>
                  ) : (
                    channel.bindings?.map((binding) => (
                      <div key={binding.id} className="flex items-center justify-between rounded-md border border-surface-100 px-2 py-1.5">
                        <p className="text-xs text-surface-700">
                          {binding.event?.name || binding.eventId} ({binding.isActive ? 'active' : 'paused'})
                        </p>
                        <button
                          className="btn-outline text-xs"
                          disabled={saving}
                          onClick={() => toggleBinding(binding.id, !binding.isActive)}
                        >
                          {binding.isActive ? 'Pause' : 'Activate'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-canvas p-4 sm:p-5 space-y-3">
        <h2 className="text-lg font-semibold text-brand-900">USSD Credits Wallet</h2>
        <p className="text-sm text-surface-600">
          Event: <span className="font-medium text-brand-900">{selectedEvent?.name || '-'}</span>
        </p>
        <p className="text-sm text-surface-600">
          Balance: <span className="font-semibold text-brand-900">{walletData?.wallet?.balanceUnits ?? 0} units</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[120px,220px,1fr,auto] gap-2">
          <input
            className="input"
            type="number"
            min={1}
            value={topupUnits}
            onChange={(event) => setTopupUnits(Number(event.target.value || 1))}
          />
          <input
            className="input"
            placeholder="Reference"
            value={topupReference}
            onChange={(event) => setTopupReference(event.target.value)}
          />
          <input
            className="input"
            placeholder="Note (optional)"
            value={topupNote}
            onChange={(event) => setTopupNote(event.target.value)}
          />
          <button className="btn-primary" onClick={topupWallet} disabled={saving}>
            Top Up
          </button>
        </div>
        <div className="space-y-1">
          {(walletData?.ledger || []).slice(0, 10).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-md border border-surface-100 px-2 py-1.5 text-xs">
              <span className="text-surface-700">
                {entry.entryType} - {entry.reference}
              </span>
              <span className={entry.amountUnits >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {entry.amountUnits >= 0 ? '+' : ''}
                {entry.amountUnits}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
