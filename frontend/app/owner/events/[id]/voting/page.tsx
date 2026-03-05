'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ownerDashboardApi } from '@/lib/api';

type VoteMode = 'AWARDS' | 'ELECTION';

type NominationField = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'select';
  required?: boolean;
  placeholder?: string | null;
  options?: string[];
};

type EventLite = {
  id: string;
  name: string;
  slug: string;
  defaultCurrency?: string | null;
};

type VotingConfig = {
  mode: VoteMode;
  isEnabled: boolean;
  allowFreeVotes: boolean;
  allowPaidVotes: boolean;
  allowPublicNominations?: boolean;
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
  imagePath?: string | null;
  imageUrl?: string | null;
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
  allowPublicNominations?: boolean;
  nominationFormFields?: NominationField[];
  options: VotingOption[];
};

type VotingNomination = {
  id: string;
  eventId: string;
  contestId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  nomineeName: string;
  nomineeDescription?: string | null;
  nomineeImagePath?: string | null;
  nomineeImageUrl?: string | null;
  submitterName: string;
  submitterEmail?: string | null;
  submitterPhone?: string | null;
  customFieldsJson?: string | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  approvedOption?: { id: string; name: string } | null;
  contest?: { id: string; title: string; mode: VoteMode } | null;
  createdAt: string;
};

type FieldDraft = {
  label: string;
  type: NominationField['type'];
  required: boolean;
  placeholder: string;
  options: string;
};

const NOMINATION_PHOTO_FIELD_KEY = '__nomineeImagePath';

type VotingAnalytics = {
  totals: {
    totalVotes: number;
    uniqueVoters: number;
    freeVotes: number;
    paidVotes: number;
    paidRevenue: number;
    conversionRate: number;
    paidIntentConversionRate: number;
    nominations?: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
    };
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

const parseCustomFields = (raw: string | null | undefined) => {
  if (!raw) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const parseFieldOptions = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const fieldToDraft = (field: NominationField): FieldDraft => ({
  label: field.label,
  type: field.type,
  required: Boolean(field.required),
  placeholder: field.placeholder || '',
  options: (field.options || []).join(', '),
});

export default function AdminVotingPage() {
  const params = useParams();
  const eventId = String(params.id || '');

  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingContest, setSavingContest] = useState(false);
  const [savingOption, setSavingOption] = useState(false);
  const [uploadingOptionImage, setUploadingOptionImage] = useState(false);
  const [savingNominationRule, setSavingNominationRule] = useState(false);
  const [reviewingNominationId, setReviewingNominationId] = useState('');

  const [event, setEvent] = useState<EventLite | null>(null);
  const [config, setConfig] = useState<VotingConfig | null>(null);
  const [contests, setContests] = useState<VotingContest[]>([]);
  const [options, setOptions] = useState<VotingOption[]>([]);
  const [nominations, setNominations] = useState<VotingNomination[]>([]);
  const [analytics, setAnalytics] = useState<VotingAnalytics | null>(null);
  const [selectedContestId, setSelectedContestId] = useState('');

  const [newContestTitle, setNewContestTitle] = useState('');
  const [newContestMode, setNewContestMode] = useState<VoteMode>('AWARDS');
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionDescription, setNewOptionDescription] = useState('');
  const [newOptionImagePath, setNewOptionImagePath] = useState('');
  const [newOptionImagePreview, setNewOptionImagePreview] = useState('');
  const newOptionImageInputRef = useRef<HTMLInputElement | null>(null);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<NominationField['type']>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [editingFieldId, setEditingFieldId] = useState('');
  const [editingFieldDraft, setEditingFieldDraft] = useState<FieldDraft | null>(null);

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === selectedContestId) || null,
    [contests, selectedContestId]
  );
  const selectedNominationFields = useMemo(
    () => selectedContest?.nominationFormFields || [],
    [selectedContest]
  );
  const pendingNominations = useMemo(
    () => nominations.filter((nomination) => nomination.status === 'PENDING'),
    [nominations]
  );
  const eventCurrency = useMemo(
    () => String(event && (event as any).defaultCurrency ? (event as any).defaultCurrency : config?.currency || 'USD').toUpperCase(),
    [event, config?.currency]
  );

  const getContestById = (contestId: string) =>
    contests.find((contest) => contest.id === contestId) || null;

  const nominationPresentation = (nomination: VotingNomination) => {
    const fields = parseCustomFields(nomination.customFieldsJson);
    const imagePathFromFields =
      typeof fields[NOMINATION_PHOTO_FIELD_KEY] === 'string'
        ? String(fields[NOMINATION_PHOTO_FIELD_KEY]).trim()
        : '';
    delete fields[NOMINATION_PHOTO_FIELD_KEY];

    const contest = getContestById(nomination.contestId);
    const labelMap = new Map((contest?.nominationFormFields || []).map((field) => [field.id, field.label] as const));
    const customFieldRows = Object.entries(fields).map(([key, value]) => ({
      key,
      label: labelMap.get(key) || key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      value: String(value ?? ''),
    }));

    return {
      customFieldRows,
      nomineeImageUrl: nomination.nomineeImageUrl || nomination.nomineeImagePath || imagePathFromFields || '',
    };
  };

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

  const loadNominations = async () => {
    const response = await ownerDashboardApi.getVotingNominations(eventId, { limit: 200 });
    setNominations((response.data?.nominations || []) as VotingNomination[]);
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
      setEvent(
        eventPayload
          ? {
              id: eventPayload.id,
              name: eventPayload.name,
              slug: eventPayload.slug,
              defaultCurrency: eventPayload.defaultCurrency || 'USD',
            }
          : null
      );

      await Promise.all([loadVotingConfig(), loadContests(), loadAnalytics(), loadNominations()]);
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
        mode: config.mode,
        isEnabled: config.isEnabled,
        allowFreeVotes: config.allowFreeVotes,
        allowPaidVotes: config.allowPaidVotes,
        allowPublicNominations: Boolean(config.allowPublicNominations),
        requireOtpForElection: config.requireOtpForElection,
        voteUnitPrice: Number(config.voteUnitPrice || 0),
        maxVotesPerPurchase: Math.max(1, Number(config.maxVotesPerPurchase || 1)),
        freeVoteLabel: config.freeVoteLabel || null,
        paidVoteLabel: config.paidVoteLabel || null,
        currency: eventCurrency,
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
        imagePath: newOptionImagePath.trim() || undefined,
      });
      setNewOptionName('');
      setNewOptionDescription('');
      setNewOptionImagePath('');
      setNewOptionImagePreview('');
      if (newOptionImageInputRef.current) {
        newOptionImageInputRef.current.value = '';
      }
      await Promise.all([loadOptions(selectedContestId), loadContests(), loadAnalytics()]);
      toast.success('Nominee added');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to add nominee');
    } finally {
      setSavingOption(false);
    }
  };

  const uploadNomineeImage = async (file: File) => {
    if (!selectedContestId) {
      toast.error('Select a contest first');
      return;
    }
    setUploadingOptionImage(true);
    try {
      const response = await ownerDashboardApi.uploadVotingOptionImage(eventId, file);
      const imagePath = String(response.data?.imagePath || '');
      const imageUrl = String(response.data?.imageUrl || imagePath);
      if (!imagePath) throw new Error('Image upload failed');
      setNewOptionImagePath(imagePath);
      setNewOptionImagePreview(imageUrl);
      toast.success('Nominee photo uploaded');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to upload nominee photo');
    } finally {
      setUploadingOptionImage(false);
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

  const updateSelectedContestNominationRules = async (patch: Partial<VotingContest>) => {
    if (!selectedContest) return;
    setSavingNominationRule(true);
    try {
      await ownerDashboardApi.updateVotingContest(eventId, selectedContest.id, patch);
      await loadContests();
      await loadNominations();
      toast.success('Nomination settings updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update nomination settings');
    } finally {
      setSavingNominationRule(false);
    }
  };

  const addNominationField = async () => {
    if (!selectedContest) return;
    if (!newFieldLabel.trim()) {
      toast.error('Enter field label');
      return;
    }
    const normalizedId = newFieldLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!normalizedId) {
      toast.error('Field label must include letters or numbers');
      return;
    }
    if (selectedNominationFields.some((field) => field.id === normalizedId)) {
      toast.error('Field already exists');
      return;
    }
    const nextField: NominationField = {
      id: normalizedId,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholder: newFieldPlaceholder.trim() || null,
      ...(newFieldType === 'select'
        ? {
            options: parseFieldOptions(newFieldOptions),
          }
        : {}),
    };
    await updateSelectedContestNominationRules({
      nominationFormFields: [...selectedNominationFields, nextField],
    });
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldRequired(false);
    setNewFieldPlaceholder('');
    setNewFieldOptions('');
  };

  const removeNominationField = async (fieldId: string) => {
    if (!selectedContest) return;
    await updateSelectedContestNominationRules({
      nominationFormFields: selectedNominationFields.filter((field) => field.id !== fieldId),
    });
    if (editingFieldId === fieldId) {
      setEditingFieldId('');
      setEditingFieldDraft(null);
    }
  };

  const startEditingField = (field: NominationField) => {
    setEditingFieldId(field.id);
    setEditingFieldDraft(fieldToDraft(field));
  };

  const saveFieldEdit = async () => {
    if (!selectedContest || !editingFieldId || !editingFieldDraft) return;
    if (!editingFieldDraft.label.trim()) {
      toast.error('Field label is required');
      return;
    }
    const nextFields = selectedNominationFields.map((field) =>
      field.id === editingFieldId
        ? {
            ...field,
            label: editingFieldDraft.label.trim(),
            type: editingFieldDraft.type,
            required: editingFieldDraft.required,
            placeholder: editingFieldDraft.placeholder.trim() || null,
            options: editingFieldDraft.type === 'select' ? parseFieldOptions(editingFieldDraft.options) : undefined,
          }
        : field
    );
    await updateSelectedContestNominationRules({
      nominationFormFields: nextFields,
    });
    setEditingFieldId('');
    setEditingFieldDraft(null);
  };

  const reviewNomination = async (nominationId: string, status: 'APPROVED' | 'REJECTED') => {
    setReviewingNominationId(nominationId);
    try {
      await ownerDashboardApi.reviewVotingNomination(eventId, nominationId, {
        status,
        createNomineeOnApprove: true,
      });
      await Promise.all([loadNominations(), loadOptions(selectedContestId), loadContests(), loadAnalytics()]);
      toast.success(`Nomination ${status.toLowerCase()}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to review nomination');
    } finally {
      setReviewingNominationId('');
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
          <div className="flex flex-wrap gap-2">
            <Link href={`/e/${event.slug}/vote`} className="btn-outline" target="_blank">
              Open Public Voting Page
            </Link>
            <Link href={`/e/${event.slug}/nominate`} className="btn-outline" target="_blank">
              Open Public Nomination Page
            </Link>
            <Link href={`/e/${event.slug}/nominees`} className="btn-outline" target="_blank">
              Open Public Nominees Page
            </Link>
            <Link href={`/e/${event.slug}/leaderboard`} className="btn-outline" target="_blank">
              Open Public Leaderboard Page
            </Link>
          </div>
        ) : null}
      </div>

      <section className="dashboard-canvas p-4 space-y-4">
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
                <span className="text-xs text-surface-600">Event Currency</span>
                <div className="input flex items-center font-semibold text-brand-900 bg-surface-50">
                  {eventCurrency}
                </div>
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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <button
                type="button"
                className={`btn-outline ${config.isEnabled ? 'border-emerald-300 text-emerald-700' : ''}`}
                onClick={() => setConfig((current) => (current ? { ...current, isEnabled: !current.isEnabled } : current))}
              >
                Voting page {config.isEnabled ? 'enabled' : 'disabled'}
              </button>
              <button
                type="button"
                className={`btn-outline ${config.allowFreeVotes ? 'border-emerald-300 text-emerald-700' : ''}`}
                onClick={() =>
                  setConfig((current) => (current ? { ...current, allowFreeVotes: !current.allowFreeVotes } : current))
                }
              >
                Free voting {config.allowFreeVotes ? 'enabled' : 'disabled'}
              </button>
              <button
                type="button"
                className={`btn-outline ${config.allowPaidVotes ? 'border-emerald-300 text-emerald-700' : ''}`}
                onClick={() =>
                  setConfig((current) => (current ? { ...current, allowPaidVotes: !current.allowPaidVotes } : current))
                }
              >
                Paid voting {config.allowPaidVotes ? 'enabled' : 'disabled'}
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
                OTP {config.requireOtpForElection ? 'required' : 'optional'}
              </button>
              <button
                type="button"
                className={`btn-outline ${config.allowPublicNominations ? 'border-emerald-300 text-emerald-700' : ''}`}
                onClick={() =>
                  setConfig((current) =>
                    current ? { ...current, allowPublicNominations: !current.allowPublicNominations } : current
                  )
                }
              >
                Public nominations {config.allowPublicNominations ? 'enabled' : 'disabled'}
              </button>
              <button className="btn-primary" onClick={saveConfig} disabled={savingConfig}>
                {savingConfig ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-surface-500">No voting configuration found.</p>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dashboard-canvas p-4 space-y-3">
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

        <div className="dashboard-canvas p-4 space-y-3">
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
            <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50 p-3 space-y-2">
              <p className="text-xs font-medium text-surface-700">Nominee photo</p>
              <input
                ref={newOptionImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void uploadNomineeImage(file);
                  }
                }}
              />
              {newOptionImagePreview ? (
                <img
                  src={newOptionImagePreview}
                  alt="Nominee preview"
                  className="h-36 w-full rounded-lg border border-surface-200 object-cover"
                />
              ) : (
                <div className="h-24 w-full rounded-lg border border-surface-200 bg-white flex items-center justify-center text-xs text-surface-500">
                  Upload nominee photo to preview
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-outline text-xs"
                  disabled={!selectedContestId || uploadingOptionImage}
                  onClick={() => newOptionImageInputRef.current?.click()}
                >
                  {uploadingOptionImage ? 'Uploading...' : newOptionImagePath ? 'Replace photo' : 'Upload photo'}
                </button>
                {newOptionImagePath ? (
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => {
                      setNewOptionImagePath('');
                      setNewOptionImagePreview('');
                      if (newOptionImageInputRef.current) {
                        newOptionImageInputRef.current.value = '';
                      }
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={createNominee} disabled={!selectedContestId || savingOption}>
              Add Nominee
            </button>
          </div>
          <div className="rounded-lg border border-surface-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-brand-900">Public Nomination Rules</p>
              <button
                className="btn-outline text-xs"
                disabled={!selectedContest || savingNominationRule}
                onClick={() =>
                  selectedContest &&
                  updateSelectedContestNominationRules({
                    allowPublicNominations: !Boolean(selectedContest.allowPublicNominations),
                  })
                }
              >
                {selectedContest?.allowPublicNominations ? 'Disable Public Nominations' : 'Enable Public Nominations'}
              </button>
            </div>
            <p className="text-xs text-surface-600">
              Category-level toggle for public nominee submissions. Global toggle is in Voting Configuration.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Custom field label"
                value={newFieldLabel}
                onChange={(event) => setNewFieldLabel(event.target.value)}
                disabled={!selectedContest}
              />
              <select
                className="input"
                value={newFieldType}
                onChange={(event) => setNewFieldType(event.target.value as NominationField['type'])}
                disabled={!selectedContest}
              >
                <option value="text">text</option>
                <option value="textarea">textarea</option>
                <option value="email">email</option>
                <option value="phone">phone</option>
                <option value="number">number</option>
                <option value="select">select</option>
              </select>
            </div>
            <input
              className="input"
              placeholder="Field placeholder (optional)"
              value={newFieldPlaceholder}
              onChange={(event) => setNewFieldPlaceholder(event.target.value)}
              disabled={!selectedContest}
            />
            {newFieldType === 'select' ? (
              <input
                className="input"
                placeholder="Select options (comma separated)"
                value={newFieldOptions}
                onChange={(event) => setNewFieldOptions(event.target.value)}
                disabled={!selectedContest}
              />
            ) : null}
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs text-surface-700">
                <input
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(event) => setNewFieldRequired(event.target.checked)}
                  disabled={!selectedContest}
                />
                Required
              </label>
              <button className="btn-outline text-xs" onClick={addNominationField} disabled={!selectedContest || savingNominationRule}>
                Add Custom Field
              </button>
            </div>

            <div className="space-y-1">
              {selectedNominationFields.length === 0 ? (
                <p className="text-xs text-surface-500">No custom fields configured.</p>
              ) : (
                selectedNominationFields.map((field) => {
                  const isEditing = editingFieldId === field.id && editingFieldDraft;
                  return (
                    <div key={field.id} className="rounded border border-surface-200 p-2 text-xs space-y-2">
                      {isEditing ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              className="input"
                              value={editingFieldDraft.label}
                              onChange={(event) =>
                                setEditingFieldDraft((current) =>
                                  current ? { ...current, label: event.target.value } : current
                                )
                              }
                            />
                            <select
                              className="input"
                              value={editingFieldDraft.type}
                              onChange={(event) =>
                                setEditingFieldDraft((current) =>
                                  current ? { ...current, type: event.target.value as NominationField['type'] } : current
                                )
                              }
                            >
                              <option value="text">text</option>
                              <option value="textarea">textarea</option>
                              <option value="email">email</option>
                              <option value="phone">phone</option>
                              <option value="number">number</option>
                              <option value="select">select</option>
                            </select>
                          </div>
                          <input
                            className="input"
                            placeholder="Field placeholder (optional)"
                            value={editingFieldDraft.placeholder}
                            onChange={(event) =>
                              setEditingFieldDraft((current) =>
                                current ? { ...current, placeholder: event.target.value } : current
                              )
                            }
                          />
                          {editingFieldDraft.type === 'select' ? (
                            <input
                              className="input"
                              placeholder="Select options (comma separated)"
                              value={editingFieldDraft.options}
                              onChange={(event) =>
                                setEditingFieldDraft((current) =>
                                  current ? { ...current, options: event.target.value } : current
                                )
                              }
                            />
                          ) : null}
                          <div className="flex items-center justify-between">
                            <label className="inline-flex items-center gap-2 text-xs text-surface-700">
                              <input
                                type="checkbox"
                                checked={editingFieldDraft.required}
                                onChange={(event) =>
                                  setEditingFieldDraft((current) =>
                                    current ? { ...current, required: event.target.checked } : current
                                  )
                                }
                              />
                              Required
                            </label>
                            <div className="flex gap-1">
                              <button className="btn-outline text-xs" onClick={saveFieldEdit} disabled={savingNominationRule}>
                                Save
                              </button>
                              <button
                                className="btn-outline text-xs"
                                onClick={() => {
                                  setEditingFieldId('');
                                  setEditingFieldDraft(null);
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between rounded border border-surface-200 px-2 py-1.5 text-xs">
                          <span>
                            {field.label} ({field.type}){field.required ? ' *' : ''}
                          </span>
                          <div className="flex gap-2">
                            <button className="text-brand-700 hover:text-brand-900" onClick={() => startEditingField(field)}>
                              Edit
                            </button>
                            <button
                              className="text-rose-700 hover:text-rose-800"
                              onClick={() => removeNominationField(field.id)}
                              disabled={savingNominationRule}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
            {options.length === 0 ? (
              <p className="text-sm text-surface-500">No nominees in this contest.</p>
            ) : (
              options.map((option) => (
                <div key={option.id} className="rounded-lg border border-surface-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {option.imageUrl || option.imagePath ? (
                        <img
                          src={option.imageUrl || option.imagePath || ''}
                          alt={option.name}
                          className="h-11 w-11 rounded-lg border border-surface-200 object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-lg border border-surface-200 bg-surface-100" />
                      )}
                      <div className="min-w-0">
  <p className="text-sm font-semibold text-brand-900">{option.name}</p>
  <p className="text-xs text-surface-600 mt-0.5">{option.description || 'Nominee profile'}</p>
  <p className="text-xs text-surface-500 mt-0.5">Total {option.totalVotes} / Free {option.freeVotes} / Paid {option.paidVotes}</p>
</div>
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

      <section className="dashboard-canvas p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-900">Public Nominations</h2>
          <span className="text-xs text-surface-600">
            {pendingNominations.length} pending
          </span>
        </div>
        {nominations.length === 0 ? (
          <p className="text-sm text-surface-500">No nominations yet.</p>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {nominations.map((nomination) => {
              const view = nominationPresentation(nomination);
              return (
                <div key={nomination.id} className="rounded-lg border border-surface-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex gap-3 min-w-0">
                      {view.nomineeImageUrl ? (
                        <img
                          src={view.nomineeImageUrl}
                          alt={nomination.nomineeName}
                          className="h-14 w-14 rounded-lg border border-surface-200 object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-900">{nomination.nomineeName}</p>
                        <p className="text-xs text-surface-600 mt-1">
                          Category: {nomination.contest?.title || nomination.contestId} • Submitted by {nomination.submitterName}
                        </p>
                        {nomination.nomineeDescription ? (
                          <p className="text-xs text-surface-600 mt-1">{nomination.nomineeDescription}</p>
                        ) : null}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${
                        nomination.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : nomination.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {nomination.status === 'PENDING'
                        ? 'Awaiting review'
                        : nomination.status === 'APPROVED'
                        ? 'Approved'
                        : 'Declined'}
                    </span>
                  </div>
                  {view.customFieldRows.length ? (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {view.customFieldRows.map((row) => (
                        <div key={`${nomination.id}:${row.key}`} className="rounded border border-surface-100 bg-surface-50 px-2 py-1.5">
                          <p className="text-[11px] uppercase tracking-wide text-surface-500">{row.label}</p>
                          <p className="text-xs text-brand-900">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {nomination.status === 'PENDING' ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn-outline text-xs border-emerald-200 text-emerald-700"
                        onClick={() => reviewNomination(nomination.id, 'APPROVED')}
                        disabled={reviewingNominationId === nomination.id}
                      >
                        Approve and publish nominee
                      </button>
                      <button
                        className="btn-outline text-xs border-rose-200 text-rose-700"
                        onClick={() => reviewNomination(nomination.id, 'REJECTED')}
                        disabled={reviewingNominationId === nomination.id}
                      >
                        Reject
                      </button>
                    </div>
                  ) : nomination.approvedOption ? (
                    <p className="text-xs text-emerald-700 mt-2">
                      Published as: {nomination.approvedOption.name}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="dashboard-canvas p-4 space-y-4">
        <h2 className="text-lg font-semibold text-brand-900">Voting Analytics</h2>
        {analytics ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
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
                  {formatMoney(eventCurrency, analytics.totals.paidRevenue)}
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
              <div className="rounded-lg bg-surface-50 p-3">
                <p className="text-xs text-surface-500">Nominations</p>
                <p className="text-lg font-semibold text-brand-900">
                  {analytics.totals.nominations?.total || 0}
                </p>
                <p className="text-[11px] text-surface-600">
                  Pending {analytics.totals.nominations?.pending || 0}
                </p>
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



