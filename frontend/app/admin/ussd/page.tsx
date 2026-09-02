'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { eventsApi, ussdApi } from '@/lib/api';
import { cn, formatCount, humanizeEnum, getErrorMessage } from '@/lib/utils';
import {
  EmptyState,
  PageHeader,
  PageSkeleton,
  Panel,
  StatRow,
  StatusBadge,
  SubmitButton,
} from '@/components/ui/Primitives';
import { Menu, MenuItem, Modal } from '@/components/ui/Overlay';

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
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

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
      toast.error(getErrorMessage(error, 'Failed to load USSD controls'));
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
      toast.error(getErrorMessage(error, 'Unable to load wallet'));
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
      toast.error(getErrorMessage(error, 'Failed to create channel'));
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
      toast.error(getErrorMessage(error, 'Unable to connect channel'));
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
      toast.error(getErrorMessage(error, 'Unable to update binding'));
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
      toast.error(getErrorMessage(error, 'Failed to top up wallet'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageSkeleton stats={3} rows={4} />;
  }

  return (
    <div className="page">
      <PageHeader
        title="USSD"
        actions={
          selectedEvent ? (
            <>
              <Link href={`/admin/events/${selectedEvent.id}`} className="btn-outline">
                Event
              </Link>
              <Link href={`/admin/events/${selectedEvent.id}/voting`} className="btn-primary">
                Voting
              </Link>
            </>
          ) : null
        }
        mobileActions={
          selectedEvent ? (
            <Menu label="Event links" sheetTitle={selectedEvent.name}>
              <MenuItem href={`/admin/events/${selectedEvent.id}`}>Open event</MenuItem>
              <MenuItem href={`/admin/events/${selectedEvent.id}/voting`}>Open voting</MenuItem>
            </Menu>
          ) : null
        }
      />

      <StatRow
        items={[
          { label: 'Channels', value: formatCount(channels.length) },
          { label: 'Active bindings', value: formatCount(activeBindingCount), tone: 'positive' },
          { label: 'Credit balance', value: formatCount(walletData?.wallet?.balanceUnits ?? 0), hint: 'Selected event' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)] xl:gap-6">
        <div className="space-y-4">
          <Panel
            title="Channels"
            action={
              <>
                <button type="button" className="btn-outline btn-sm" onClick={() => setShowConnect(true)}>
                  Connect
                </button>
                <button type="button" className="btn-primary btn-sm" onClick={() => setShowNewChannel(true)}>
                  New channel
                </button>
              </>
            }
            flush
          >
            {channels.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  title="No channels yet"
                  hint="Add the shortcodes you have provisioned, then connect them to events."
                  action={
                    <button type="button" className="btn-primary btn-sm" onClick={() => setShowNewChannel(true)}>
                      New channel
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-surface-200">
                {channels.map((channel) => (
                  <div key={channel.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-brand-900">{channel.codeLabel}</span>
                      <StatusBadge tone={channel.status === 'ACTIVE' ? 'success' : 'neutral'} dot>
                        {humanizeEnum(channel.status)}
                      </StatusBadge>
                      <span className="meta font-mono">{channel.shortcode || 'No shortcode'}</span>
                    </div>

                    {(channel.bindings || []).length === 0 ? (
                      <p className="mt-1 meta">Not connected to an event yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {channel.bindings?.map((binding) => (
                          <li
                            key={binding.id}
                            className="flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-surface-900">
                                {binding.event?.name || binding.eventId}
                              </p>
                              <p className="truncate meta font-mono">/{binding.event?.slug || ''}</p>
                            </div>
                            <StatusBadge tone={binding.isActive ? 'success' : 'neutral'}>
                              {binding.isActive ? 'Active' : 'Paused'}
                            </StatusBadge>
                            <button
                              type="button"
                              className="btn-outline btn-sm shrink-0"
                              disabled={saving}
                              onClick={() => toggleBinding(binding.id, !binding.isActive)}
                            >
                              {binding.isActive ? 'Pause' : 'Activate'}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Credits">
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="ussd-event">
                  Event
                </label>
                <select
                  id="ussd-event"
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
              </div>

              <div className="surface-muted px-4 py-3">
                <p className="text-[13px] font-medium text-surface-600">Balance</p>
                <p className="num mt-0.5 text-2xl font-semibold tracking-tight text-brand-900">
                  {formatCount(walletData?.wallet?.balanceUnits ?? 0)}
                  <span className="ml-1 text-sm font-medium text-surface-600">units</span>
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="topup-units">
                    Units
                  </label>
                  <input
                    id="topup-units"
                    className="input"
                    type="number"
                    min={1}
                    value={topupUnits}
                    onChange={(event) => setTopupUnits(Number(event.target.value || 1))}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="topup-reference">
                    Reference
                  </label>
                  <input
                    id="topup-reference"
                    className="input"
                    value={topupReference}
                    onChange={(event) => setTopupReference(event.target.value)}
                    placeholder="Invoice or receipt"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="topup-note">
                    Note <span className="font-normal text-surface-600">(optional)</span>
                  </label>
                  <input
                    id="topup-note"
                    className="input"
                    value={topupNote}
                    onChange={(event) => setTopupNote(event.target.value)}
                  />
                </div>
              </div>

              <SubmitButton loading={saving} className="btn-primary btn-block" onClick={topupWallet}>
                Add credits
              </SubmitButton>
            </div>
          </Panel>

          <Panel title="Recent credit activity" flush>
            {(walletData?.ledger || []).length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState title="No activity yet" />
              </div>
            ) : (
              <div className="divide-y divide-surface-200">
                {(walletData?.ledger || []).slice(0, 8).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900">{humanizeEnum(entry.entryType)}</p>
                      <p className="truncate meta">{entry.reference}</p>
                    </div>
                    <span
                      className={cn(
                        'num shrink-0 text-sm font-semibold',
                        entry.amountUnits >= 0 ? 'text-emerald-700' : 'text-red-600'
                      )}
                    >
                      {entry.amountUnits >= 0 ? '+' : ''}
                      {formatCount(entry.amountUnits)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Modal
        open={showNewChannel}
        onClose={() => setShowNewChannel(false)}
        title="New channel"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowNewChannel(false)} disabled={saving}>
              Cancel
            </button>
            <SubmitButton
              loading={saving}
              disabled={!newCodeLabel.trim()}
              onClick={async () => {
                await createChannel();
                setShowNewChannel(false);
              }}
            >
              Create channel
            </SubmitButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="channel-label">
              Label
            </label>
            <input
              id="channel-label"
              data-autofocus
              className="input"
              value={newCodeLabel}
              onChange={(event) => setNewCodeLabel(event.target.value)}
              placeholder="MTN Ghana voting line"
            />
          </div>
          <div>
            <label className="label" htmlFor="channel-shortcode">
              Shortcode <span className="font-normal text-surface-600">(optional)</span>
            </label>
            <input
              id="channel-shortcode"
              className="input font-mono"
              value={newShortcode}
              onChange={(event) => setNewShortcode(event.target.value)}
              placeholder="*713*45#"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showConnect}
        onClose={() => setShowConnect(false)}
        title="Connect a channel"
        description="Attach an existing channel to an event."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowConnect(false)} disabled={saving}>
              Cancel
            </button>
            <SubmitButton
              loading={saving}
              disabled={!selectedEventId || !selectedChannelId}
              onClick={async () => {
                await bindChannel();
                setShowConnect(false);
              }}
            >
              Connect
            </SubmitButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="connect-event">
              Event
            </label>
            <select
              id="connect-event"
              data-autofocus
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
          </div>
          <div>
            <label className="label" htmlFor="connect-channel">
              Channel
            </label>
            <select
              id="connect-channel"
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
          </div>
        </div>
      </Modal>
    </div>
  );
}
