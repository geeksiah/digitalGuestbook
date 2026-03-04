'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ownerDashboardApi } from '@/lib/api';

type VoteMode = 'AWARDS' | 'ELECTION';

type EventLite = {
  id: string;
  name: string;
  slug: string;
};

type VotingConfig = {
  mode: VoteMode;
  isEnabled: boolean;
  allowFreeVotes: boolean;
  allowPaidVotes: boolean;
  requireOtpForElection: boolean;
  voteUnitPrice: number;
  currency: string;
  maxVotesPerPurchase: number;
  freeVoteLabel?: string | null;
  paidVoteLabel?: string | null;
};

type VotingOption = {
  id: string;
  contestId: string;
  name: string;
  description?: string | null;
  totalVotes: number;
  freeVotes: number;
  paidVotes: number;
  isActive: boolean;
};

type VotingContest = {
  id: string;
  title: string;
  mode: VoteMode;
  description?: string | null;
  isActive: boolean;
  options: VotingOption[];
};

type VotingAnalytics = {
  totals: {
    totalVotes: number;
    uniqueVoters: number;
    freeVotes: number;
    paidVotes: number;
    paidRevenue: number;
    conversionRate: number;
    paidIntentConversionRate: number;
  };
  perContest: Array<{
    contestId: string;
    title: string;
    totalVotes: number;
    uniqueVoters: number;
    freeVotes: number;
    paidVotes: number;
  }>;
  leaderboard: Array<{
    optionId: string;
    contestId: string;
    name: string;
    totalVotes: number;
    growthDelta: number;
  }>;
  timeSeries: {
    byDay: Array<{
      day: string;
      votes: number;
      freeVotes: number;
      paidVotes: number;
    }>;
  };
};

const formatMoney = (currency: string, amount: number) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

export default function OwnerVotingPage() {
  const params = useParams();
  const eventId = String(params.id || '');

  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingContest, setSavingContest] = useState(false);
  const [savingOption, setSavingOption] = useState(false);

  const [event, setEvent] = useState<EventLite | null>(null);
  const [config, setConfig] = useState<VotingConfig | null>(null);
  const [contests, setContests] = useState<VotingContest[]>([]);
  const [options, setOptions] = useState<VotingOption[]>([]);
  const [analytics, setAnalytics] = useState<VotingAnalytics | null>(null);
  const [selectedContestId, setSelectedContestId] = useState('');

  const [newContestTitle, setNewContestTitle] = useState('');
  const [newContestMode, setNewContestMode] = useState<VoteMode>('AWARDS');
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionDescription, setNewOptionDescription] = useState('');

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === selectedContestId) || null,
    [contests, selectedContestId]
  );

  const loadVotingConfig = async () => {
    const response = await ownerDashboardApi.getVotingConfig(eventId);
    setConfig(response.data?.config || null);
  };

  const loadContests = async () => {
    const response = await ownerDashboardApi.getVotingContests(eventId);
    const dataContests = (response.data?.contests || []) as VotingContest[];
    setContests(dataContests);
    setSelectedContestId((current) => current || dataContests[0]?.id || '');
  };

  const loadAnalytics = async () => {
    const response = await ownerDashboardApi.getVotingAnalytics(eventId);
    setAnalytics(response.data as VotingAnalytics);
  };

  const loadOptions = async (contestId: string) => {
    if (!contestId) {
      setOptions([]);
      return;
    }
    const response = await ownerDashboardApi.getVotingOptions(eventId, contestId);
    setOptions((response.data?.options || []) as VotingOption[]);
  };

  const loadData = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const eventResponse = await ownerDashboardApi.getEvent(eventId);
      const eventPayload = eventResponse.data?.event || null;
      setEvent(eventPayload ? { id: eventPayload.id, name: eventPayload.name, slug: eventPayload.slug } : null);

      await Promise.all([loadVotingConfig(), loadContests(), loadAnalytics()]);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to load voting dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    void loadOptions(selectedContestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContestId]);

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const payload = {
        ...config,
        currency: String(config.currency || 'USD').toUpperCase(),
      };
      const response = await ownerDashboardApi.updateVotingConfig(eventId, payload);
      setConfig(response.data?.config || config);
      toast.success('Voting config updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update voting config');
    } finally {
      setSavingConfig(false);
    }
  };

  const createContest = async () => {
    if (!newContestTitle.trim()) {
      toast.error('Enter contest title');
      return;
    }
    setSavingContest(true);
    try {
      await ownerDashboardApi.createVotingContest(eventId, {
        title: newContestTitle.trim(),
        mode: newContestMode,
      });
      setNewContestTitle('');
      await loadContests();
      await loadAnalytics();
      toast.success('Contest created');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to create contest');
    } finally {
      setSavingContest(false);
    }
  };

  const toggleContestStatus = async (contest: VotingContest) => {
    try {
      await ownerDashboardApi.updateVotingContest(eventId, contest.id, {
        isActive: !contest.isActive,
      });
      await loadContests();
      toast.success(`Contest ${contest.isActive ? 'disabled' : 'enabled'}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update contest');
    }
  };

  const renameContest = async (contest: VotingContest) => {
    const title = window.prompt('Update contest title', contest.title);
    if (!title || !title.trim()) return;
    try {
      await ownerDashboardApi.updateVotingContest(eventId, contest.id, {
        title: title.trim(),
      });
      await loadContests();
      toast.success('Contest updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update contest');
    }
  };

  const deleteContest = async (contest: VotingContest) => {
    if (!window.confirm(`Delete contest "${contest.title}" and all nominees/votes?`)) return;
    try {
      await ownerDashboardApi.deleteVotingContest(eventId, contest.id);
      if (selectedContestId === contest.id) {
        setSelectedContestId('');
      }
      await loadContests();
      await loadAnalytics();
      toast.success('Contest deleted');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to delete contest');
    }
  };

  const createNominee = async () => {
    if (!selectedContestId) {
      toast.error('Select a contest first');
      return;
    }
    if (!newOptionName.trim()) {
      toast.error('Enter nominee name');
      return;
    }
    setSavingOption(true);
    try {
      await ownerDashboardApi.createVotingOption(eventId, selectedContestId, {
        name: newOptionName.trim(),
        description: newOptionDescription.trim() || undefined,
      });
      setNewOptionName('');
      setNewOptionDescription('');
      await Promise.all([loadOptions(selectedContestId), loadContests(), loadAnalytics()]);
      toast.success('Nominee added');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to add nominee');
    } finally {
      setSavingOption(false);
    }
  };

  const renameNominee = async (option: VotingOption) => {
    const nextName = window.prompt('Update nominee name', option.name);
    if (!nextName || !nextName.trim()) return;
    try {
      await ownerDashboardApi.updateVotingOption(eventId, option.id, { name: nextName.trim() });
      await Promise.all([loadOptions(selectedContestId), loadContests()]);
      toast.success('Nominee updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update nominee');
    }
  };

  const toggleNomineeStatus = async (option: VotingOption) => {
    try {
      await ownerDashboardApi.updateVotingOption(eventId, option.id, {
        isActive: !option.isActive,
      });
      await Promise.all([loadOptions(selectedContestId), loadContests()]);
      toast.success(`Nominee ${option.isActive ? 'disabled' : 'enabled'}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update nominee');
    }
  };

  const deleteNominee = async (option: VotingOption) => {
    if (!window.confirm(`Delete nominee "${option.name}"?`)) return;
    try {
      await ownerDashboardApi.deleteVotingOption(eventId, option.id);
      await Promise.all([loadOptions(selectedContestId), loadContests(), loadAnalytics()]);
      toast.success('Nominee deleted');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to delete nominee');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/owner/events/${eventId}`} className="text-sm text-surface-600 hover:text-brand-900">
            Back to event
          </Link>
          <h1 className="text-2xl font-bold text-brand-900 mt-1">Voting Dashboard</h1>
          <p className="text-sm text-surface-600">
            {event?.name || 'Event'} {event?.slug ? `• /e/${event.slug}/vote` : ''}
          </p>
        </div>
        {event?.slug ? (
          <Link href={`/e/${event.slug}/vote`} className="btn-outline" target="_blank">
            Open Public Voting Page
          </Link>
        ) : null}
      </div>

      <section className="bg-white border border-surface-200 rounded-xl p-4 space-y-4">
        <h2 className="text-lg font-semibold text-brand-900">Voting Configuration</h2>
        {config ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-surface-600">Mode</span>
                <select
                  className="input"
                  value={config.mode}
                  onChange={(event) =>
                    setConfig((current) => (current ? { ...current, mode: event.target.value as VoteMode } : current))
                  }
                >
                  <option value="AWARDS">AWARDS</option>
                  <option value="ELECTION">ELECTION</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-surface-600">Currency</span>
                <input
                  className="input"
                  value={config.currency}
                  onChange={(event) =>
                    setConfig((current) =>
                      current ? { ...current, currency: event.target.value.toUpperCase().slice(0, 3) } : current
                    )
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-surface-600">Unit Price</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={config.voteUnitPrice}
                  onChange={(event) =>
                    setConfig((current) =>
                      current ? { ...current, voteUnitPrice: Number(event.target.value || 0) } : current
                    )
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-surface-600">Max Votes Per Purchase</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={config.maxVotesPerPurchase}
                  onChange={(event) =>
                    setConfig((current) =>
                      current ? { ...current, maxVotesPerPurchase: Math.max(1, Number(event.target.value || 1)) } : current
                    )
                  }
                />
              </label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <button
                type="button"
                className={`btn-outline ${config.isEnabled ? 'border-emerald-300 text-emerald-700' : ''}`}
                onClick={() => setConfig((current) => (current ? { ...current, isEnabled: !current.isEnabled } : current))}
              >
                Voting: {config.isEnabled ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                className={`btn-outline ${config.allowFreeVotes ? 'border-emerald-300 text-emerald-700' : ''}`}
                onClick={() =>
                  setConfig((current) => (current ? { ...current, allowFreeVotes: !current.allowFreeVotes } : current))
                }
              >
                Free: {config.allowFreeVotes ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                className={`btn-outline ${config.allowPaidVotes ? 'border-emerald-300 text-emerald-700' : ''}`}
                onClick={() =>
                  setConfig((current) => (current ? { ...current, allowPaidVotes: !current.allowPaidVotes } : current))
                }
              >
                Paid: {config.allowPaidVotes ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                className={`btn-outline ${config.requireOtpForElection ? 'border-emerald-300 text-emerald-700' : ''}`}
                onClick={() =>
                  setConfig((current) =>
                    current ? { ...current, requireOtpForElection: !current.requireOtpForElection } : current
                  )
                }
              >
                OTP: {config.requireOtpForElection ? 'Required' : 'Optional'}
              </button>
              <button className="btn-primary" onClick={saveConfig} disabled={savingConfig}>
                {savingConfig ? 'Saving...' : 'Save Config'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-surface-500">No voting configuration found.</p>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-brand-900">Contests</h2>
          <div className="grid grid-cols-1 md:grid-cols-[1fr,160px,auto] gap-2">
            <input
              className="input"
              placeholder="Contest title"
              value={newContestTitle}
              onChange={(event) => setNewContestTitle(event.target.value)}
            />
            <select className="input" value={newContestMode} onChange={(event) => setNewContestMode(event.target.value as VoteMode)}>
              <option value="AWARDS">AWARDS</option>
              <option value="ELECTION">ELECTION</option>
            </select>
            <button className="btn-primary" onClick={createContest} disabled={savingContest}>
              Add
            </button>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {contests.length === 0 ? (
              <p className="text-sm text-surface-500">No contests yet.</p>
            ) : (
              contests.map((contest) => (
                <div
                  key={contest.id}
                  className={`rounded-lg border p-3 ${selectedContestId === contest.id ? 'border-brand-300 bg-brand-50/30' : 'border-surface-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedContestId(contest.id)}
                      className="text-left flex-1"
                    >
                      <p className="text-sm font-semibold text-brand-900">{contest.title}</p>
                      <p className="text-xs text-surface-600 mt-0.5">
                        {contest.mode} • {contest.options?.length || 0} nominees • {contest.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </button>
                    <div className="flex gap-1">
                      <button className="btn-outline text-xs" onClick={() => renameContest(contest)}>Rename</button>
                      <button className="btn-outline text-xs" onClick={() => toggleContestStatus(contest)}>
                        {contest.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn-outline text-xs text-rose-700 border-rose-200" onClick={() => deleteContest(contest)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-brand-900">Nominees</h2>
          <p className="text-xs text-surface-600">
            {selectedContest ? `Contest: ${selectedContest.title}` : 'Select a contest to manage nominees.'}
          </p>
          <div className="space-y-2">
            <input
              className="input"
              placeholder="Nominee name"
              value={newOptionName}
              onChange={(event) => setNewOptionName(event.target.value)}
              disabled={!selectedContestId}
            />
            <input
              className="input"
              placeholder="Nominee description (optional)"
              value={newOptionDescription}
              onChange={(event) => setNewOptionDescription(event.target.value)}
              disabled={!selectedContestId}
            />
            <button className="btn-primary w-full" onClick={createNominee} disabled={!selectedContestId || savingOption}>
              Add Nominee
            </button>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
            {options.length === 0 ? (
              <p className="text-sm text-surface-500">No nominees in this contest.</p>
            ) : (
              options.map((option) => (
                <div key={option.id} className="rounded-lg border border-surface-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-brand-900">{option.name}</p>
                      <p className="text-xs text-surface-600 mt-0.5">
                        Total {option.totalVotes} • Free {option.freeVotes} • Paid {option.paidVotes}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn-outline text-xs" onClick={() => renameNominee(option)}>Rename</button>
                      <button className="btn-outline text-xs" onClick={() => toggleNomineeStatus(option)}>
                        {option.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn-outline text-xs text-rose-700 border-rose-200" onClick={() => deleteNominee(option)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="bg-white border border-surface-200 rounded-xl p-4 space-y-4">
        <h2 className="text-lg font-semibold text-brand-900">Voting Analytics</h2>
        {analytics ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              <div className="rounded-lg bg-surface-50 p-3">
                <p className="text-xs text-surface-500">Total Votes</p>
                <p className="text-lg font-semibold text-brand-900">{analytics.totals.totalVotes}</p>
              </div>
              <div className="rounded-lg bg-surface-50 p-3">
                <p className="text-xs text-surface-500">Unique Voters</p>
                <p className="text-lg font-semibold text-brand-900">{analytics.totals.uniqueVoters}</p>
              </div>
              <div className="rounded-lg bg-surface-50 p-3">
                <p className="text-xs text-surface-500">Free Votes</p>
                <p className="text-lg font-semibold text-brand-900">{analytics.totals.freeVotes}</p>
              </div>
              <div className="rounded-lg bg-surface-50 p-3">
                <p className="text-xs text-surface-500">Paid Votes</p>
                <p className="text-lg font-semibold text-brand-900">{analytics.totals.paidVotes}</p>
              </div>
              <div className="rounded-lg bg-surface-50 p-3">
                <p className="text-xs text-surface-500">Revenue</p>
                <p className="text-lg font-semibold text-brand-900">
                  {formatMoney(config?.currency || 'USD', analytics.totals.paidRevenue)}
                </p>
              </div>
              <div className="rounded-lg bg-surface-50 p-3">
                <p className="text-xs text-surface-500">Voter Conversion</p>
                <p className="text-lg font-semibold text-brand-900">{analytics.totals.conversionRate}%</p>
              </div>
              <div className="rounded-lg bg-surface-50 p-3">
                <p className="text-xs text-surface-500">Intent Conversion</p>
                <p className="text-lg font-semibold text-brand-900">{analytics.totals.paidIntentConversionRate}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-surface-200 p-3">
                <p className="text-sm font-semibold text-brand-900 mb-2">Contest Breakdown</p>
                <div className="space-y-2">
                  {analytics.perContest.map((contest) => (
                    <div key={contest.contestId} className="flex items-center justify-between text-sm">
                      <span className="text-surface-700">{contest.title}</span>
                      <span className="font-semibold text-brand-900">
                        {contest.totalVotes} ({contest.paidVotes} paid)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-surface-200 p-3">
                <p className="text-sm font-semibold text-brand-900 mb-2">Leaderboard</p>
                <div className="space-y-2">
                  {analytics.leaderboard.map((entry, index) => (
                    <div key={entry.optionId} className="flex items-center justify-between text-sm">
                      <span className="text-surface-700">
                        #{index + 1} {entry.name}
                      </span>
                      <span className="font-semibold text-brand-900">
                        {entry.totalVotes} ({entry.growthDelta >= 0 ? '+' : ''}
                        {entry.growthDelta})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-surface-200 p-3">
              <p className="text-sm font-semibold text-brand-900 mb-2">Daily Vote Trend</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {analytics.timeSeries.byDay.slice(-18).map((day) => (
                  <div key={day.day} className="rounded-md bg-surface-50 p-2 text-sm">
                    <p className="text-surface-600">{day.day}</p>
                    <p className="font-semibold text-brand-900">{day.votes} votes</p>
                    <p className="text-xs text-surface-600">
                      Free {day.freeVotes} • Paid {day.paidVotes}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-surface-500">Analytics unavailable.</p>
        )}
      </section>
    </div>
  );
}

