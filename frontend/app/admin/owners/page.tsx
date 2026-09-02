'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ownersApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { formatCount, getErrorMessage } from '@/lib/utils';
import {
  Avatar,
  EmptyState,
  ListSkeleton,
  PageHeader,
  Pagination,
  SearchField,
  SegmentedControl,
  StatusBadge,
  SubmitButton,
  Switch,
  Td,
  Th,
  Toolbar,
  useDebounced,
  usePagination,
} from '@/components/ui/Primitives';
import { ConfirmDialog, Menu, MenuItem, MenuSeparator, Modal } from '@/components/ui/Overlay';
import { Plus } from '@/components/ui/icons';

interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  countryCode?: string | null;
  isActive: boolean;
  createdAt: string;
  eventCount?: number;
  wallet?: {
    id: string;
    preferredMethod: string;
    currency: string;
    isVerified: boolean;
  } | null;
}

type ActiveFilter = 'all' | 'active' | 'inactive';

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'GH', name: 'Ghana' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'ZA', name: 'South Africa' },
];

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ActiveFilter>('all');

  const [editing, setEditing] = useState<Owner | null>(null);
  const [passwordFor, setPasswordFor] = useState<Owner | null>(null);
  const [deleting, setDeleting] = useState<Owner | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useDebounced(search.trim(), 300);

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (query) params.search = query;
      if (filter !== 'all') params.isActive = filter === 'active';
      const response = await ownersApi.list(params);
      setOwners(response.data.owners || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load owners.'));
    } finally {
      setLoading(false);
    }
  }, [query, filter]);

  useEffect(() => {
    void fetchOwners();
  }, [fetchOwners]);

  const paged = usePagination(owners, 20);

  const resendWelcome = async (owner: Owner) => {
    try {
      await ownersApi.resendWelcomeEmail(owner.id);
      toast.success(`Welcome email sent to ${owner.email}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not send the email.'));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await ownersApi.delete(deleting.id);
      toast.success('Owner deleted');
      setDeleting(null);
      await fetchOwners();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete this owner.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Owners"
        actions={
          <Link href="/admin/owners/new" className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            New owner
          </Link>
        }
        mobileActions={
          <Link href="/admin/owners/new" className="icon-btn" aria-label="New owner">
            <Plus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </Link>
        }
      />

      <Toolbar
        end={
          <SegmentedControl<ActiveFilter>
            label="Owner status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        }
      >
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search name, email or company"
          className="w-full sm:w-80"
        />
      </Toolbar>

      {error ? (
        <div className="banner-error" role="alert">
          <span className="flex-1">{error}</span>
          <button type="button" className="shrink-0 font-semibold underline" onClick={() => void fetchOwners()}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : owners.length === 0 ? (
        <EmptyState
          title={query || filter !== 'all' ? 'No matching owners' : 'No owners yet'}
          action={
            query || filter !== 'all' ? (
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Clear filters
              </button>
            ) : (
              <Link href="/admin/owners/new" className="btn-primary btn-sm">
                Create owner
              </Link>
            )
          }
        />
      ) : (
        <>
          {/* Compact rows on phones */}
          <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white lg:hidden">
            {paged.rows.map((owner) => (
              <div key={owner.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={owner.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-brand-900">{owner.name}</span>
                    {owner.isActive ? null : <StatusBadge tone="neutral">Inactive</StatusBadge>}
                  </div>
                  <p className="mt-0.5 meta truncate">
                    {owner.email}
                    {owner.company ? ` · ${owner.company}` : ''}
                  </p>
                </div>
                <OwnerActions
                  owner={owner}
                  onEdit={() => setEditing(owner)}
                  onPassword={() => setPasswordFor(owner)}
                  onResend={() => void resendWelcome(owner)}
                  onDelete={() => setDeleting(owner)}
                />
              </div>
            ))}
          </div>

          {/* Full table from lg up */}
          <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="data-table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <Th>Owner</Th>
                    <Th>Contact</Th>
                    <Th>Payouts</Th>
                    <Th align="right">Events</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((owner) => (
                    <tr key={owner.id} className="table-row">
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={owner.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-brand-900">{owner.name}</p>
                            {owner.company ? <p className="meta truncate">{owner.company}</p> : null}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <p className="truncate">{owner.email}</p>
                        {owner.phone ? <p className="meta">{owner.phone}</p> : null}
                      </Td>
                      <Td>
                        {owner.wallet ? (
                          <StatusBadge tone={owner.wallet.isVerified ? 'success' : 'warning'}>
                            {owner.wallet.isVerified ? 'Verified' : 'Pending'}
                          </StatusBadge>
                        ) : (
                          <span className="text-surface-500">Not set up</span>
                        )}
                      </Td>
                      <Td align="right" className="num">
                        {formatCount(owner.eventCount || 0)}
                      </Td>
                      <Td>
                        <StatusBadge tone={owner.isActive ? 'success' : 'neutral'} dot>
                          {owner.isActive ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" className="btn-outline btn-sm" onClick={() => setEditing(owner)}>
                            Edit
                          </button>
                          <OwnerActions
                            owner={owner}
                            hideEdit
                            onEdit={() => setEditing(owner)}
                            onPassword={() => setPasswordFor(owner)}
                            onResend={() => void resendWelcome(owner)}
                            onDelete={() => setDeleting(owner)}
                          />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={paged.page}
            pageCount={paged.pageCount}
            total={paged.total}
            pageSize={paged.pageSize}
            onPageChange={paged.setPage}
          />
        </>
      )}

      <EditOwnerModal
        owner={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void fetchOwners();
        }}
      />

      <PasswordModal owner={passwordFor} onClose={() => setPasswordFor(null)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title={`Delete ${deleting?.name || 'owner'}?`}
        body="This permanently removes the account. It only works while the owner has no events."
        confirmLabel="Delete owner"
      />
    </div>
  );
}

function OwnerActions({
  owner,
  hideEdit,
  onEdit,
  onPassword,
  onResend,
  onDelete,
}: {
  owner: Owner;
  hideEdit?: boolean;
  onEdit: () => void;
  onPassword: () => void;
  onResend: () => void;
  onDelete: () => void;
}) {
  return (
    <Menu label={`Actions for ${owner.name}`} sheetTitle={owner.name}>
      {hideEdit ? null : <MenuItem onClick={onEdit}>Edit owner</MenuItem>}
      <MenuItem onClick={onPassword}>Set password</MenuItem>
      <MenuItem onClick={onResend}>Resend welcome email</MenuItem>
      <MenuSeparator />
      <MenuItem danger onClick={onDelete}>
        Delete owner
      </MenuItem>
    </Menu>
  );
}

function EditOwnerModal({
  owner,
  onClose,
  onSaved,
}: {
  owner: Owner | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    countryCode: 'US',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner) return;
    setForm({
      name: owner.name,
      email: owner.email,
      phone: owner.phone || '',
      company: owner.company || '',
      countryCode: owner.countryCode || 'US',
      isActive: owner.isActive,
    });
    setFormError(null);
  }, [owner]);

  const submit = async () => {
    if (!owner) return;
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Name and email are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await ownersApi.update(owner.id, {
        ...form,
        phone: form.phone || undefined,
        company: form.company || undefined,
        countryCode: form.countryCode || undefined,
      });
      toast.success('Owner updated');
      onSaved();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not update this owner.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(owner)}
      onClose={onClose}
      title={owner?.name || 'Owner'}
      size="md"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <SubmitButton loading={saving} onClick={() => void submit()}>
            Save
          </SubmitButton>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? (
          <div className="banner-error" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="owner-name">
              Name
            </label>
            <input
              id="owner-name"
              data-autofocus
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="owner-email">
              Email
            </label>
            <input
              id="owner-email"
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="owner-phone">
              Phone <span className="font-normal text-surface-600">(optional)</span>
            </label>
            <input
              id="owner-phone"
              type="tel"
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="owner-company">
              Company <span className="font-normal text-surface-600">(optional)</span>
            </label>
            <input
              id="owner-company"
              type="text"
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="owner-country">
              Country
            </label>
            <select
              id="owner-country"
              className="input"
              value={form.countryCode}
              onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-surface-200 pt-3">
          <Switch
            label="Active"
            description="Inactive owners cannot sign in."
            checked={form.isActive}
            onChange={(checked) => setForm({ ...form, isActive: checked })}
          />
        </div>
      </div>
    </Modal>
  );
}

function PasswordModal({ owner, onClose }: { owner: Owner | null; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setPassword('');
    setFormError(null);
  }, [owner]);

  const submit = async () => {
    if (!owner) return;
    if (password.length < 6) {
      setFormError('Use at least 6 characters.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await ownersApi.changePassword(owner.id, password);
      toast.success('Password changed');
      onClose();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not change the password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(owner)}
      onClose={onClose}
      title="Set password"
      description={owner ? `${owner.name} · ${owner.email}` : undefined}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <SubmitButton loading={saving} onClick={() => void submit()}>
            Set password
          </SubmitButton>
        </>
      }
    >
      <label className="label" htmlFor="owner-password">
        New password
      </label>
      <input
        id="owner-password"
        data-autofocus
        type="password"
        autoComplete="new-password"
        minLength={6}
        className={formError ? 'input input-error' : 'input'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {formError ? (
        <p className="field-error" role="alert">
          {formError}
        </p>
      ) : (
        <p className="field-hint">At least 6 characters. The owner is not notified automatically.</p>
      )}
    </Modal>
  );
}
