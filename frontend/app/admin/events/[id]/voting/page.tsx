'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import VotingWorkspaceHeader from '@/components/voting/VotingWorkspaceHeader';
import VotingWorkspaceTabs from '@/components/voting/VotingWorkspaceTabs';
import {
  VotingCategoryPanel,
  VotingNomineePanel,
  VotingNominationsPanel,
  VotingPublishedNomineesPanel,
} from '@/components/voting/VotingManagementPanels';
import VotingResultsPanel from '@/components/voting/VotingResultsPanel';
import VotingSetupPanel from '@/components/voting/VotingSetupPanel';
import { adminVotingApi, eventsApi } from '@/lib/api';

type VoteMode = 'AWARDS' | 'ELECTION';

type NominationField = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'select' | 'url';
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
  settingsJson?: Record<string, unknown> | null;
};

type VotingOption = {
  id: string;
  contestId: string;
  contestTitle?: string;
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
type VotingTab = 'setup' | 'categories' | 'nominees' | 'published' | 'nominations' | 'results';

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

const parseSettingsJson = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
};

const normalizeVotingConfig = (value: any): VotingConfig | null =>
  value
    ? {
        ...value,
        settingsJson: parseSettingsJson(value.settingsJson),
      }
    : null;

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
  const [activeTab, setActiveTab] = useState<VotingTab>('setup');
  const [publishedContestFilter, setPublishedContestFilter] = useState('');
  const [selectedNomineeContestIds, setSelectedNomineeContestIds] = useState<string[]>([]);

  const [newContestTitle, setNewContestTitle] = useState('');
  const [newContestMode, setNewContestMode] = useState<VoteMode>('AWARDS');
  const [editingContestId, setEditingContestId] = useState('');
  const [editingContestTitle, setEditingContestTitle] = useState('');
  const [editingContestDescription, setEditingContestDescription] = useState('');
  const [savingEditingContest, setSavingEditingContest] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionDescription, setNewOptionDescription] = useState('');
  const [newOptionImagePath, setNewOptionImagePath] = useState('');
  const [newOptionImagePreview, setNewOptionImagePreview] = useState('');
  const newOptionImageInputRef = useRef<HTMLInputElement | null>(null);
  const [editingOptionId, setEditingOptionId] = useState('');
  const [editingOptionName, setEditingOptionName] = useState('');
  const [editingOptionDescription, setEditingOptionDescription] = useState('');
  const [editingOptionImagePath, setEditingOptionImagePath] = useState('');
  const [editingOptionImagePreview, setEditingOptionImagePreview] = useState('');
  const [editingOptionContestIds, setEditingOptionContestIds] = useState<string[]>([]);
  const [editingLinkedOptionIds, setEditingLinkedOptionIds] = useState<Record<string, string>>({});
  const [savingEditingOption, setSavingEditingOption] = useState(false);
  const [uploadingEditingOptionImage, setUploadingEditingOptionImage] = useState(false);
  const editingOptionImageInputRef = useRef<HTMLInputElement | null>(null);
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
  const allOptions = useMemo(
    () =>
      contests.flatMap((contest) =>
        (contest.options || []).map((option) => ({
          ...option,
          contestId: option.contestId || contest.id,
          contestTitle: contest.title,
        }))
      ),
    [contests]
  );
  const publishedContest = useMemo(
    () => contests.find((contest) => contest.id === publishedContestFilter) || null,
    [contests, publishedContestFilter]
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
    const response = await adminVotingApi.getVotingConfig(eventId);
    setConfig(normalizeVotingConfig(response.data?.config || null));
  };

  const loadContests = async () => {
    const response = await adminVotingApi.getVotingContests(eventId);
    const dataContests = (response.data?.contests || []) as VotingContest[];
    setContests(dataContests);
    setSelectedContestId((current) =>
      current && dataContests.some((contest) => contest.id === current)
        ? current
        : dataContests[0]?.id || ''
    );
    setSelectedNomineeContestIds((current) => {
      const valid = current.filter((id) => dataContests.some((contest) => contest.id === id));
      if (valid.length > 0) return valid;
      return dataContests[0]?.id ? [dataContests[0].id] : [];
    });
  };

  const loadAnalytics = async () => {
    const response = await adminVotingApi.getVotingAnalytics(eventId);
    setAnalytics(response.data as VotingAnalytics);
  };

  const loadNominations = async () => {
    const response = await adminVotingApi.getVotingNominations(eventId, { limit: 200 });
    setNominations((response.data?.nominations || []) as VotingNomination[]);
  };

  const loadOptions = async (contestId: string) => {
    if (!contestId) {
      setOptions([]);
      return;
    }
    const response = await adminVotingApi.getVotingOptions(eventId, contestId);
    setOptions((response.data?.options || []) as VotingOption[]);
  };

  const loadData = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const eventResponse = await eventsApi.get(eventId);
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

  useEffect(() => {
    if (!eventId) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void Promise.all([
        loadAnalytics(),
        loadContests(),
        loadNominations(),
        ...(selectedContestId ? [loadOptions(selectedContestId)] : []),
      ]);
    };
    const interval = window.setInterval(refresh, 12000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, selectedContestId]);

  useEffect(() => {
    if (!selectedContestId) return;
    setSelectedNomineeContestIds((current) => {
      const valid = current.filter((id) => contests.some((contest) => contest.id === id));
      if (valid.includes(selectedContestId)) return valid;
      return [selectedContestId, ...valid];
    });
  }, [selectedContestId, contests]);

  useEffect(() => {
    if (!publishedContestFilter) return;
    if (!contests.some((contest) => contest.id === publishedContestFilter)) {
      setPublishedContestFilter('');
    }
  }, [contests, publishedContestFilter]);

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
        settingsJson: config.settingsJson ?? undefined,
      };
      const response = await adminVotingApi.updateVotingConfig(eventId, payload);
      setConfig(normalizeVotingConfig(response.data?.config || config));
      toast.success('Voting config updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update voting config');
    } finally {
      setSavingConfig(false);
    }
  };

  const ensureEventPublicNominationsEnabled = async () => {
    if (!config || config.allowPublicNominations) return;
    const payload = {
      mode: config.mode,
      isEnabled: config.isEnabled,
      allowFreeVotes: config.allowFreeVotes,
      allowPaidVotes: config.allowPaidVotes,
      allowPublicNominations: true,
      requireOtpForElection: config.requireOtpForElection,
      voteUnitPrice: Number(config.voteUnitPrice || 0),
      maxVotesPerPurchase: Math.max(1, Number(config.maxVotesPerPurchase || 1)),
      freeVoteLabel: config.freeVoteLabel || null,
      paidVoteLabel: config.paidVoteLabel || null,
      currency: eventCurrency,
      settingsJson: config.settingsJson ?? undefined,
    };
    const response = await adminVotingApi.updateVotingConfig(eventId, payload);
    setConfig(normalizeVotingConfig(response.data?.config || { ...config, allowPublicNominations: true }));
  };

  const createContest = async () => {
    if (!newContestTitle.trim()) {
      toast.error('Enter contest title');
      return;
    }
    setSavingContest(true);
    try {
      await adminVotingApi.createVotingContest(eventId, {
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
      await adminVotingApi.updateVotingContest(eventId, contest.id, {
        isActive: !contest.isActive,
      });
      await loadContests();
      toast.success(`Contest ${contest.isActive ? 'disabled' : 'enabled'}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update contest');
    }
  };

  const startEditingContest = (contest: VotingContest) => {
    setEditingContestId(contest.id);
    setEditingContestTitle(contest.title || '');
    setEditingContestDescription(contest.description || '');
  };

  const cancelEditingContest = () => {
    setEditingContestId('');
    setEditingContestTitle('');
    setEditingContestDescription('');
  };

  const saveEditingContest = async () => {
    if (!editingContestId || !editingContestTitle.trim()) {
      toast.error('Category title is required');
      return;
    }
    setSavingEditingContest(true);
    try {
      await adminVotingApi.updateVotingContest(eventId, editingContestId, {
        title: editingContestTitle.trim(),
        description: editingContestDescription.trim() || null,
      });
      await loadContests();
      cancelEditingContest();
      toast.success('Contest updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update contest');
    } finally {
      setSavingEditingContest(false);
    }
  };

  const deleteContest = async (contest: VotingContest) => {
    if (!window.confirm(`Delete contest "${contest.title}" and all nominees/votes?`)) return;
    try {
      await adminVotingApi.deleteVotingContest(eventId, contest.id);
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
    if (!newOptionName.trim()) {
      toast.error('Enter nominee name');
      return;
    }
    const targetContestIds = selectedNomineeContestIds.filter((contestId) =>
      contests.some((contest) => contest.id === contestId)
    );
    if (targetContestIds.length === 0) {
      toast.error('Select at least one category');
      return;
    }
    setSavingOption(true);
    try {
      const results = await Promise.allSettled(
        targetContestIds.map((contestId) =>
          adminVotingApi.createVotingOption(eventId, contestId, {
            name: newOptionName.trim(),
            description: newOptionDescription.trim() || undefined,
            imagePath: newOptionImagePath.trim() || undefined,
          })
        )
      );
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      if (succeeded === 0) {
        const firstRejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
        throw firstRejected?.reason;
      }
      setNewOptionName('');
      setNewOptionDescription('');
      setNewOptionImagePath('');
      setNewOptionImagePreview('');
      if (newOptionImageInputRef.current) {
        newOptionImageInputRef.current.value = '';
      }
      await Promise.all([loadOptions(selectedContestId), loadContests(), loadAnalytics()]);
      toast.success(
        succeeded === targetContestIds.length
          ? succeeded === 1
            ? 'Nominee added'
            : `Nominee added to ${succeeded} categories`
          : `Nominee added to ${succeeded} of ${targetContestIds.length} categories`
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to add nominee');
    } finally {
      setSavingOption(false);
    }
  };

  const uploadNomineeImage = async (file: File) => {
    setUploadingOptionImage(true);
    try {
      const response = await adminVotingApi.uploadVotingOptionImage(eventId, file);
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
    const linkedOptions = allOptions.filter((candidate) => candidate.name.trim().toLowerCase() === option.name.trim().toLowerCase());
    setEditingOptionId(option.id);
    setEditingOptionName(option.name || '');
    setEditingOptionDescription(option.description || '');
    setEditingOptionImagePath(option.imagePath || '');
    setEditingOptionImagePreview(option.imageUrl || option.imagePath || '');
    setEditingOptionContestIds(
      Array.from(
        new Set(
          linkedOptions
            .map((candidate) => candidate.contestId)
            .filter((contestId): contestId is string => Boolean(contestId))
        )
      )
    );
    setEditingLinkedOptionIds(
      Object.fromEntries(
        linkedOptions
          .filter((candidate) => Boolean(candidate.contestId))
          .map((candidate) => [String(candidate.contestId), candidate.id])
      )
    );
  };

  const cancelNomineeEdit = () => {
    setEditingOptionId('');
    setEditingOptionName('');
    setEditingOptionDescription('');
    setEditingOptionImagePath('');
    setEditingOptionImagePreview('');
    setEditingOptionContestIds([]);
    setEditingLinkedOptionIds({});
    if (editingOptionImageInputRef.current) {
      editingOptionImageInputRef.current.value = '';
    }
  };

  const saveEditingNominee = async () => {
    if (!editingOptionId || !editingOptionName.trim()) {
      toast.error('Nominee name is required');
      return;
    }
    const targetContestIds = editingOptionContestIds.filter((contestId) =>
      contests.some((contest) => contest.id === contestId)
    );
    if (targetContestIds.length === 0) {
      toast.error('Select at least one category');
      return;
    }
    setSavingEditingOption(true);
    try {
      const currentOption = allOptions.find((option) => option.id === editingOptionId);
      const currentContestId = currentOption?.contestId || selectedContestId;
      const payload = {
        name: editingOptionName.trim(),
        description: editingOptionDescription.trim() || null,
        imagePath: editingOptionImagePath.trim() || null,
      };
      const operations: Array<Promise<unknown>> = [];
      if (currentContestId && targetContestIds.includes(currentContestId)) {
        operations.push(adminVotingApi.updateVotingOption(eventId, editingOptionId, payload));
      } else {
        operations.push(adminVotingApi.deleteVotingOption(eventId, editingOptionId));
      }

      for (const contestId of targetContestIds) {
        const linkedOptionId = editingLinkedOptionIds[contestId];
        if (contestId === currentContestId && targetContestIds.includes(contestId)) {
          continue;
        }
        if (linkedOptionId) {
          operations.push(adminVotingApi.updateVotingOption(eventId, linkedOptionId, payload));
        } else {
          operations.push(adminVotingApi.createVotingOption(eventId, contestId, payload));
        }
      }

      Object.entries(editingLinkedOptionIds).forEach(([contestId, optionId]) => {
        if (contestId === currentContestId) return;
        if (!targetContestIds.includes(contestId)) {
          operations.push(adminVotingApi.deleteVotingOption(eventId, optionId));
        }
      });

      await Promise.all(operations);
      await Promise.all([loadOptions(selectedContestId), loadContests()]);
      cancelNomineeEdit();
      toast.success('Nominee updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update nominee');
    } finally {
      setSavingEditingOption(false);
    }
  };

  const uploadEditingNomineeImage = async (file: File) => {
    setUploadingEditingOptionImage(true);
    try {
      const response = await adminVotingApi.uploadVotingOptionImage(eventId, file);
      const imagePath = String(response.data?.imagePath || '');
      const imageUrl = String(response.data?.imageUrl || imagePath);
      if (!imagePath) throw new Error('Image upload failed');
      setEditingOptionImagePath(imagePath);
      setEditingOptionImagePreview(imageUrl);
      toast.success('Nominee photo uploaded');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to upload nominee photo');
    } finally {
      setUploadingEditingOptionImage(false);
    }
  };

  const toggleNomineeStatus = async (option: VotingOption) => {
    try {
      await adminVotingApi.updateVotingOption(eventId, option.id, {
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
      await adminVotingApi.deleteVotingOption(eventId, option.id);
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
      await adminVotingApi.updateVotingContest(eventId, selectedContest.id, patch);
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
      await adminVotingApi.reviewVotingNomination(eventId, nominationId, {
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

  const toggleNomineeTargetContest = (contestId: string, checked: boolean) => {
    setSelectedNomineeContestIds((current) => {
      if (checked) {
        if (current.includes(contestId)) return current;
        return [...current, contestId];
      }
      return current.filter((id) => id !== contestId);
    });
  };

  const toggleEditingNomineeContest = (contestId: string, checked: boolean) => {
    setEditingOptionContestIds((current) => {
      if (checked) {
        if (current.includes(contestId)) return current;
        return [...current, contestId];
      }
      return current.filter((id) => id !== contestId);
    });
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
      <VotingWorkspaceHeader
        backHref={`/admin/events/${eventId}`}
        eventName={event?.name || 'Event'}
        eventSlug={event?.slug}
        actions={[
          { href: '/admin/ussd', label: 'USSD Controls' },
          { href: `/e/${event?.slug}/vote`, label: 'Open Public Voting Page', external: true },
          { href: `/e/${event?.slug}/nominate`, label: 'Open Public Nomination Page', external: true },
          { href: `/e/${event?.slug}/nominees`, label: 'Open Public Nominees Page', external: true },
          { href: `/e/${event?.slug}/leaderboard`, label: 'Open Public Leaderboard Page', external: true },
        ]}
      />

      <VotingWorkspaceTabs activeTab={activeTab} onChange={setActiveTab} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Voting mode</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-brand-900">{config?.mode === 'ELECTION' ? 'Election' : 'Awards'}</p>
          <p className="mt-2 text-sm text-surface-500">{config?.isEnabled ? 'Voting is open to guests.' : 'Voting is currently paused.'}</p>
        </div>
        <div className="metric-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Categories</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-brand-900">{contests.length}</p>
          <p className="mt-2 text-sm text-surface-500">Published and draft categories for this event.</p>
        </div>
        <div className="metric-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Nominees</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-brand-900">{allOptions.length}</p>
          <p className="mt-2 text-sm text-surface-500">Total nominees across all categories.</p>
        </div>
        <div className="metric-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Pending nominations</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-brand-900">{pendingNominations.length}</p>
          <p className="mt-2 text-sm text-surface-500">Submissions waiting for review.</p>
        </div>
      </section>

      {activeTab === 'setup' ? (
        <VotingSetupPanel
          config={config}
          eventCurrency={eventCurrency}
          saving={savingConfig}
          containerClassName="card-premium"
          onChange={(nextConfig) =>
            setConfig((current) => (current ? { ...current, ...nextConfig } : current))
          }
          onSave={saveConfig}
        />
      ) : null}

      {activeTab === 'categories' ? (
        <VotingCategoryPanel
          contests={contests}
          selectedContestId={selectedContestId}
          newContestTitle={newContestTitle}
          newContestMode={newContestMode}
          savingContest={savingContest}
          editingContestId={editingContestId}
          editingContestTitle={editingContestTitle}
          editingContestDescription={editingContestDescription}
          savingEditingContest={savingEditingContest}
          onContestTitleChange={setNewContestTitle}
          onContestModeChange={setNewContestMode}
          onCreateContest={createContest}
          onSelectContest={setSelectedContestId}
          onStartEditingContest={startEditingContest}
          onEditingContestTitleChange={setEditingContestTitle}
          onEditingContestDescriptionChange={setEditingContestDescription}
          onSaveEditingContest={saveEditingContest}
          onCancelEditingContest={cancelEditingContest}
          onToggleContestStatus={toggleContestStatus}
          onDeleteContest={deleteContest}
        />
      ) : null}

      {activeTab === 'nominees' ? (
        <VotingNomineePanel
          contests={contests}
          selectedContestTitle={selectedContest?.title || ''}
          selectedContestId={selectedContestId}
          selectedNomineeContestIds={selectedNomineeContestIds}
          newOptionName={newOptionName}
          newOptionDescription={newOptionDescription}
          newOptionImagePath={newOptionImagePath}
          newOptionImagePreview={newOptionImagePreview}
          uploadingOptionImage={uploadingOptionImage}
          savingOption={savingOption}
          selectedNominationFields={selectedNominationFields}
          newFieldLabel={newFieldLabel}
          newFieldType={newFieldType}
          newFieldRequired={newFieldRequired}
          newFieldPlaceholder={newFieldPlaceholder}
          newFieldOptions={newFieldOptions}
          editingFieldId={editingFieldId}
          editingFieldDraft={editingFieldDraft}
          savingNominationRule={savingNominationRule}
          selectedContestAllowsPublicNominations={Boolean(selectedContest?.allowPublicNominations)}
          onToggleNomineeContest={toggleNomineeTargetContest}
          onOptionNameChange={setNewOptionName}
          onOptionDescriptionChange={setNewOptionDescription}
          onUploadImageClick={() => newOptionImageInputRef.current?.click()}
          onRemoveImage={() => {
            setNewOptionImagePath('');
            setNewOptionImagePreview('');
            if (newOptionImageInputRef.current) {
              newOptionImageInputRef.current.value = '';
            }
          }}
          onCreateNominee={createNominee}
          onTogglePublicNominations={() => {
            if (!selectedContest) return;
            void (async () => {
              const nextValue = !Boolean(selectedContest.allowPublicNominations);
              if (nextValue) {
                await ensureEventPublicNominationsEnabled();
              }
              await updateSelectedContestNominationRules({
                allowPublicNominations: nextValue,
              });
            })();
          }}
          onNewFieldLabelChange={setNewFieldLabel}
          onNewFieldTypeChange={setNewFieldType}
          onNewFieldRequiredChange={setNewFieldRequired}
          onNewFieldPlaceholderChange={setNewFieldPlaceholder}
          onNewFieldOptionsChange={setNewFieldOptions}
          onAddField={addNominationField}
          onStartEditingField={startEditingField}
          onEditingFieldDraftChange={setEditingFieldDraft}
          onSaveFieldEdit={saveFieldEdit}
          onCancelFieldEdit={() => {
            setEditingFieldId('');
            setEditingFieldDraft(null);
          }}
          onRemoveField={removeNominationField}
        />
      ) : null}

      {activeTab === 'published' ? (
        <VotingPublishedNomineesPanel
          contests={contests}
          options={allOptions}
          selectedContestTitle={publishedContest?.title || ''}
          publishedContestFilter={publishedContestFilter}
          onPublishedContestFilterChange={setPublishedContestFilter}
          editingOptionId={editingOptionId}
          editingOptionName={editingOptionName}
          editingOptionDescription={editingOptionDescription}
          editingOptionImagePath={editingOptionImagePath}
          editingOptionImagePreview={editingOptionImagePreview}
          editingOptionContestIds={editingOptionContestIds}
          savingEditingOption={savingEditingOption}
          uploadingEditingOptionImage={uploadingEditingOptionImage}
          onStartEditingNominee={renameNominee}
          onEditingOptionNameChange={setEditingOptionName}
          onEditingOptionDescriptionChange={setEditingOptionDescription}
          onToggleEditingNomineeContest={toggleEditingNomineeContest}
          onUploadEditingImageClick={() => editingOptionImageInputRef.current?.click()}
          onRemoveEditingImage={() => {
            setEditingOptionImagePath('');
            setEditingOptionImagePreview('');
            if (editingOptionImageInputRef.current) {
              editingOptionImageInputRef.current.value = '';
            }
          }}
          onSaveEditingNominee={saveEditingNominee}
          onCancelEditingNominee={cancelNomineeEdit}
          onToggleNomineeStatus={toggleNomineeStatus}
          onDeleteNominee={deleteNominee}
        />
      ) : null}

      {activeTab === 'nominations' ? (
        <VotingNominationsPanel
          nominations={nominations}
          pendingCount={pendingNominations.length}
          reviewingNominationId={reviewingNominationId}
          nominationPresentation={nominationPresentation}
          onReviewNomination={reviewNomination}
        />
      ) : null}

      {activeTab === 'results' ? (
        <VotingResultsPanel
          analytics={analytics}
          eventCurrency={eventCurrency}
          formatMoney={formatMoney}
          containerClassName="card-premium"
        />
      ) : null}

      <input
        ref={newOptionImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void uploadNomineeImage(file);
        }}
      />
      <input
        ref={editingOptionImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void uploadEditingNomineeImage(file);
        }}
      />
    </div>
  );
}




