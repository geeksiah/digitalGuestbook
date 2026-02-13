'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { templatesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  description: string | null;
  type: string;
  htmlContent: string;
  cssContent: string | null;
  jsContent: string | null;
  assetsPath: string | null;
  thumbnailPath: string | null;
  isDefault: boolean;
}

interface TemplateFile {
  name: string;
  type: string;
  size?: number;
  editable: boolean;
}

const typeLabels: Record<string, string> = {
  INVITATION: 'Invitation',
  RSVP: 'RSVP Form',
  GUESTBOOK: 'Guestbook Menu',
  GUESTBOOK_VIDEO: 'Video Recording',
  GUESTBOOK_AUDIO: 'Audio Recording',
  GUESTBOOK_PHOTO: 'Photo Upload',
  BOOTH: 'Booth Menu',
  BOOTH_VIDEO: 'Booth Video',
  BOOTH_AUDIO: 'Booth Audio',
  BOOTH_PHOTO: 'Booth Photo',
  THANK_YOU: 'Thank You',
  LIVE_LANDING: 'Live Landing Page',
  EVENT_ENDED: 'Event Ended Page',
  ITINERARY: 'Itinerary Page',
  GIFTING: 'Gifting Page',
};

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [templateFiles, setTemplateFiles] = useState<TemplateFile[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'INVITATION',
    htmlContent: '',
    cssContent: '',
    jsContent: '',
    isDefault: false,
  });

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    }
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const response = await templatesApi.get(templateId);
      const t = response.data.template;
      setTemplate(t);
      setFormData({
        name: t.name,
        description: t.description || '',
        type: t.type,
        htmlContent: t.htmlContent,
        cssContent: t.cssContent || '',
        jsContent: t.jsContent || '',
        isDefault: t.isDefault,
      });

      // Fetch template files if assetsPath exists
      if (t.assetsPath) {
        await fetchTemplateFiles(templateId);
      }
    } catch (error) {
      toast.error('Failed to load template');
      router.push('/admin/templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateFiles = async (templateId: string) => {
    try {
      const response = await templatesApi.getFiles(templateId);
      setTemplateFiles(response.data.files || []);
    } catch (error) {
      console.error('Failed to load template files:', error);
      setTemplateFiles([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.htmlContent.trim()) {
      toast.error('Name and HTML content are required');
      return;
    }

    setSaving(true);

    try {
      await templatesApi.update(templateId, formData);
      toast.success('Template updated successfully!');
      router.push('/admin/templates');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) return;

    try {
      await templatesApi.delete(templateId);
      toast.success('Template deleted');
      router.push('/admin/templates');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete template');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  // Filter only asset files (not the main template files)
  const assetFiles = templateFiles.filter(f => f.name.startsWith('assets/'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Edit Template</h1>
          <p className="text-surface-500 mt-1">Update template details and content</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => router.back()}
            className="btn-outline"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                placeholder="Elegant Wedding Invitation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Template Type *
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
              placeholder="A brief description of this template..."
            />
          </div>

          {/* HTML Content */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              HTML Content *
            </label>
            <textarea
              required
              value={formData.htmlContent}
              onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
              rows={12}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
              placeholder="<div>Your HTML here...</div>"
            />
          </div>

          {/* CSS Content */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              CSS Content
            </label>
            <textarea
              value={formData.cssContent}
              onChange={(e) => setFormData({ ...formData, cssContent: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
              placeholder="/* Your CSS here... */"
            />
          </div>

          {/* JS Content */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              JavaScript Content
            </label>
            <textarea
              value={formData.jsContent}
              onChange={(e) => setFormData({ ...formData, jsContent: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
              placeholder="// Your JavaScript here..."
            />
          </div>

          {/* Assets */}
          {template?.assetsPath && assetFiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Template Assets
              </label>
              <div className="border border-surface-200 rounded-lg p-4 bg-surface-50">
                <p className="text-sm text-surface-600 mb-3">
                  The following asset files are included in this template:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {assetFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-surface-700">
                      <span className="w-2 h-2 bg-navy-500 rounded-full flex-shrink-0"></span>
                      <span className="font-mono truncate" title={file.name}>
                        {file.name.replace('assets/', '')}
                      </span>
                      {file.size && (
                        <span className="text-xs text-surface-500 ml-auto">
                          {(file.size / 1024).toFixed(1)}KB
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-surface-500 mt-3">
                  Assets path: {template.assetsPath}
                </p>
                <p className="text-xs text-surface-400 mt-1">
                  Note: Assets cannot be edited here. To update assets, upload a new template ZIP.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-4 h-4 rounded border-surface-300 text-navy-900"
            />
            <label htmlFor="isDefault" className="text-sm text-surface-700">
              Set as default template for this type
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-surface-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 border border-surface-200 rounded-lg text-surface-700 hover:bg-surface-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name.trim() || !formData.htmlContent.trim()}
              className="flex-1 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
