'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { templatesApi, API_BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';

type UploadMode = 'zip' | 'manual';

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
  LIVE_LANDING: 'Live Landing Page',      // ⭐ NEW
  EVENT_ENDED: 'Event Ended Page',        // ⭐ NEW
};

export default function NewTemplatePage() {
  const router = useRouter();
  const [uploadMode, setUploadMode] = useState<UploadMode>('zip');
  const [loading, setLoading] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'INVITATION',
    htmlContent: '',
    cssContent: '',
    jsContent: '',
    isDefault: false,
  });

  const handleZipUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!zipFile) {
      toast.error('Please select a ZIP file');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('template', zipFile);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('type', formData.type);
      formDataToSend.append('isDefault', String(formData.isDefault));

      const token = localStorage.getItem('admin_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/templates/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload template');
      }

      const result = await response.json();
      toast.success('Template uploaded successfully!');
      router.push('/admin/templates');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload template');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.htmlContent.trim()) {
      toast.error('Name and HTML content are required');
      return;
    }

    setLoading(true);

    try {
      await templatesApi.create(formData);
      toast.success('Template created successfully!');
      router.push('/admin/templates');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Create New Template</h1>
          <p className="text-surface-500 mt-1">Add a new template to your library</p>
        </div>
        <button
          onClick={() => router.back()}
          className="btn-outline"
        >
          Cancel
        </button>
      </div>

      {/* Upload Mode Selector */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <label className="block text-sm font-medium text-surface-700 mb-3">Upload Method</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setUploadMode('zip')}
            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
              uploadMode === 'zip'
                ? 'border-navy-900 bg-navy-50 text-navy-900'
                : 'border-surface-200 hover:border-surface-300'
            }`}
          >
            <svg className="w-5 h-5 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="font-medium">Upload ZIP</span>
            <p className="text-xs text-surface-500 mt-1">Extract from ZIP file</p>
          </button>
          <button
            type="button"
            onClick={() => setUploadMode('manual')}
            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
              uploadMode === 'manual'
                ? 'border-navy-900 bg-navy-50 text-navy-900'
                : 'border-surface-200 hover:border-surface-300'
            }`}
          >
            <svg className="w-5 h-5 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="font-medium">Manual Entry</span>
            <p className="text-xs text-surface-500 mt-1">Enter HTML/CSS/JS directly</p>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-surface-200 p-6">
        {uploadMode === 'zip' ? (
          <form onSubmit={handleZipUpload} className="space-y-6">
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

            {/* ZIP Upload */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Template ZIP File *
              </label>
              <div className="mt-2">
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-surface-300 rounded-lg cursor-pointer hover:bg-surface-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {zipFile ? (
                      <>
                        <svg className="w-10 h-10 text-green-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium text-navy-900">{zipFile.name}</p>
                        <p className="text-xs text-surface-500 mt-1">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <svg className="w-10 h-10 text-surface-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="mb-2 text-sm text-surface-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-surface-400">ZIP file (MAX. 50MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 50 * 1024 * 1024) {
                          toast.error('File size must be less than 50MB');
                          return;
                        }
                        setZipFile(file);
                      }
                    }}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-surface-500">
                ZIP should contain: <code className="bg-surface-100 px-1 py-0.5 rounded">index.html</code>, 
                <code className="bg-surface-100 px-1 py-0.5 rounded ml-1">styles.css</code> (optional), 
                <code className="bg-surface-100 px-1 py-0.5 rounded ml-1">script.js</code> (optional), 
                and <code className="bg-surface-100 px-1 py-0.5 rounded ml-1">thumbnail.png</code> (optional)
              </p>
            </div>

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
                disabled={loading || !zipFile || !formData.name.trim()}
                className="flex-1 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Uploading...' : 'Upload Template'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-6">
            {/* Same basic info fields */}
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
                rows={10}
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefaultManual"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 rounded border-surface-300 text-navy-900"
              />
              <label htmlFor="isDefaultManual" className="text-sm text-surface-700">
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
                disabled={loading || !formData.name.trim() || !formData.htmlContent.trim()}
                className="flex-1 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

