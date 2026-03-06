import type { ReactNode } from 'react';

type VoteMode = 'AWARDS' | 'ELECTION';

type NominationField = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'select';
  required?: boolean;
  placeholder?: string | null;
  options?: string[];
};

type FieldDraft = {
  label: string;
  type: NominationField['type'];
  required: boolean;
  placeholder: string;
  options: string;
};

type VotingContest = {
  id: string;
  title: string;
  mode: VoteMode;
  isActive: boolean;
  allowPublicNominations?: boolean;
  nominationFormFields?: NominationField[];
  options: Array<{ id: string }>;
};

type VotingOption = {
  id: string;
  name: string;
  description?: string | null;
  imagePath?: string | null;
  imageUrl?: string | null;
  totalVotes: number;
  freeVotes: number;
  paidVotes: number;
  isActive: boolean;
};

type VotingNomination = {
  id: string;
  contestId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  nomineeName: string;
  nomineeDescription?: string | null;
  submitterName: string;
  approvedOption?: { id: string; name: string } | null;
  contest?: { id: string; title: string; mode: VoteMode } | null;
};

type CustomFieldRow = {
  key: string;
  label: string;
  value: string;
};

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-card space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-brand-900">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-surface-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function VotingCategoryPanel({
  contests,
  selectedContestId,
  newContestTitle,
  newContestMode,
  savingContest,
  onContestTitleChange,
  onContestModeChange,
  onCreateContest,
  onSelectContest,
  onRenameContest,
  onToggleContestStatus,
  onDeleteContest,
}: {
  contests: VotingContest[];
  selectedContestId: string;
  newContestTitle: string;
  newContestMode: VoteMode;
  savingContest: boolean;
  onContestTitleChange: (value: string) => void;
  onContestModeChange: (value: VoteMode) => void;
  onCreateContest: () => void;
  onSelectContest: (contestId: string) => void;
  onRenameContest: (contest: any) => void;
  onToggleContestStatus: (contest: any) => void;
  onDeleteContest: (contest: any) => void;
}) {
  return (
    <SectionCard
      eyebrow="Categories"
      title="Organize voting categories"
      description="Create each award, election, or contest here. Keep categories clean, active, and easy to manage."
    >
      <div className="grid gap-3 rounded-3xl border border-surface-200 bg-surface-50/80 p-4 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          className="input"
          placeholder="Category title"
          value={newContestTitle}
          onChange={(event) => onContestTitleChange(event.target.value)}
        />
        <select
          className="input"
          value={newContestMode}
          onChange={(event) => onContestModeChange(event.target.value as VoteMode)}
        >
          <option value="AWARDS">Awards</option>
          <option value="ELECTION">Election</option>
        </select>
        <button className="btn-primary w-full lg:w-auto" onClick={onCreateContest} disabled={savingContest}>
          {savingContest ? 'Saving...' : 'Create category'}
        </button>
      </div>

      {contests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-5 py-12 text-sm text-surface-500">
          No categories yet. Create the first category to start collecting nominees and votes.
        </div>
      ) : (
        <div className="grid gap-3">
          {contests.map((contest) => (
            <article
              key={contest.id}
              className={`rounded-3xl border p-5 transition ${
                selectedContestId === contest.id
                  ? 'border-brand-300 bg-brand-50/40 shadow-[0_12px_32px_rgba(6,57,50,0.08)]'
                  : 'border-surface-200 bg-white'
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <button type="button" onClick={() => onSelectContest(contest.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold tracking-tight text-brand-900">{contest.title}</h3>
                    <span className="rounded-full bg-surface-100 px-2.5 py-1 text-[11px] font-semibold text-surface-600">
                      {contest.mode === 'ELECTION' ? 'Election' : 'Awards'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        contest.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500'
                      }`}
                    >
                      {contest.isActive ? 'Open' : 'Paused'}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl bg-surface-50 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Nominees</p>
                      <p className="mt-1 text-lg font-semibold text-brand-900">{contest.options?.length || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-50 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Public nominations</p>
                      <p className="mt-1 text-sm font-semibold text-brand-900">
                        {contest.allowPublicNominations ? 'Open' : 'Closed'}
                      </p>
                    </div>
                  </div>
                </button>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button className="btn-outline text-xs" onClick={() => onRenameContest(contest)}>
                    Rename
                  </button>
                  <button className="btn-outline text-xs" onClick={() => onToggleContestStatus(contest)}>
                    {contest.isActive ? 'Pause' : 'Open'}
                  </button>
                  <button className="btn-outline border-rose-200 text-xs text-rose-700" onClick={() => onDeleteContest(contest)}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function VotingNomineePanel({
  contests,
  selectedContestTitle,
  selectedContestId,
  selectedNomineeContestIds,
  newOptionName,
  newOptionDescription,
  newOptionImagePath,
  newOptionImagePreview,
  uploadingOptionImage,
  savingOption,
  selectedNominationFields,
  newFieldLabel,
  newFieldType,
  newFieldRequired,
  newFieldPlaceholder,
  newFieldOptions,
  editingFieldId,
  editingFieldDraft,
  savingNominationRule,
  selectedContestAllowsPublicNominations,
  options,
  editingOptionId,
  editingOptionName,
  editingOptionDescription,
  editingOptionImagePath,
  editingOptionImagePreview,
  savingEditingOption,
  uploadingEditingOptionImage,
  onToggleNomineeContest,
  onOptionNameChange,
  onOptionDescriptionChange,
  onUploadImageClick,
  onRemoveImage,
  onCreateNominee,
  onTogglePublicNominations,
  onNewFieldLabelChange,
  onNewFieldTypeChange,
  onNewFieldRequiredChange,
  onNewFieldPlaceholderChange,
  onNewFieldOptionsChange,
  onAddField,
  onStartEditingField,
  onEditingFieldDraftChange,
  onSaveFieldEdit,
  onCancelFieldEdit,
  onRemoveField,
  onStartEditingNominee,
  onEditingOptionNameChange,
  onEditingOptionDescriptionChange,
  onUploadEditingImageClick,
  onRemoveEditingImage,
  onSaveEditingNominee,
  onCancelEditingNominee,
  onToggleNomineeStatus,
  onDeleteNominee,
}: {
  contests: VotingContest[];
  selectedContestTitle: string;
  selectedContestId: string;
  selectedNomineeContestIds: string[];
  newOptionName: string;
  newOptionDescription: string;
  newOptionImagePath: string;
  newOptionImagePreview: string;
  uploadingOptionImage: boolean;
  savingOption: boolean;
  selectedNominationFields: NominationField[];
  newFieldLabel: string;
  newFieldType: NominationField['type'];
  newFieldRequired: boolean;
  newFieldPlaceholder: string;
  newFieldOptions: string;
  editingFieldId: string;
  editingFieldDraft: FieldDraft | null;
  savingNominationRule: boolean;
  selectedContestAllowsPublicNominations: boolean;
  options: VotingOption[];
  editingOptionId: string;
  editingOptionName: string;
  editingOptionDescription: string;
  editingOptionImagePath: string;
  editingOptionImagePreview: string;
  savingEditingOption: boolean;
  uploadingEditingOptionImage: boolean;
  onToggleNomineeContest: (contestId: string, checked: boolean) => void;
  onOptionNameChange: (value: string) => void;
  onOptionDescriptionChange: (value: string) => void;
  onUploadImageClick: () => void;
  onRemoveImage: () => void;
  onCreateNominee: () => void;
  onTogglePublicNominations: () => void;
  onNewFieldLabelChange: (value: string) => void;
  onNewFieldTypeChange: (value: NominationField['type']) => void;
  onNewFieldRequiredChange: (value: boolean) => void;
  onNewFieldPlaceholderChange: (value: string) => void;
  onNewFieldOptionsChange: (value: string) => void;
  onAddField: () => void;
  onStartEditingField: (field: any) => void;
  onEditingFieldDraftChange: (draft: FieldDraft | null) => void;
  onSaveFieldEdit: () => void;
  onCancelFieldEdit: () => void;
  onRemoveField: (fieldId: string) => void;
  onStartEditingNominee: (option: any) => void;
  onEditingOptionNameChange: (value: string) => void;
  onEditingOptionDescriptionChange: (value: string) => void;
  onUploadEditingImageClick: () => void;
  onRemoveEditingImage: () => void;
  onSaveEditingNominee: () => void;
  onCancelEditingNominee: () => void;
  onToggleNomineeStatus: (option: any) => void;
  onDeleteNominee: (option: any) => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="space-y-4">
        <SectionCard
          eyebrow="Nominees"
          title="Add nominee profiles"
          description={
            selectedContestTitle
              ? `Working in ${selectedContestTitle}. A nominee can appear in more than one category.`
              : 'Select a category first, then add nominee details and photo.'
          }
        >
          <div className="rounded-3xl border border-surface-200 bg-surface-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">Assign to categories</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {contests.map((contest) => (
                <label key={contest.id} className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-3 py-3 text-sm text-brand-900">
                  <input
                    type="checkbox"
                    checked={selectedNomineeContestIds.includes(contest.id)}
                    onChange={(event) => onToggleNomineeContest(contest.id, event.target.checked)}
                  />
                  <span className="truncate">{contest.title}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <input
              className="input"
              placeholder="Nominee name"
              value={newOptionName}
              onChange={(event) => onOptionNameChange(event.target.value)}
              disabled={!selectedContestId}
            />
            <input
              className="input"
              placeholder="Short description"
              value={newOptionDescription}
              onChange={(event) => onOptionDescriptionChange(event.target.value)}
              disabled={!selectedContestId}
            />
            <div className="rounded-3xl border border-dashed border-surface-300 bg-surface-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">Nominee photo</p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-surface-200 bg-white">
                {newOptionImagePreview ? (
                  <img src={newOptionImagePreview} alt="Nominee preview" className="h-48 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-surface-500">
                    Upload a nominee photo to preview how this profile will look on public voting pages.
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-outline text-xs"
                  disabled={selectedNomineeContestIds.length === 0 || uploadingOptionImage}
                  onClick={onUploadImageClick}
                >
                  {uploadingOptionImage ? 'Uploading...' : newOptionImagePath ? 'Replace photo' : 'Upload photo'}
                </button>
                {newOptionImagePath ? (
                  <button type="button" className="btn-ghost text-xs" onClick={onRemoveImage}>
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            <button className="btn-primary w-full" onClick={onCreateNominee} disabled={selectedNomineeContestIds.length === 0 || savingOption}>
              {savingOption ? 'Saving nominee...' : 'Add nominee'}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Nomination form"
          title="Control public nominations"
          description="Open or close public nominations for this category and define the extra details nominees must submit."
        >
          <div className="flex flex-col gap-3 rounded-3xl border border-surface-200 bg-surface-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-900">
                {selectedContestAllowsPublicNominations ? 'Public nominations are open' : 'Public nominations are closed'}
              </p>
              <p className="mt-1 text-sm text-surface-500">
                Category-level setting. The global voting setup still controls the overall public nomination experience.
              </p>
            </div>
            <button className="btn-outline text-xs" onClick={onTogglePublicNominations} disabled={!selectedContestId || savingNominationRule}>
              {selectedContestAllowsPublicNominations ? 'Close nominations' : 'Open nominations'}
            </button>
          </div>

          <div className="grid gap-3 rounded-3xl border border-surface-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="input"
                placeholder="Field label"
                value={newFieldLabel}
                onChange={(event) => onNewFieldLabelChange(event.target.value)}
                disabled={!selectedContestId}
              />
              <select
                className="input"
                value={newFieldType}
                onChange={(event) => onNewFieldTypeChange(event.target.value as NominationField['type'])}
                disabled={!selectedContestId}
              >
                <option value="text">Text</option>
                <option value="textarea">Long text</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="number">Number</option>
                <option value="select">Dropdown</option>
              </select>
            </div>
            <input
              className="input"
              placeholder="Placeholder text (optional)"
              value={newFieldPlaceholder}
              onChange={(event) => onNewFieldPlaceholderChange(event.target.value)}
              disabled={!selectedContestId}
            />
            {newFieldType === 'select' ? (
              <input
                className="input"
                placeholder="Dropdown options, separated by commas"
                value={newFieldOptions}
                onChange={(event) => onNewFieldOptionsChange(event.target.value)}
                disabled={!selectedContestId}
              />
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-surface-600">
                <input
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(event) => onNewFieldRequiredChange(event.target.checked)}
                  disabled={!selectedContestId}
                />
                Make this required
              </label>
              <button className="btn-outline text-xs" onClick={onAddField} disabled={!selectedContestId || savingNominationRule}>
                Add field
              </button>
            </div>
          </div>

          {selectedNominationFields.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-5 py-8 text-sm text-surface-500">
              No custom fields yet. Add fields if you want nominations to collect more than name, description, and photo.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedNominationFields.map((field) => {
                const isEditing = editingFieldId === field.id && editingFieldDraft;
                return (
                  <div key={field.id} className="rounded-3xl border border-surface-200 bg-white p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            className="input"
                            value={editingFieldDraft.label}
                            onChange={(event) =>
                              onEditingFieldDraftChange(
                                editingFieldDraft ? { ...editingFieldDraft, label: event.target.value } : editingFieldDraft
                              )
                            }
                          />
                          <select
                            className="input"
                            value={editingFieldDraft.type}
                            onChange={(event) =>
                              onEditingFieldDraftChange(
                                editingFieldDraft
                                  ? { ...editingFieldDraft, type: event.target.value as NominationField['type'] }
                                  : editingFieldDraft
                              )
                            }
                          >
                            <option value="text">Text</option>
                            <option value="textarea">Long text</option>
                            <option value="email">Email</option>
                            <option value="phone">Phone</option>
                            <option value="number">Number</option>
                            <option value="select">Dropdown</option>
                          </select>
                        </div>
                        <input
                          className="input"
                          placeholder="Placeholder text (optional)"
                          value={editingFieldDraft.placeholder}
                          onChange={(event) =>
                            onEditingFieldDraftChange(
                              editingFieldDraft ? { ...editingFieldDraft, placeholder: event.target.value } : editingFieldDraft
                            )
                          }
                        />
                        {editingFieldDraft.type === 'select' ? (
                          <input
                            className="input"
                            placeholder="Dropdown options, separated by commas"
                            value={editingFieldDraft.options}
                            onChange={(event) =>
                              onEditingFieldDraftChange(
                                editingFieldDraft ? { ...editingFieldDraft, options: event.target.value } : editingFieldDraft
                              )
                            }
                          />
                        ) : null}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <label className="inline-flex items-center gap-2 text-sm text-surface-600">
                            <input
                              type="checkbox"
                              checked={editingFieldDraft.required}
                              onChange={(event) =>
                                onEditingFieldDraftChange(
                                  editingFieldDraft ? { ...editingFieldDraft, required: event.target.checked } : editingFieldDraft
                                )
                              }
                            />
                            Make this required
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button className="btn-outline text-xs" onClick={onSaveFieldEdit} disabled={savingNominationRule}>
                              Save field
                            </button>
                            <button className="btn-ghost text-xs" onClick={onCancelFieldEdit}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-brand-900">{field.label}</p>
                          <p className="mt-1 text-sm text-surface-500">
                            {field.type === 'textarea' ? 'Long text' : field.type}
                            {field.required ? ' - Required' : ' - Optional'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-outline text-xs" onClick={() => onStartEditingField(field)}>
                            Edit
                          </button>
                          <button className="btn-outline border-rose-200 text-xs text-rose-700" onClick={() => onRemoveField(field.id)} disabled={savingNominationRule}>
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Existing nominees"
        title="Published nominee profiles"
        description="Review how nominees are presented across this category and quickly update their visibility."
      >
        {options.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-5 py-12 text-sm text-surface-500">
            No nominees in this category yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {options.map((option) => (
              <article key={option.id} className="rounded-3xl border border-surface-200 bg-white p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {(editingOptionId === option.id ? editingOptionImagePreview || editingOptionImagePath : option.imageUrl || option.imagePath) ? (
                      <img
                        src={
                          editingOptionId === option.id
                            ? editingOptionImagePreview || editingOptionImagePath || ''
                            : option.imageUrl || option.imagePath || ''
                        }
                        alt={option.name}
                        className="h-16 w-16 rounded-2xl border border-surface-200 object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-2xl border border-surface-200 bg-surface-100" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold tracking-tight text-brand-900">
                          {editingOptionId === option.id ? editingOptionName || option.name : option.name}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            option.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500'
                          }`}
                        >
                          {option.isActive ? 'Visible' : 'Hidden'}
                        </span>
                      </div>
                      {editingOptionId === option.id ? (
                        <div className="mt-3 space-y-3">
                          <input
                            className="input"
                            value={editingOptionName}
                            onChange={(event) => onEditingOptionNameChange(event.target.value)}
                            placeholder="Nominee name"
                          />
                          <textarea
                            className="input min-h-[110px]"
                            value={editingOptionDescription}
                            onChange={(event) => onEditingOptionDescriptionChange(event.target.value)}
                            placeholder="Short description"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-outline text-xs"
                              onClick={onUploadEditingImageClick}
                              disabled={uploadingEditingOptionImage}
                            >
                              {uploadingEditingOptionImage ? 'Uploading...' : editingOptionImagePath ? 'Replace photo' : 'Upload photo'}
                            </button>
                            {editingOptionImagePath ? (
                              <button type="button" className="btn-ghost text-xs" onClick={onRemoveEditingImage}>
                                Remove photo
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="mt-1 text-sm text-surface-500">{option.description || 'Nominee profile'}</p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-2xl bg-surface-50 px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Total votes</p>
                              <p className="mt-1 text-base font-semibold text-brand-900">{option.totalVotes}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-50 px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Free</p>
                              <p className="mt-1 text-base font-semibold text-brand-900">{option.freeVotes}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-50 px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Paid</p>
                              <p className="mt-1 text-base font-semibold text-brand-900">{option.paidVotes}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {editingOptionId === option.id ? (
                      <>
                        <button className="btn-outline text-xs" onClick={onSaveEditingNominee} disabled={savingEditingOption}>
                          {savingEditingOption ? 'Saving...' : 'Save'}
                        </button>
                        <button className="btn-ghost text-xs" onClick={onCancelEditingNominee}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button className="btn-outline text-xs" onClick={() => onStartEditingNominee(option)}>
                        Edit
                      </button>
                    )}
                    <button className="btn-outline text-xs" onClick={() => onToggleNomineeStatus(option)}>
                      {option.isActive ? 'Hide' : 'Show'}
                    </button>
                    <button className="btn-outline border-rose-200 text-xs text-rose-700" onClick={() => onDeleteNominee(option)}>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  );
}

export function VotingNominationsPanel({
  nominations,
  pendingCount,
  reviewingNominationId,
  nominationPresentation,
  onReviewNomination,
}: {
  nominations: VotingNomination[];
  pendingCount: number;
  reviewingNominationId: string;
  nominationPresentation: (nomination: any) => {
    customFieldRows: CustomFieldRow[];
    nomineeImageUrl: string;
  };
  onReviewNomination: (nominationId: string, status: 'APPROVED' | 'REJECTED') => void;
}) {
  return (
    <SectionCard
      eyebrow="Nominations"
      title="Review public submissions"
      description="Approve strong submissions quickly and keep the public nomination queue easy to process."
    >
      <div className="subtle-toolbar">
        <div>
          <p className="text-sm font-semibold text-brand-900">Submission queue</p>
          <p className="mt-1 text-sm text-surface-500">Pending submissions are shown first. Approved entries can be published as nominees.</p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{pendingCount} pending</span>
      </div>

      {nominations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-5 py-12 text-sm text-surface-500">
          No nominations yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {nominations.map((nomination) => {
            const view = nominationPresentation(nomination);
            return (
              <article key={nomination.id} className="rounded-3xl border border-surface-200 bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {view.nomineeImageUrl ? (
                      <img
                        src={view.nomineeImageUrl}
                        alt={nomination.nomineeName}
                        className="h-16 w-16 rounded-2xl border border-surface-200 object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-2xl border border-surface-200 bg-surface-100" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold tracking-tight text-brand-900">{nomination.nomineeName}</h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            nomination.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700'
                              : nomination.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {nomination.status === 'PENDING'
                            ? 'Awaiting review'
                            : nomination.status === 'APPROVED'
                            ? 'Approved'
                            : 'Declined'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-surface-500">
                        {nomination.contest?.title || nomination.contestId} - Submitted by {nomination.submitterName}
                      </p>
                      {nomination.nomineeDescription ? (
                        <p className="mt-2 text-sm text-surface-600">{nomination.nomineeDescription}</p>
                      ) : null}
                    </div>
                  </div>
                  {nomination.status === 'PENDING' ? (
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        className="btn-outline border-emerald-200 text-xs text-emerald-700"
                        onClick={() => onReviewNomination(nomination.id, 'APPROVED')}
                        disabled={reviewingNominationId === nomination.id}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-outline border-rose-200 text-xs text-rose-700"
                        onClick={() => onReviewNomination(nomination.id, 'REJECTED')}
                        disabled={reviewingNominationId === nomination.id}
                      >
                        Reject
                      </button>
                    </div>
                  ) : nomination.approvedOption ? (
                    <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      Published as {nomination.approvedOption.name}
                    </div>
                  ) : null}
                </div>

                {view.customFieldRows.length ? (
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {view.customFieldRows.map((row) => (
                      <div key={`${nomination.id}:${row.key}`} className="rounded-2xl bg-surface-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">{row.label}</p>
                        <p className="mt-1 text-sm text-brand-900">{row.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
