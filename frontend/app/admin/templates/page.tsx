'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { templatesApi, API_BASE_URL } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
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
  RSVP: 'RSVP Form',
  GUESTBOOK: 'Guestbook Menu',
  GUESTBOOK_VIDEO: 'Video Recording',
  GUESTBOOK_AUDIO: 'Audio Recording',
  GUESTBOOK_PHOTO: 'Photo Upload',
  THANK_YOU: 'Thank You',
};

const typeColors: Record<string, string> = {
  INVITATION: 'bg-blue-100 text-blue-700 border-blue-200',
  RSVP: 'bg-green-100 text-green-700 border-green-200',
  GUESTBOOK: 'bg-purple-100 text-purple-700 border-purple-200',
  GUESTBOOK_VIDEO: 'bg-red-100 text-red-700 border-red-200',
  GUESTBOOK_AUDIO: 'bg-amber-100 text-amber-700 border-amber-200',
  GUESTBOOK_PHOTO: 'bg-teal-100 text-teal-700 border-teal-200',
  THANK_YOU: 'bg-orange-100 text-orange-700 border-orange-200',
};

const typeIconColors: Record<string, string> = {
  INVITATION: 'bg-blue-500',
  RSVP: 'bg-green-500',
  GUESTBOOK: 'bg-purple-500',
  GUESTBOOK_VIDEO: 'bg-red-500',
  GUESTBOOK_AUDIO: 'bg-amber-500',
  GUESTBOOK_PHOTO: 'bg-teal-500',
  THANK_YOU: 'bg-orange-500',
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
      toast.error('Failed to load templates');
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
        toast.error('Failed to load template preview');
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
      toast.error('Failed to duplicate template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await templatesApi.delete(id);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete template');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTemplates.size === 0) return;
    if (!confirm(`Delete ${selectedTemplates.size} template(s)?`)) return;
    
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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy-900">Template Library</h1>
          <p className="text-surface-600 mt-1">{stats.total} templates in your library</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/templates/new" className="btn-primary">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Template
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'p-3 rounded-xl border-2 transition-all text-left',
            filter === 'all' ? 'border-primary-500 bg-primary-50' : 'border-surface-200 hover:border-surface-300'
          )}
        >
          <p className="text-xl font-bold text-navy-900">{stats.total}</p>
          <p className="text-xs text-surface-600">All</p>
        </button>
        {[
          { type: 'INVITATION', count: stats.invitation },
          { type: 'RSVP', count: stats.rsvp },
          { type: 'GUESTBOOK', count: stats.guestbook },
          { type: 'GUESTBOOK_VIDEO', count: stats.guestbookVideo },
          { type: 'GUESTBOOK_AUDIO', count: stats.guestbookAudio },
          { type: 'GUESTBOOK_PHOTO', count: stats.guestbookPhoto },
          { type: 'THANK_YOU', count: stats.thankYou },
        ].map(({ type, count }) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={cn(
              'p-3 rounded-xl border-2 transition-all text-left',
              filter === type ? 'border-primary-500 bg-primary-50' : 'border-surface-200 hover:border-surface-300'
            )}
          >
            <p className="text-xl font-bold text-navy-900">{count}</p>
            <p className="text-xs text-surface-600 truncate">{typeLabels[type]}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-xl border border-surface-200">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Sort */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as SortBy);
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="updated-desc">Recently Updated</option>
            <option value="created-desc">Newest First</option>
            <option value="created-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="usage-desc">Most Used</option>
            <option value="type-asc">By Type</option>
          </select>

          {/* View Toggle */}
          <div className="flex bg-surface-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-surface-200'
              )}
              title="Grid view"
            >
              <svg className="w-5 h-5 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-surface-200'
              )}
              title="List view"
            >
              <svg className="w-5 h-5 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedTemplates.size > 0 && (
        <div className="flex items-center gap-4 bg-navy-900 text-white p-4 rounded-xl">
          <span className="font-medium">{selectedTemplates.size} selected</span>
          <button onClick={() => setSelectedTemplates(new Set())} className="text-surface-300 hover:text-white">
            Clear
          </button>
          <div className="flex-1" />
          <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium">
            Delete Selected
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 mx-auto text-surface-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <h3 className="text-lg font-medium text-navy-900 mb-1">
            {searchQuery ? 'No templates found' : 'No templates yet'}
          </h3>
          <p className="text-surface-600 mb-4">
            {searchQuery ? 'Try adjusting your search' : 'Create your first template to get started'}
          </p>
          {!searchQuery && (
            <Link href="/admin/templates/new" className="btn-primary">Create Template</Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => (
            <div 
              key={template.id} 
              className={cn(
                'bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg',
                selectedTemplates.has(template.id) ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-surface-200'
              )}
            >
              {/* Thumbnail */}
              <div 
                className="relative h-36 bg-surface-100 overflow-hidden cursor-pointer group"
                onClick={() => handlePreview(template)}
              >
                {template.thumbnailPath ? (
                  <>
                    <img 
                      src={`${API_BASE_URL}/${template.thumbnailPath}`}
                      alt={template.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to preview if thumbnail fails
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.preview-fallback') as HTMLElement;
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                    <div className="preview-fallback hidden absolute inset-0 overflow-hidden">
                      <div className="w-[400%] h-[400%] origin-top-left" style={{ transform: 'scale(0.25)' }}>
                        <iframe srcDoc={getPreviewContent(template)} className="w-full h-full border-0" sandbox="allow-same-origin" title={template.name} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="w-[400%] h-[400%] origin-top-left" style={{ transform: 'scale(0.25)' }}>
                      <iframe srcDoc={getPreviewContent(template)} className="w-full h-full border-0" sandbox="allow-same-origin" title={template.name} />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/60 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-medium">Preview</span>
                </div>
                
                {/* Type Badge */}
                <div className={cn('absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium', typeColors[template.type])}>
                  {typeLabels[template.type]}
                </div>
                
                {/* Selection Checkbox */}
                <div className="absolute top-2 right-2">
                  <input
                    type="checkbox"
                    checked={selectedTemplates.has(template.id)}
                    onChange={() => toggleSelect(template.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 rounded border-2 border-white bg-white/80 text-primary-500 focus:ring-primary-500"
                  />
                </div>
                
                {template.isDefault && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                    Default
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-navy-900 truncate mb-1">{template.name}</h3>
                <p className="text-xs text-surface-500 mb-3">
                  {template.usageCount} event{template.usageCount !== 1 ? 's' : ''} • Updated {formatDate(template.updatedAt, 'MMM d')}
                </p>
                
                <div className="flex gap-2">
                  <button onClick={() => handlePreview(template)} className="btn-ghost flex-1 text-sm py-1.5">Preview</button>
                  <Link href={`/admin/templates/${template.id}`} className="btn-ghost text-sm py-1.5 px-3">Edit</Link>
                  <button onClick={() => handleDuplicate(template.id)} className="btn-ghost text-sm py-1.5 px-2" title="Duplicate">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="w-10 p-4">
                  <input
                    type="checkbox"
                    checked={selectedTemplates.size === filteredTemplates.length && filteredTemplates.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 rounded border-surface-300 text-primary-500"
                  />
                </th>
                <th className="text-left p-4 text-sm font-medium text-surface-600">Template</th>
                <th className="text-left p-4 text-sm font-medium text-surface-600">Type</th>
                <th className="text-left p-4 text-sm font-medium text-surface-600">Usage</th>
                <th className="text-left p-4 text-sm font-medium text-surface-600">Updated</th>
                <th className="text-right p-4 text-sm font-medium text-surface-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((template) => (
                <tr key={template.id} className="border-b border-surface-100 hover:bg-surface-50">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedTemplates.has(template.id)}
                      onChange={() => toggleSelect(template.id)}
                      className="w-4 h-4 rounded border-surface-300 text-primary-500"
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white', typeIconColors[template.type])}>
                        <span className="text-lg">{template.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-navy-900">{template.name}</p>
                        {template.description && (
                          <p className="text-sm text-surface-500 truncate max-w-xs">{template.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={cn('px-2 py-1 rounded-md text-xs font-medium', typeColors[template.type])}>
                      {typeLabels[template.type]}
                    </span>
                    {template.isDefault && (
                      <span className="ml-2 px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-surface-600">{template.usageCount} event{template.usageCount !== 1 ? 's' : ''}</td>
                  <td className="p-4 text-surface-600">{formatDate(template.updatedAt, 'MMM d, yyyy')}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handlePreview(template)} className="btn-ghost text-sm py-1.5 px-3">Preview</button>
                      <Link href={`/admin/templates/${template.id}`} className="btn-ghost text-sm py-1.5 px-3">Edit</Link>
                      <button onClick={() => handleDuplicate(template.id)} className="btn-ghost text-sm py-1.5 px-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {template.usageCount === 0 && (
                        <button onClick={() => handleDelete(template.id)} className="btn-ghost text-red-600 hover:bg-red-50 text-sm py-1.5 px-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={closePreview}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-3 border-b border-surface-200 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-navy-900">{previewTemplate.name}</h2>
                <p className="text-sm text-surface-500">{typeLabels[previewTemplate.type]} Template</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/templates/${previewTemplate.id}`} className="btn-outline">Edit</Link>
                <button onClick={closePreview} className="p-2 rounded-lg hover:bg-surface-100 text-surface-500">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-surface-100 p-4 overflow-hidden">
              <div className="w-full h-full bg-white rounded-lg shadow-inner overflow-hidden">
                <iframe ref={iframeRef} srcDoc={getPreviewContent(previewTemplate)} className="w-full h-full border-0" sandbox="allow-same-origin allow-scripts" title={previewTemplate.name} />
              </div>
            </div>
            <div className="px-6 py-2 border-t border-surface-200 bg-surface-50 flex-shrink-0">
              <p className="text-sm text-surface-500 text-center">Preview with sample data</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
