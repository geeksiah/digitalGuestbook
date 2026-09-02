'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { formatDate, resolvePublicAssetUrl } from '@/lib/utils';

type VoteMode = 'AWARDS' | 'ELECTION';

type NominationField = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'select' | 'url';
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
  description?: string | null;
  mode: VoteMode;
  isActive: boolean;
  allowPublicNominations?: boolean;
  nominationFormFields?: NominationField[];
  options: Array<{ id: string }>;
};

type VotingOption = {
  id: string;
  contestId?: string;
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

type VotingNomination = {
  id: string;
  contestId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  nomineeName: string;
  nomineeDescription?: string | null;
  nomineeImagePath?: string | null;
  nomineeImageUrl?: string | null;
  submitterName: string;
  submitterEmail?: string | null;
  submitterPhone?: string | null;
  createdAt?: string;
  reviewNotes?: string | null;
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
  // `eyebrow` is retained for call sites; the title alone carries the identity.
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="min-w-0">
          <h2 className="panel-title">{title}</h2>
          {description ? <p className="mt-0.5 meta">{description}</p> : null}
        </div>
      </div>
      <div className="panel-body space-y-4">{children}</div>
    </section>
  );
}

function TogglePill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-sm font-medium transition ${
        active
          ? 'bg-brand-900 text-white shadow-[0_10px_30px_rgba(6,57,50,0.18)]'
          : 'bg-white text-surface-600 ring-1 ring-surface-200 hover:bg-surface-50'
      }`}
    >
      {label}
    </button>
  );
}

export function VotingCategoryPanel({
  contests,
  selectedContestId,
  newContestTitle,
  newContestMode,
  savingContest,
  editingContestId,
  editingContestTitle,
  editingContestDescription,
  savingEditingContest,
  onContestTitleChange,
  onContestModeChange,
  onCreateContest,
  onSelectContest,
  onStartEditingContest,
  onEditingContestTitleChange,
  onEditingContestDescriptionChange,
  onSaveEditingContest,
  onCancelEditingContest,
  onToggleContestStatus,
  onDeleteContest,
}: {
  contests: VotingContest[];
  selectedContestId: string;
  newContestTitle: string;
  newContestMode: VoteMode;
  savingContest: boolean;
  editingContestId: string;
  editingContestTitle: string;
  editingContestDescription: string;
  savingEditingContest: boolean;
  onContestTitleChange: (value: string) => void;
  onContestModeChange: (value: VoteMode) => void;
  onCreateContest: () => void;
  onSelectContest: (contestId: string) => void;
  onStartEditingContest: (contest: any) => void;
  onEditingContestTitleChange: (value: string) => void;
  onEditingContestDescriptionChange: (value: string) => void;
  onSaveEditingContest: () => void;
  onCancelEditingContest: () => void;
  onToggleContestStatus: (contest: any) => void;
  onDeleteContest: (contest: any) => void;
}) {
  return (
    <SectionCard
      eyebrow="Categories"
      title="Organize voting categories"
      description="Create each award, election, or contest here. Keep categories clean, active, and easy to manage."
    >
      <div className="grid gap-3 rounded-xl border border-surface-200 bg-surface-50/80 p-4 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
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
        <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-5 py-12 text-sm text-surface-500">
          No categories yet. Create the first category to start collecting nominees and votes.
        </div>
      ) : (
        <div className="grid gap-3">
          {contests.map((contest) => (
            <article
              key={contest.id}
              className={`rounded-xl border p-5 transition ${
                selectedContestId === contest.id
                  ? 'border-brand-300 bg-brand-50/40 shadow-[0_12px_32px_rgba(6,57,50,0.08)]'
                  : 'border-surface-200 bg-white'
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  {editingContestId === contest.id ? (
                    <div className="space-y-3">
                      <input
                        className="input"
                        value={editingContestTitle}
                        onChange={(event) => onEditingContestTitleChange(event.target.value)}
                        placeholder="Category title"
                      />
                      <textarea
                        className="input min-h-[140px]"
                        value={editingContestDescription}
                        onChange={(event) => onEditingContestDescriptionChange(event.target.value)}
                        placeholder="Category description"
                      />
                    </div>
                  ) : (
                    <button type="button" onClick={() => onSelectContest(contest.id)} className="min-w-0 w-full text-left">
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
                        <div className="rounded-lg bg-surface-50 px-3 py-3">
                          <p className="text-[13px] font-medium text-surface-600">Nominees</p>
                          <p className="mt-1 text-lg font-semibold text-brand-900">{contest.options?.length || 0}</p>
                        </div>
                        <div className="rounded-lg bg-surface-50 px-3 py-3">
                          <p className="text-[13px] font-medium text-surface-600">Public nominations</p>
                          <p className="mt-1 text-sm font-semibold text-brand-900">
                            {contest.allowPublicNominations ? 'Open' : 'Closed'}
                          </p>
                        </div>
                      </div>
                      {contest.description ? (
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-surface-500">{contest.description}</p>
                      ) : null}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {editingContestId === contest.id ? (
                    <>
                      <button className="btn-outline text-xs" onClick={onSaveEditingContest} disabled={savingEditingContest}>
                        {savingEditingContest ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn-ghost text-xs" onClick={onCancelEditingContest}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn-outline text-xs" onClick={() => onStartEditingContest(contest)}>
                      Edit
                    </button>
                  )}
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
          <div className="rounded-xl border border-surface-200 bg-surface-50/80 p-4">
            <p className="text-[13px] font-medium text-surface-600">Assign to categories</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {contests.map((contest) => (
                <TogglePill
                  key={contest.id}
                  active={selectedNomineeContestIds.includes(contest.id)}
                  label={contest.title}
                  onClick={() => onToggleNomineeContest(contest.id, !selectedNomineeContestIds.includes(contest.id))}
                />
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
            <textarea
              className="input min-h-[160px]"
              placeholder="Full nominee profile"
              value={newOptionDescription}
              onChange={(event) => onOptionDescriptionChange(event.target.value)}
              disabled={!selectedContestId}
            />
            <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50 p-4">
              <p className="text-[13px] font-medium text-surface-600">Nominee photo</p>
              <div className="mt-3 overflow-hidden rounded-lg border border-surface-200 bg-white">
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
      </div>

      <div className="space-y-4">
        <SectionCard
          eyebrow="Nomination form"
          title="Control public nominations"
          description="Open or close public nominations for this category and define the extra details nominees must submit."
        >
          <div className="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
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

          <div className="grid gap-3 rounded-xl border border-surface-200 bg-white p-4">
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
                <option value="url">URL</option>
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
              <button
                type="button"
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  newFieldRequired
                    ? 'bg-brand-900 text-white'
                    : 'bg-surface-100 text-surface-600'
                }`}
                onClick={() => onNewFieldRequiredChange(!newFieldRequired)}
                disabled={!selectedContestId}
              >
                {newFieldRequired ? 'Required' : 'Optional'}
              </button>
              <button className="btn-outline text-xs" onClick={onAddField} disabled={!selectedContestId || savingNominationRule}>
                Add field
              </button>
            </div>
          </div>

          {selectedNominationFields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-5 py-8 text-sm text-surface-500">
              No custom fields yet. Add fields if you want nominations to collect more than name, description, and photo.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedNominationFields.map((field) => {
                const isEditing = editingFieldId === field.id && editingFieldDraft;
                return (
                  <div key={field.id} className="rounded-xl border border-surface-200 bg-white p-4">
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
                            <option value="url">URL</option>
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
                          <button
                            type="button"
                            className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                              editingFieldDraft.required
                                ? 'bg-brand-900 text-white'
                                : 'bg-surface-100 text-surface-600'
                            }`}
                            onClick={() =>
                              onEditingFieldDraftChange(
                                editingFieldDraft ? { ...editingFieldDraft, required: !editingFieldDraft.required } : editingFieldDraft
                              )
                            }
                          >
                            {editingFieldDraft.required ? 'Required' : 'Optional'}
                          </button>
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
    </section>
  );
}

export function VotingPublishedNomineesPanel({
  contests,
  options,
  selectedContestTitle,
  publishedContestFilter,
  onPublishedContestFilterChange,
  editingOptionId,
  editingOptionName,
  editingOptionDescription,
  editingOptionImagePath,
  editingOptionImagePreview,
  editingOptionContestIds,
  savingEditingOption,
  uploadingEditingOptionImage,
  onStartEditingNominee,
  onEditingOptionNameChange,
  onEditingOptionDescriptionChange,
  onToggleEditingNomineeContest,
  onUploadEditingImageClick,
  onRemoveEditingImage,
  onSaveEditingNominee,
  onCancelEditingNominee,
  onToggleNomineeStatus,
  onDeleteNominee,
}: {
  contests: VotingContest[];
  options: VotingOption[];
  selectedContestTitle: string;
  publishedContestFilter: string;
  onPublishedContestFilterChange: (contestId: string) => void;
  editingOptionId: string;
  editingOptionName: string;
  editingOptionDescription: string;
  editingOptionImagePath: string;
  editingOptionImagePreview: string;
  editingOptionContestIds: string[];
  savingEditingOption: boolean;
  uploadingEditingOptionImage: boolean;
  onStartEditingNominee: (option: any) => void;
  onEditingOptionNameChange: (value: string) => void;
  onEditingOptionDescriptionChange: (value: string) => void;
  onToggleEditingNomineeContest: (contestId: string, checked: boolean) => void;
  onUploadEditingImageClick: () => void;
  onRemoveEditingImage: () => void;
  onSaveEditingNominee: () => void;
  onCancelEditingNominee: () => void;
  onToggleNomineeStatus: (option: any) => void;
  onDeleteNominee: (option: any) => void;
}) {
  const visibleOptions = useMemo(
    () =>
      publishedContestFilter
        ? options.filter((option) => option.contestId === publishedContestFilter)
        : options,
    [options, publishedContestFilter]
  );

  return (
    <SectionCard
      eyebrow="Published nominees"
      title="Manage published profiles"
      description={
        selectedContestTitle
          ? `Update ${selectedContestTitle} nominees, adjust visibility, and assign additional categories.`
          : 'Manage nominees across all categories and filter when needed.'
      }
    >
      <div className="grid gap-3 rounded-xl border border-surface-200 bg-surface-50/80 p-4 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="text-sm text-surface-500">
          Showing {visibleOptions.length} published profile{visibleOptions.length === 1 ? '' : 's'}
        </div>
        <select
          className="input"
          value={publishedContestFilter}
          onChange={(event) => onPublishedContestFilterChange(event.target.value)}
        >
          <option value="">All categories</option>
          {contests.map((contest) => (
            <option key={contest.id} value={contest.id}>
              {contest.title}
            </option>
          ))}
        </select>
      </div>

      {visibleOptions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-5 py-12 text-sm text-surface-500">
          No published nominees match this filter.
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleOptions.map((option) => (
            <article key={option.id} className="rounded-xl border border-surface-200 bg-white p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  {resolvePublicAssetUrl(
                    editingOptionId === option.id ? editingOptionImagePreview || editingOptionImagePath : option.imageUrl || option.imagePath
                  ) ? (
                    <img
                      src={
                        resolvePublicAssetUrl(
                          editingOptionId === option.id
                            ? editingOptionImagePreview || editingOptionImagePath
                            : option.imageUrl || option.imagePath
                        ) || ''
                      }
                      alt={option.name}
                      className="h-16 w-16 rounded-lg border border-surface-200 object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg border border-surface-200 bg-surface-100" />
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
                          className="input min-h-[140px]"
                          value={editingOptionDescription}
                          onChange={(event) => onEditingOptionDescriptionChange(event.target.value)}
                          placeholder="Full nominee profile"
                        />
                        <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
                          <p className="text-[13px] font-medium text-surface-600">Assigned categories</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {contests.map((contest) => (
                              <TogglePill
                                key={contest.id}
                                active={editingOptionContestIds.includes(contest.id)}
                                label={contest.title}
                                onClick={() => onToggleEditingNomineeContest(contest.id, !editingOptionContestIds.includes(contest.id))}
                              />
                            ))}
                          </div>
                        </div>
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
                        <p className="mt-1 text-sm leading-6 text-surface-500">{option.description || 'Nominee profile'}</p>
                        {option.contestTitle ? (
                          <p className="mt-2 text-[13px] font-medium text-surface-600">{option.contestTitle}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                          <div className="rounded-full bg-surface-50 px-3 py-2 text-surface-600">
                            <span className="font-semibold text-brand-900">{option.totalVotes}</span> total votes
                          </div>
                          <div className="rounded-full bg-surface-50 px-3 py-2 text-surface-600">
                            <span className="font-semibold text-brand-900">{option.freeVotes}</span> free
                          </div>
                          <div className="rounded-full bg-surface-50 px-3 py-2 text-surface-600">
                            <span className="font-semibold text-brand-900">{option.paidVotes}</span> paid
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
  const [selectedNominationId, setSelectedNominationId] = useState('');
  const selectedNomination = useMemo(
    () => nominations.find((nomination) => nomination.id === selectedNominationId) || null,
    [nominations, selectedNominationId]
  );
  const selectedNominationView = selectedNomination ? nominationPresentation(selectedNomination) : null;

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
        <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-5 py-12 text-sm text-surface-500">
          No nominations yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {nominations.map((nomination) => {
            return (
              <article key={nomination.id} className="rounded-xl border border-surface-200 bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold tracking-tight text-brand-900">{nomination.nomineeName}</h3>
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
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-surface-500">
                      <span>{nomination.contest?.title || nomination.contestId}</span>
                      <span>Submitted by {nomination.submitterName}</span>
                      {nomination.createdAt ? <span>{formatDate(nomination.createdAt, 'MMM d, yyyy p')}</span> : null}
                    </div>
                    {(nomination.submitterEmail || nomination.submitterPhone) ? (
                      <p className="mt-2 text-sm text-surface-500">
                        {nomination.submitterEmail || 'No email'}
                        {nomination.submitterPhone ? ` · ${nomination.submitterPhone}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button className="btn-outline text-xs" onClick={() => setSelectedNominationId(nomination.id)}>
                      View details
                    </button>
                    {nomination.status === 'PENDING' ? (
                      <>
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
                      </>
                    ) : nomination.approvedOption ? (
                      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        Published as {nomination.approvedOption.name}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedNomination && selectedNominationView ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-surface-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-surface-600">Nomination details</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">{selectedNomination.nomineeName}</h3>
                <p className="mt-1 text-sm text-surface-500">
                  {selectedNomination.contest?.title || selectedNomination.contestId}
                </p>
              </div>
              <button className="btn-ghost px-3" onClick={() => setSelectedNominationId('')}>
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[160px_minmax(0,1fr)]">
              {resolvePublicAssetUrl(selectedNominationView.nomineeImageUrl || selectedNomination.nomineeImageUrl || selectedNomination.nomineeImagePath) ? (
                <img
                  src={
                    resolvePublicAssetUrl(
                      selectedNominationView.nomineeImageUrl ||
                        selectedNomination.nomineeImageUrl ||
                        selectedNomination.nomineeImagePath
                    ) || ''
                  }
                  alt={selectedNomination.nomineeName}
                  className="h-40 w-40 rounded-xl border border-surface-200 object-cover"
                />
              ) : (
                <div className="h-40 w-40 rounded-xl border border-surface-200 bg-surface-100" />
              )}

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-50 px-4 py-3">
                    <p className="text-[13px] font-medium text-surface-600">Sender</p>
                    <p className="mt-1 text-sm font-semibold text-brand-900">{selectedNomination.submitterName}</p>
                  </div>
                  <div className="rounded-lg bg-surface-50 px-4 py-3">
                    <p className="text-[13px] font-medium text-surface-600">Submitted</p>
                    <p className="mt-1 text-sm font-semibold text-brand-900">
                      {selectedNomination.createdAt ? formatDate(selectedNomination.createdAt, 'MMM d, yyyy p') : 'Unknown'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-50 px-4 py-3">
                    <p className="text-[13px] font-medium text-surface-600">Email</p>
                    <p className="mt-1 text-sm text-brand-900">{selectedNomination.submitterEmail || 'Not provided'}</p>
                  </div>
                  <div className="rounded-lg bg-surface-50 px-4 py-3">
                    <p className="text-[13px] font-medium text-surface-600">Phone</p>
                    <p className="mt-1 text-sm text-brand-900">{selectedNomination.submitterPhone || 'Not provided'}</p>
                  </div>
                </div>

                {selectedNomination.nomineeDescription ? (
                  <div>
                    <p className="text-[13px] font-medium text-surface-600">Nominee profile</p>
                    <p className="mt-2 text-sm leading-6 text-surface-600">{selectedNomination.nomineeDescription}</p>
                  </div>
                ) : null}

                {selectedNominationView.customFieldRows.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedNominationView.customFieldRows.map((row) => (
                      <div key={`${selectedNomination.id}:${row.key}`} className="rounded-lg bg-surface-50 px-4 py-3">
                        <p className="text-[13px] font-medium text-surface-600">{row.label}</p>
                        <p className="mt-1 text-sm text-brand-900">{row.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {selectedNomination.status === 'PENDING' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-outline border-emerald-200 text-emerald-700"
                      onClick={() => onReviewNomination(selectedNomination.id, 'APPROVED')}
                      disabled={reviewingNominationId === selectedNomination.id}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-outline border-rose-200 text-rose-700"
                      onClick={() => onReviewNomination(selectedNomination.id, 'REJECTED')}
                      disabled={reviewingNominationId === selectedNomination.id}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
