'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { templatesApi, API_BASE_URL } from '@/lib/api';
import { cn, formatCount, formatDate, getErrorMessage } from '@/lib/utils';
import {
  EmptyState,
  ListSkeleton,
  PageHeader,
  SearchField,
  StatusBadge,
  Td,
  Th,
  Toolbar,
} from '@/components/ui/Primitives';
import { ConfirmDialog, Menu, MenuItem, Modal } from '@/components/ui/Overlay';
import { Plus } from '@/components/ui/icons';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  htmlContent?: string;
  cssContent?: string;
  thumbnailPath?: string | null;
  assetsPath?: string | null;
}

const typeLabels: Record<string, string> = {
  INVITATION: 'Invitation',
  RSVP: 'RSVP / Ticket Page',
  GUESTBOOK: 'Guestbook Menu',
  GUESTBOOK_VIDEO: 'Video Recording',
  GUESTBOOK_AUDIO: 'Audio Recording',
  GUESTBOOK_PHOTO: 'Photo Upload',
  THANK_YOU: 'Thank You',
  BOOTH: 'Booth Menu',
  BOOTH_VIDEO: 'Booth Video',
  BOOTH_AUDIO: 'Booth Audio',
  BOOTH_PHOTO: 'Booth Photo',
  LIVE_LANDING: 'Live Landing Page',
  EVENT_ENDED: 'Event Ended Page',
  ITINERARY: 'Itinerary Page',
  GIFTING: 'Gifting Page',
  VOTING: 'Voting Page',
  VOTING_NOMINATION: 'Voting Nomination',
  VOTING_NOMINEES: 'Voting Nominees',
  VOTING_LEADERBOARD: 'Voting Leaderboard',
};

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'type' | 'created' | 'updated' | 'usage';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await templatesApi.list(undefined, true);
      setTemplates(response.data.templates);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not load templates.'));
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort templates
  const filteredTemplates = templates
    .filter(t => {
      if (filter !== 'all' && t.type !== filter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(query) || 
               t.description?.toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updated':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'usage':
          comparison = a.usageCount - b.usageCount;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handlePreview = async (template: Template) => {
    if (template.htmlContent) {
      setPreviewTemplate(template);
    } else {
      try {
        const response = await templatesApi.get(template.id);
        setPreviewTemplate(response.data.template);
      } catch (error) {
        toast.error(getErrorMessage(error, 'Could not load the preview.'));
      }
    }
  };

  const closePreview = () => setPreviewTemplate(null);

  const handleDuplicate = async (id: string) => {
    try {
      await templatesApi.duplicate(id);
      toast.success('Template duplicated');
      fetchTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not duplicate this template.'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await templatesApi.delete(id);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Could not delete this template.'));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTemplates.size === 0) return;


    let deleted = 0;
    for (const id of Array.from(selectedTemplates)) {
      try {
        await templatesApi.delete(id);
        deleted++;
      } catch (error) {
        // Skip templates in use
      }
    }
    
    toast.success(`Deleted ${deleted} template(s)`);
    setSelectedTemplates(new Set());
    fetchTemplates();
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedTemplates);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTemplates(newSet);
  };

  const selectAll = () => {
    if (selectedTemplates.size === filteredTemplates.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(filteredTemplates.map(t => t.id)));
    }
  };

  const getPreviewContent = (template: Template) => {
    const sampleData = {
      eventName: 'Sarah & Michael\'s Wedding',
      eventDate: 'Saturday, June 15, 2025',
      eventTime: '4:00 PM',
      venue: 'The Grand Ballroom',
      venueAddress: '123 Wedding Lane, New York, NY',
    };

    let html = template.htmlContent || '<div style="padding: 40px; text-align: center;"><h1>No content</h1></div>';
    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>* { margin: 0; padding: 0; box-sizing: border-box; }body { font-family: system-ui, -apple-system, sans-serif; }${template.cssContent || ''}</style></head><body>${html}</body></html>`;
  };

  // Stats by type
  const stats = {
    total: templates.length,
    invitation: templates.filter(t => t.type === 'INVITATION').length,
    rsvp: templates.filter(t => t.type === 'RSVP').length,
    guestbook: templates.filter(t => t.type === 'GUESTBOOK').length,
    guestbookVideo: templates.filter(t => t.type === 'GUESTBOOK_VIDEO').length,
    guestbookAudio: templates.filter(t => t.type === 'GUESTBOOK_AUDIO').length,
    guestbookPhoto: templates.filter(t => t.type === 'GUESTBOOK_PHOTO').length,
    thankYou: templates.filter(t => t.type === 'THANK_YOU').length,
    itinerary: templates.filter(t => t.type === 'ITINERARY').length,
    gifting: templates.filter(t => t.type === 'GIFTING').length,
    votingVote: templates.filter(t => t.type === 'VOTING').length,
    votingNomination: templates.filter(t => t.type === 'VOTING_NOMINATION').length,
    votingNominees: templates.filter(t => t.type === 'VOTING_NOMINEES').length,
    votingLeaderboard: templates.filter(t => t.type === 'VOTING_LEADERBOARD').length,
  };

  const typeCounts = Object.entries(typeLabels).map(([type, label]) => ({
    type,
    label,
    count: templates.filter((template) => template.type === type).length,
  }));

  return (
    <div className="page">
      <PageHeader
        title="Templates"
        meta={<span className="num">{formatCount(stats.total)} in the library</span>}
        actions={
          <Link href="/admin/templates/new" className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            New template
          </Link>
        }
        mobileActions={
          <Link href="/admin/templates/new" className="icon-btn" aria-label="New template">
            <Plus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </Link>
        }
      />

      <Toolbar
        end={
          <>
            <label className="sr-only" htmlFor="template-type">
              Type
            </label>
            <select
              id="template-type"
              className="input input-sm w-full sm:w-48"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All types ({stats.total})</option>
              {typeCounts.map(({ type, label, count }) => (
                <option key={type} value={type}>
                  {label} ({count})
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="template-sort">
              Sort
            </label>
            <select
              id="template-sort"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as SortBy);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="input input-sm w-full sm:w-44"
            >
              <option value="updated-desc">Recently updated</option>
              <option value="created-desc">Newest</option>
              <option value="created-asc">Oldest</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="usage-desc">Most used</option>
              <option value="type-asc">By type</option>
            </select>

            <div className="segmented shrink-0" role="radiogroup" aria-label="View">
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                className={cn('segmented-item px-2.5', viewMode === 'grid' && 'segmented-item-active')}
                title="Grid view"
              >
                <span className="sr-only">Grid view</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                className={cn('segmented-item px-2.5', viewMode === 'list' && 'segmented-item-active')}
                title="List view"
              >
                <span className="sr-only">List view</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </>
        }
      >
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search templates"
          className="w-full sm:w-72"
        />
      </Toolbar>

      {selectedTemplates.size > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-surface-300 bg-white px-4 py-2.5">
          <span className="num text-sm font-semibold text-brand-900">{selectedTemplates.size} selected</span>
          <button type="button" onClick={() => setSelectedTemplates(new Set())} className="btn-ghost btn-sm">
            Clear
          </button>
          <div className="flex-1" />
          <button type="button" onClick={() => setShowBulkDelete(true)} className="btn-danger-outline btn-sm">
            Delete
          </button>
        </div>
      ) : null}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          title={searchQuery || filter !== 'all' ? 'No matching templates' : 'No templates yet'}
          action={
            searchQuery || filter !== 'all' ? (
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilter('all');
                }}
              >
                Clear filters
              </button>
            ) : (
              <Link href="/admin/templates/new" className="btn-primary btn-sm">
                Create template
              </Link>
            )
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTemplates.map((template) => (
            <article
              key={template.id}
              className={cn(
                'overflow-hidden rounded-xl border bg-white transition-colors',
                selectedTemplates.has(template.id) ? 'border-brand-700 ring-1 ring-brand-700/30' : 'border-surface-200'
              )}
            >
              <div className="relative h-36 overflow-hidden bg-surface-200">
                <button
                  type="button"
                  className="group absolute inset-0 h-full w-full"
                  onClick={() => handlePreview(template)}
                  aria-label={`Preview ${template.name}`}
                >
                  <TemplateThumb template={template} getPreviewContent={getPreviewContent} />
                  <span className="absolute inset-0 flex items-center justify-center bg-navy-900/0 text-sm font-semibold text-white opacity-0 transition-all group-hover:bg-navy-900/55 group-hover:opacity-100">
                    Preview
                  </span>
                </button>

                <span className="pointer-events-none absolute left-2 top-2">
                  <StatusBadge tone="neutral">{typeLabels[template.type]}</StatusBadge>
                </span>

                <label className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/90">
                  <span className="sr-only">Select {template.name}</span>
                  <input
                    type="checkbox"
                    checked={selectedTemplates.has(template.id)}
                    onChange={() => toggleSelect(template.id)}
                  />
                </label>

                {template.isDefault ? (
                  <span className="pointer-events-none absolute bottom-2 right-2">
                    <StatusBadge tone="success">Default</StatusBadge>
                  </span>
                ) : null}
              </div>

              <div className="p-3">
                <h3 className="truncate text-[15px] font-semibold text-brand-900">{template.name}</h3>
                <p className="mt-0.5 meta num">
                  {formatCount(template.usageCount)} {template.usageCount === 1 ? 'event' : 'events'} · updated{' '}
                  {formatDate(template.updatedAt, 'MMM d')}
                </p>

                <div className="mt-3 flex items-center gap-1">
                  <Link href={`/admin/templates/${template.id}`} className="btn-outline btn-sm flex-1 justify-center">
                    Edit
                  </Link>
                  <Menu label={`Actions for ${template.name}`} sheetTitle={template.name}>
                    <MenuItem onClick={() => handlePreview(template)}>Preview</MenuItem>
                    <MenuItem onClick={() => handleDuplicate(template.id)}>Duplicate</MenuItem>
                    {template.usageCount === 0 ? (
                      <MenuItem danger onClick={() => setDeletingTemplate(template)}>
                        Delete
                      </MenuItem>
                    ) : null}
                  </Menu>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-200 bg-white">
          <div className="overflow-x-auto">
            <table className="data-table" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <Th className="w-10">
                    <span className="sr-only">Select</span>
                    <input
                      type="checkbox"
                      aria-label="Select all templates"
                      checked={selectedTemplates.size === filteredTemplates.length && filteredTemplates.length > 0}
                      onChange={selectAll}
                    />
                  </Th>
                  <Th>Template</Th>
                  <Th>Type</Th>
                  <Th align="right">Usage</Th>
                  <Th>Updated</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((template) => (
                  <tr key={template.id} className="table-row">
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${template.name}`}
                        checked={selectedTemplates.has(template.id)}
                        onChange={() => toggleSelect(template.id)}
                      />
                    </Td>
                    <Td>
                      <p className="font-medium text-brand-900">{template.name}</p>
                      {template.description ? <p className="meta max-w-xs truncate">{template.description}</p> : null}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone="neutral">{typeLabels[template.type]}</StatusBadge>
                        {template.isDefault ? <StatusBadge tone="success">Default</StatusBadge> : null}
                      </div>
                    </Td>
                    <Td align="right" className="num">
                      {formatCount(template.usageCount)}
                    </Td>
                    <Td>{formatDate(template.updatedAt, 'MMM d, yyyy')}</Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/templates/${template.id}`} className="btn-outline btn-sm">
                          Edit
                        </Link>
                        <Menu label={`Actions for ${template.name}`} sheetTitle={template.name}>
                          <MenuItem onClick={() => handlePreview(template)}>Preview</MenuItem>
                          <MenuItem onClick={() => handleDuplicate(template.id)}>Duplicate</MenuItem>
                          {template.usageCount === 0 ? (
                            <MenuItem danger onClick={() => setDeletingTemplate(template)}>
                              Delete
                            </MenuItem>
                          ) : null}
                        </Menu>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(previewTemplate)}
        onClose={closePreview}
        title={previewTemplate?.name || 'Preview'}
        description={previewTemplate ? `${typeLabels[previewTemplate.type]} · sample data` : undefined}
        size="full"
        bodyClassName="p-0 bg-surface-100"
        footer={
          previewTemplate ? (
            <Link href={`/admin/templates/${previewTemplate.id}`} className="btn-primary">
              Edit template
            </Link>
          ) : null
        }
      >
        {previewTemplate ? (
          <iframe
            ref={iframeRef}
            srcDoc={getPreviewContent(previewTemplate)}
            className="h-[70vh] w-full border-0 bg-white"
            sandbox="allow-same-origin allow-scripts"
            title={previewTemplate.name}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingTemplate)}
        onClose={() => setDeletingTemplate(null)}
        onConfirm={() => {
          if (deletingTemplate) void handleDelete(deletingTemplate.id);
          setDeletingTemplate(null);
        }}
        title={`Delete "${deletingTemplate?.name || ''}"?`}
        body="This template is not used by any event, so nothing goes offline."
        confirmLabel="Delete template"
      />

      <ConfirmDialog
        open={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={() => {
          setShowBulkDelete(false);
          void handleBulkDelete();
        }}
        title={`Delete ${selectedTemplates.size} ${selectedTemplates.size === 1 ? 'template' : 'templates'}?`}
        body="Templates still in use by an event are skipped."
        confirmLabel="Delete"
      />
    </div>
  );
}

/** Thumbnail with a live template render as the fallback. */
function TemplateThumb({
  template,
  getPreviewContent,
}: {
  template: Template;
  getPreviewContent: (template: Template) => string;
}) {
  const [failed, setFailed] = useState(false);
  const thumbnail = template.thumbnailPath
    ? template.thumbnailPath.startsWith('http://') || template.thumbnailPath.startsWith('https://')
      ? template.thumbnailPath
      : `${API_BASE_URL}${template.thumbnailPath.startsWith('/') ? '' : '/'}${template.thumbnailPath}`
    : null;

  if (thumbnail && !failed) {
    return (
      <img
        src={thumbnail}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <span className="absolute inset-0 block overflow-hidden bg-surface-200">
      <span className="block h-[400%] w-[400%] origin-top-left" style={{ transform: 'scale(0.25)' }}>
        <iframe
          srcDoc={getPreviewContent(template)}
          className="h-full w-full border-0"
          sandbox="allow-same-origin allow-scripts"
          title=""
          tabIndex={-1}
          aria-hidden="true"
        />
      </span>
    </span>
  );
}
