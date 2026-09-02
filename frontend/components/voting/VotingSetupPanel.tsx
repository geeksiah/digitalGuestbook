import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { parseCsvRow, parseXlsxRows } from '@/lib/spreadsheetImport';

type VoteMode = 'AWARDS' | 'ELECTION';

type ManualIdEntry = {
  id: string;
  name: string;
};

type VotingVerificationSettings = {
  manualIdEnabled: boolean;
  manualIdLabel: string;
  manualIdEntries: ManualIdEntry[];
};

type VotingSetupConfig = {
  mode: VoteMode;
  isEnabled: boolean;
  allowFreeVotes: boolean;
  allowPaidVotes: boolean;
  allowPublicNominations?: boolean;
  requireOtpForElection: boolean;
  voteUnitPrice: number;
  maxVotesPerPurchase: number;
  settingsJson?: Record<string, unknown> | null;
};

const getVerificationSettings = (config: VotingSetupConfig | null): VotingVerificationSettings => {
  const settings =
    config?.settingsJson && typeof config.settingsJson === 'object' && !Array.isArray(config.settingsJson)
      ? config.settingsJson
      : {};
  const verification =
    settings.verification && typeof settings.verification === 'object' && !Array.isArray(settings.verification)
      ? (settings.verification as Record<string, unknown>)
      : {};
  const rawEntries = Array.isArray(verification.manualIdEntries) ? verification.manualIdEntries : [];
  return {
    manualIdEnabled: Boolean(verification.manualIdEnabled),
    manualIdLabel: String(verification.manualIdLabel || 'Voter ID').trim() || 'Voter ID',
    manualIdEntries: rawEntries
      .map((entry) => ({
        id: String((entry as any)?.id || '').trim().toUpperCase(),
        name: String((entry as any)?.name || '').trim(),
      }))
      .filter((entry) => entry.id),
  };
};

const withVerificationSettings = (config: VotingSetupConfig, nextVerification: VotingVerificationSettings): VotingSetupConfig => ({
  ...config,
  settingsJson: {
    ...(config.settingsJson && typeof config.settingsJson === 'object' && !Array.isArray(config.settingsJson)
      ? config.settingsJson
      : {}),
    verification: {
      manualIdEnabled: nextVerification.manualIdEnabled,
      manualIdLabel: nextVerification.manualIdLabel,
      manualIdEntries: nextVerification.manualIdEntries,
    },
  },
});

const importManualIdRows = (rows: string[][]) => {
  if (!rows.length) return [] as ManualIdEntry[];
  const header = rows[0].map((value) => String(value || '').trim().toLowerCase());
  const hasHeader = header.some((value) =>
    ['id', 'id number', 'voter id', 'identifier', 'name', 'full name'].includes(value)
  );
  const indexOfHeader = (labels: string[]) => header.findIndex((value) => labels.includes(value));
  const idIdx = hasHeader ? indexOfHeader(['id', 'id number', 'voter id', 'identifier']) : 0;
  const nameIdx = hasHeader ? indexOfHeader(['name', 'full name']) : 1;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows
    .map((cols) => ({
      id: String((idIdx >= 0 ? cols[idIdx] : cols[0]) || '').trim().toUpperCase(),
      name: String((nameIdx >= 0 ? cols[nameIdx] : cols[1]) || '').trim(),
    }))
    .filter((entry) => entry.id);
};

export default function VotingSetupPanel({
  config,
  eventCurrency,
  saving,
  containerClassName,
  onChange,
  onSave,
}: {
  config: VotingSetupConfig | null;
  eventCurrency: string;
  saving: boolean;
  containerClassName: string;
  onChange: (nextConfig: VotingSetupConfig) => void;
  onSave: () => void;
}) {
  const electionMode = config?.mode === 'ELECTION';
  const verification = useMemo(() => getVerificationSettings(config), [config]);
  const [importingIds, setImportingIds] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const patchVerification = (patch: Partial<VotingVerificationSettings>) => {
    if (!config) return;
    onChange(
      withVerificationSettings(config, {
        ...verification,
        ...patch,
      })
    );
  };

  const handleImportManualIds = async (file: File) => {
    if (!config) return;
    try {
      setImportingIds(true);
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx')) {
        toast.error('Legacy .xls is not supported. Use .xlsx or .csv');
        return;
      }
      const rows = lowerName.endsWith('.xlsx')
        ? await parseXlsxRows(file)
        : String(await file.text())
            .split(/\r?\n/)
            .map((row) => row.trim())
            .filter(Boolean)
            .map(parseCsvRow);

      const importedEntries = importManualIdRows(rows);
      if (!importedEntries.length) {
        toast.error('No valid voter IDs found in the file');
        return;
      }
      const existingMap = new Map(verification.manualIdEntries.map((entry) => [entry.id, entry]));
      importedEntries.forEach((entry) => {
        existingMap.set(entry.id, entry);
      });
      patchVerification({
        manualIdEnabled: true,
        manualIdEntries: Array.from(existingMap.values()),
      });
      toast.success(`Imported ${importedEntries.length} voter ID row(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import voter IDs');
    } finally {
      setImportingIds(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return (
    <section className={`${containerClassName} panel`}>
      <div className="panel-header">
        <h2 className="panel-title">Voting settings</h2>
      </div>
      <div className="panel-body space-y-4">
      {config ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="label">Mode</span>
              <select
                className="input"
                value={config.mode}
                onChange={(event) => {
                  const nextMode = event.target.value as VoteMode;
                  onChange({
                    ...config,
                    mode: nextMode,
                    allowPaidVotes: nextMode === 'ELECTION' ? false : config.allowPaidVotes,
                    maxVotesPerPurchase: nextMode === 'ELECTION' ? 1 : Math.max(1, config.maxVotesPerPurchase),
                  });
                }}
              >
                <option value="AWARDS">Awards</option>
                <option value="ELECTION">Election</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Event Currency</span>
              <div className="input flex items-center bg-surface-50 font-semibold text-brand-900">{eventCurrency}</div>
            </label>
            <label className="space-y-1">
              <span className="label">Unit Price</span>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={config.voteUnitPrice}
                onChange={(event) => onChange({ ...config, voteUnitPrice: Number(event.target.value || 0) })}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Max Votes Per Purchase</span>
              <input
                className="input"
                type="number"
                min={1}
                value={electionMode ? 1 : config.maxVotesPerPurchase}
                disabled={electionMode}
                onChange={(event) =>
                  onChange({ ...config, maxVotesPerPurchase: Math.max(1, Number(event.target.value || 1)) })
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="inline-flex items-center gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={config.isEnabled}
                onChange={(event) => onChange({ ...config, isEnabled: event.target.checked })}
              />
              Open Voting
            </label>
            <label className="inline-flex items-center gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={config.allowFreeVotes}
                onChange={(event) => onChange({ ...config, allowFreeVotes: event.target.checked })}
              />
              Free Votes
            </label>
            <label className="inline-flex items-center gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={electionMode ? false : config.allowPaidVotes}
                disabled={electionMode}
                onChange={(event) => onChange({ ...config, allowPaidVotes: event.target.checked })}
              />
              Paid Votes
            </label>
            <label className="inline-flex items-center gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={config.requireOtpForElection}
                onChange={(event) => onChange({ ...config, requireOtpForElection: event.target.checked })}
              />
              Phone OTP Verification
            </label>
            <label className="inline-flex items-center gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={verification.manualIdEnabled}
                onChange={(event) => patchVerification({ manualIdEnabled: event.target.checked })}
              />
              Manual Voter IDs
            </label>
            <label className="inline-flex items-center gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900 md:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(config.allowPublicNominations)}
                onChange={(event) => onChange({ ...config, allowPublicNominations: event.target.checked })}
              />
              Allow Public Nominations
            </label>
          </div>

          {verification.manualIdEnabled ? (
            <section className="space-y-4 rounded-xl border border-surface-200 bg-surface-50 p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),auto] md:items-end">
                <label className="space-y-1">
                  <span className="label">Manual ID Label</span>
                  <input
                    className="input"
                    value={verification.manualIdLabel}
                    onChange={(event) => patchVerification({ manualIdLabel: event.target.value })}
                    placeholder="Voter ID"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => importInputRef.current?.click()}
                    disabled={importingIds}
                  >
                    {importingIds ? 'Importing...' : 'Import CSV/XLSX'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => patchVerification({ manualIdEntries: [] })}
                    disabled={!verification.manualIdEntries.length}
                  >
                    Clear List
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-surface-200 bg-white px-4 py-3 text-sm text-surface-600">
                {verification.manualIdEntries.length > 0
                  ? `${verification.manualIdEntries.length.toLocaleString()} approved voter IDs loaded`
                  : 'No voter IDs uploaded yet'}
              </div>
              {verification.manualIdEntries.length > 0 ? (
                <div className="max-h-56 overflow-auto rounded-lg border border-surface-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-surface-50 text-left text-[12px] font-semibold text-surface-600">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verification.manualIdEntries.slice(0, 200).map((entry) => (
                        <tr key={entry.id} className="border-t border-surface-100">
                          <td className="px-4 py-3 font-medium text-brand-900">{entry.id}</td>
                          <td className="px-4 py-3 text-surface-600">{entry.name || 'Unnamed voter'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {verification.manualIdEntries.length > 200 ? (
                    <div className="border-t border-surface-100 px-4 py-3 text-xs text-surface-500">
                      Showing the first 200 entries in the preview.
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className="text-xs text-surface-500">
                Upload a CSV or XLSX file with `id` and `name` columns. The backend will verify the submitted ID against this saved list.
              </p>
            </section>
          ) : null}

          <div className="flex justify-end">
            <button className="btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <p className="text-sm text-surface-500">
            {electionMode
              ? 'Election mode always disables paid votes and limits each completed submission to one vote. Choose phone OTP, manual voter IDs, or both.'
              : 'Awards can use free votes, paid votes, and optional phone OTP verification.'}
          </p>

          {electionMode && !config.requireOtpForElection && !verification.manualIdEnabled ? (
            <p className="text-sm font-medium text-amber-700">
              Election mode requires at least one identity check before guests can vote.
            </p>
          ) : null}

          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void handleImportManualIds(file);
            }}
          />
        </>
      ) : (
        <p className="text-sm text-surface-600">Voting setup is not available for this event yet.</p>
      )}
      </div>
    </section>
  );
}
