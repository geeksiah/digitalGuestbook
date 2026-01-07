'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { eventsApi, templatesApi } from '@/lib/api';
import { slugify, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  description: string | null;
}

export default function NewEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    date: '',
    time: '18:00',
    endDate: '',
    endTime: '',
    timezone: 'UTC',
    venue: '',
    invitationOnly: true,
    invitationEnabled: true,
    rsvpEnabled: true,
    guestbookEnabled: true,
    checkInEnabled: true,
    maxRecordingDuration: 120,
    minRecordingDuration: 30,
    maxPhotosPerGuest: 5,
    // Template selections
    invitationTemplateId: '',
    rsvpTemplateId: '',
    guestbookTemplateId: '',
    guestbookVideoTemplateId: '',
    guestbookAudioTemplateId: '',
    guestbookPhotoTemplateId: '',
    thankYouTemplateId: '',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await templatesApi.list();
      setTemplates(response.data.templates);
      
      // Auto-select default templates
      const defaults: any = {};
      response.data.templates.forEach((t: Template) => {
        if (t.isDefault) {
          if (t.type === 'INVITATION') defaults.invitationTemplateId = t.id;
          if (t.type === 'RSVP') defaults.rsvpTemplateId = t.id;
          if (t.type === 'GUESTBOOK') defaults.guestbookTemplateId = t.id;
          if (t.type === 'GUESTBOOK_VIDEO') defaults.guestbookVideoTemplateId = t.id;
          if (t.type === 'GUESTBOOK_AUDIO') defaults.guestbookAudioTemplateId = t.id;
          if (t.type === 'GUESTBOOK_PHOTO') defaults.guestbookPhotoTemplateId = t.id;
          if (t.type === 'THANK_YOU') defaults.thankYouTemplateId = t.id;
        }
      });
      setFormData(prev => ({ ...prev, ...defaults }));
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: slugify(name),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      const endDateTime = formData.endDate 
        ? new Date(`${formData.endDate}T${formData.endTime || '23:59'}`)
        : null;

      const response = await eventsApi.create({
        name: formData.name,
        slug: formData.slug,
        description: formData.description || undefined,
        date: dateTime.toISOString(),
        endDate: endDateTime?.toISOString(),
        timezone: formData.timezone,
        venue: formData.venue || undefined,
        invitationOnly: formData.invitationOnly,
        invitationEnabled: formData.invitationEnabled,
        rsvpEnabled: formData.rsvpEnabled,
        guestbookEnabled: formData.guestbookEnabled,
        checkInEnabled: formData.checkInEnabled,
        maxRecordingDuration: formData.maxRecordingDuration,
        minRecordingDuration: formData.minRecordingDuration,
        maxPhotosPerGuest: formData.maxPhotosPerGuest,
        invitationTemplateId: formData.invitationTemplateId || undefined,
        rsvpTemplateId: formData.rsvpTemplateId || undefined,
        guestbookTemplateId: formData.guestbookTemplateId || undefined,
        guestbookVideoTemplateId: formData.guestbookVideoTemplateId || undefined,
        guestbookAudioTemplateId: formData.guestbookAudioTemplateId || undefined,
        guestbookPhotoTemplateId: formData.guestbookPhotoTemplateId || undefined,
        thankYouTemplateId: formData.thankYouTemplateId || undefined,
      });

      toast.success('Event created successfully!');
      router.push(`/admin/events/${response.data.event.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const getTemplatesByType = (type: string) => 
    templates.filter(t => t.type === type);

  const TemplateSelect = ({ 
    type, 
    value, 
    onChange, 
    disabled,
    label 
  }: { 
    type: string; 
    value: string; 
    onChange: (id: string) => void;
    disabled?: boolean;
    label: string;
  }) => {
    const typeTemplates = getTemplatesByType(type);
    
    return (
      <div className={cn(disabled && 'opacity-50')}>
        <label className="label">{label}</label>
        <select
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select template...</option>
          {typeTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.isDefault && '(Default)'}
            </option>
          ))}
        </select>
        {typeTemplates.length === 0 && (
          <p className="text-xs text-surface-500 mt-1">
            No {type.toLowerCase()} templates available. 
            <Link href="/admin/templates/new" className="text-primary-600 ml-1">Create one</Link>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/events"
          className="inline-flex items-center text-surface-600 hover:text-navy-900 mb-4"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Events
        </Link>
        <h1 className="text-2xl font-display font-bold text-navy-900">Create New Event</h1>
        <p className="text-surface-600 mt-1">Set up a new event with all its details and templates</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="card">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="label">Event Name *</label>
              <input
                id="name"
                type="text"
                required
                className="input"
                placeholder="Sarah & Michael's Wedding"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="slug" className="label">URL Slug *</label>
              <div className="flex items-center">
                <span className="text-surface-500 mr-2">/e/</span>
                <input
                  id="slug"
                  type="text"
                  required
                  className="input"
                  placeholder="sarah-michael-wedding"
                  pattern="^[a-z0-9-]+$"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                />
              </div>
              <p className="text-sm text-surface-500 mt-1">Only lowercase letters, numbers, and hyphens</p>
            </div>

            <div>
              <label htmlFor="description" className="label">Description</label>
              <textarea
                id="description"
                rows={3}
                className="input"
                placeholder="Join us as we celebrate our special day..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Date & Location */}
        <div className="card">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Date & Location</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="label">Event Date *</label>
              <input
                id="date"
                type="date"
                required
                className="input"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="time" className="label">Start Time *</label>
              <input
                id="time"
                type="time"
                required
                className="input"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="endDate" className="label">End Date</label>
              <input
                id="endDate"
                type="date"
                className="input"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="endTime" className="label">End Time</label>
              <input
                id="endTime"
                type="time"
                className="input"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="venue" className="label">Venue</label>
              <input
                id="venue"
                type="text"
                className="input"
                placeholder="The Grand Ballroom, 123 Wedding Lane"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="timezone" className="label">Timezone</label>
              <select
                id="timezone"
                className="input"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Africa/Accra">Ghana (GMT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="card">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Services</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
              <div>
                <p className="font-medium text-navy-900">Invitation Website</p>
                <p className="text-sm text-surface-600">Public event landing page</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                checked={formData.invitationEnabled}
                onChange={(e) => setFormData({ ...formData, invitationEnabled: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
              <div>
                <p className="font-medium text-navy-900">RSVP System</p>
                <p className="text-sm text-surface-600">Collect guest responses</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                checked={formData.rsvpEnabled}
                onChange={(e) => setFormData({ ...formData, rsvpEnabled: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
              <div>
                <p className="font-medium text-navy-900">Digital Guestbook</p>
                <p className="text-sm text-surface-600">Capture video, audio & photos</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                checked={formData.guestbookEnabled}
                onChange={(e) => setFormData({ ...formData, guestbookEnabled: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
              <div>
                <p className="font-medium text-navy-900">Check-In System</p>
                <p className="text-sm text-surface-600">QR code & manual verification</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                checked={formData.checkInEnabled}
                onChange={(e) => setFormData({ ...formData, checkInEnabled: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-primary-50 rounded-lg cursor-pointer hover:bg-primary-100 border-2 border-primary-200">
              <div>
                <p className="font-medium text-navy-900">Invitation-Only Event</p>
                <p className="text-sm text-surface-600">RSVPs require approval before guests receive invitation passes</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                checked={formData.invitationOnly}
                onChange={(e) => setFormData({ ...formData, invitationOnly: e.target.checked })}
              />
            </label>
          </div>
        </div>

        {/* Template Selection */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-navy-900">Page Templates</h2>
              <p className="text-sm text-surface-600">Select custom templates for each page type</p>
            </div>
            <Link href="/admin/templates" className="text-sm text-primary-600 hover:text-primary-700">
              Manage Templates →
            </Link>
          </div>

          {loadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <TemplateSelect
                type="INVITATION"
                label="Invitation Page"
                value={formData.invitationTemplateId}
                onChange={(id) => setFormData({ ...formData, invitationTemplateId: id })}
                disabled={!formData.invitationEnabled}
              />
              
              <TemplateSelect
                type="RSVP"
                label="RSVP Form"
                value={formData.rsvpTemplateId}
                onChange={(id) => setFormData({ ...formData, rsvpTemplateId: id })}
                disabled={!formData.rsvpEnabled}
              />
              
              <TemplateSelect
                type="GUESTBOOK"
                label="Guestbook Menu"
                value={formData.guestbookTemplateId}
                onChange={(id) => setFormData({ ...formData, guestbookTemplateId: id })}
                disabled={!formData.guestbookEnabled}
              />

              <TemplateSelect
                type="GUESTBOOK_VIDEO"
                label="Video Recording"
                value={formData.guestbookVideoTemplateId}
                onChange={(id) => setFormData({ ...formData, guestbookVideoTemplateId: id })}
                disabled={!formData.guestbookEnabled}
              />

              <TemplateSelect
                type="GUESTBOOK_AUDIO"
                label="Audio Recording"
                value={formData.guestbookAudioTemplateId}
                onChange={(id) => setFormData({ ...formData, guestbookAudioTemplateId: id })}
                disabled={!formData.guestbookEnabled}
              />

              <TemplateSelect
                type="GUESTBOOK_PHOTO"
                label="Photo Upload"
                value={formData.guestbookPhotoTemplateId}
                onChange={(id) => setFormData({ ...formData, guestbookPhotoTemplateId: id })}
                disabled={!formData.guestbookEnabled}
              />
              
              <TemplateSelect
                type="THANK_YOU"
                label="Thank You Page"
                value={formData.thankYouTemplateId}
                onChange={(id) => setFormData({ ...formData, thankYouTemplateId: id })}
              />
            </div>
          )}
        </div>

        {/* Guestbook Settings */}
        {formData.guestbookEnabled && (
          <div className="card">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Guestbook Settings</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="minDuration" className="label">Min Recording (sec)</label>
                <input
                  id="minDuration"
                  type="number"
                  min="10"
                  max="60"
                  className="input"
                  value={formData.minRecordingDuration}
                  onChange={(e) => setFormData({ ...formData, minRecordingDuration: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label htmlFor="maxDuration" className="label">Max Recording (sec)</label>
                <input
                  id="maxDuration"
                  type="number"
                  min="30"
                  max="300"
                  className="input"
                  value={formData.maxRecordingDuration}
                  onChange={(e) => setFormData({ ...formData, maxRecordingDuration: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label htmlFor="maxPhotos" className="label">Max Photos/Guest</label>
                <input
                  id="maxPhotos"
                  type="number"
                  min="1"
                  max="20"
                  className="input"
                  value={formData.maxPhotosPerGuest}
                  onChange={(e) => setFormData({ ...formData, maxPhotosPerGuest: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/admin/events" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </span>
            ) : (
              'Create Event'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
