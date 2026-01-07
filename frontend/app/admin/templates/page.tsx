'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { templatesApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isDefault: boolean;
  createdAt: string;
  usageCount: number;
  htmlContent?: string;
  cssContent?: string;
}

const typeLabels: Record<string, string> = {
  INVITATION: 'Invitation',
  RSVP: 'RSVP Form',
  GUESTBOOK: 'Guestbook',
  THANK_YOU: 'Thank You',
};

const typeColors: Record<string, string> = {
  INVITATION: 'bg-blue-100 text-blue-700',
  RSVP: 'bg-green-100 text-green-700',
  GUESTBOOK: 'bg-purple-100 text-purple-700',
  THANK_YOU: 'bg-orange-100 text-orange-700',
};

const typeIcons: Record<string, JSX.Element> = {
  INVITATION: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  RSVP: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  GUESTBOOK: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  THANK_YOU: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, [filter]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const typeParam = filter !== 'all' ? filter : undefined;
      // Include content for thumbnail previews
      const response = await templatesApi.list(typeParam, true);
      setTemplates(response.data.templates);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (template: Template) => {
    try {
      // Fetch full template with content
      const response = await templatesApi.get(template.id);
      setPreviewTemplate(response.data.template);
    } catch (error) {
      toast.error('Failed to load template preview');
    }
  };

  const closePreview = () => {
    setPreviewTemplate(null);
  };

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

  // Generate preview content for iframe
  const getPreviewContent = (template: Template) => {
    const sampleData = {
      eventName: 'Sarah & Michael\'s Wedding',
      eventDate: 'Saturday, June 15, 2025',
      eventTime: '4:00 PM',
      venue: 'The Grand Ballroom',
      venueAddress: '123 Wedding Lane, New York, NY',
      coupleNames: 'Sarah & Michael',
      rsvpUrl: '#',
      guestbookUrl: '#',
    };

    let html = template.htmlContent || '<div style="padding: 40px; text-align: center;"><h1>No content</h1></div>';
    
    // Replace template variables
    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; }
          ${template.cssContent || ''}
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;
  };

  // Generate thumbnail preview (simplified version)
  const getThumbnailContent = (template: Template) => {
    return getPreviewContent(template);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy-900">Templates</h1>
          <p className="text-surface-600 mt-1">Manage your page templates</p>
        </div>
        <Link href="/admin/templates/new" className="btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['all', 'INVITATION', 'RSVP', 'GUESTBOOK', 'THANK_YOU'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === type
                ? 'bg-navy-900 text-white'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            )}
          >
            {type === 'all' ? 'All Types' : typeLabels[type]}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : templates.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 mx-auto text-surface-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <h3 className="text-lg font-medium text-navy-900 mb-1">No templates found</h3>
          <p className="text-surface-600 mb-4">Create your first template to get started</p>
          <Link href="/admin/templates/new" className="btn-primary">Create Template</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="card hover:shadow-lg transition-shadow overflow-hidden">
              {/* Thumbnail Preview */}
              <div 
                className="relative h-40 bg-surface-100 border-b border-surface-200 overflow-hidden cursor-pointer group"
                onClick={() => handlePreview(template)}
              >
                {/* Scaled down preview */}
                <div className="absolute inset-0 overflow-hidden">
                  <div 
                    className="w-[400%] h-[400%] origin-top-left scale-25 pointer-events-none"
                    style={{ transform: 'scale(0.25)' }}
                  >
                    <iframe
                      srcDoc={getThumbnailContent(template)}
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin"
                      title={`Preview of ${template.name}`}
                    />
                  </div>
                </div>
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/60 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-medium flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Preview
                  </span>
                </div>

                {/* Type icon overlay */}
                <div className="absolute top-2 left-2 p-2 rounded-lg bg-white/90 text-surface-600">
                  {typeIcons[template.type]}
                </div>
              </div>

              {/* Template Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className={cn('badge text-xs', typeColors[template.type])}>
                    {typeLabels[template.type]}
                  </span>
                  {template.isDefault && (
                    <span className="badge-success text-xs">Default</span>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-navy-900 mb-1 truncate">
                  {template.name}
                </h3>
                
                {template.description && (
                  <p className="text-sm text-surface-600 mb-3 line-clamp-2">
                    {template.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between text-xs text-surface-500 mb-4">
                  <span>Used by {template.usageCount} event(s)</span>
                  <span>{formatDate(template.createdAt, 'MMM d, yyyy')}</span>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-surface-100">
                  <button
                    onClick={() => handlePreview(template)}
                    className="btn-outline flex-1 text-sm py-2"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Preview
                  </button>
                  <Link
                    href={`/admin/templates/${template.id}`}
                    className="btn-ghost text-sm py-2 px-3"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDuplicate(template.id)}
                    className="btn-ghost text-sm py-2 px-3"
                    title="Duplicate"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {template.usageCount === 0 && (
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="btn-ghost text-red-600 hover:bg-red-50 text-sm py-2 px-3"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={closePreview}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
              <div>
                <h2 className="text-lg font-semibold text-navy-900">{previewTemplate.name}</h2>
                <p className="text-sm text-surface-500">
                  {typeLabels[previewTemplate.type]} Template Preview
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/templates/${previewTemplate.id}`}
                  className="btn-outline"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </Link>
                <button
                  onClick={closePreview}
                  className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-navy-900 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Preview Frame */}
            <div className="flex-1 overflow-hidden bg-surface-100 p-4">
              <div className="w-full h-full bg-white rounded-lg shadow-inner overflow-hidden">
                <iframe
                  ref={iframeRef}
                  srcDoc={getPreviewContent(previewTemplate)}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin allow-scripts"
                  title={`Full preview of ${previewTemplate.name}`}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-surface-200 bg-surface-50">
              <p className="text-sm text-surface-500 text-center">
                Preview shown with sample data. Actual content will be injected from event settings.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
