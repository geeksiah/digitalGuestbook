'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { eventsApi, templatesApi, ownersApi, API_BASE_URL } from '@/lib/api';
import { slugify, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  description: string | null;
}

interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  isActive: boolean;
}

export default function NewEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [ownerMode, setOwnerMode] = useState<'select' | 'create'>('select');
  const [showCreateOwner, setShowCreateOwner] = useState(false);
  const [newOwnerData, setNewOwnerData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });
  const [creatingOwner, setCreatingOwner] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [defaultFeeSettings, setDefaultFeeSettings] = useState({
    platformFeeMode: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    platformFeePercent: 5,
    platformFeeFixed: 0,
    processingFeePercent: 2.9,
    processingFeeFixed: 0.3,
  });
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    socialTitle: '',
    socialDescription: '',
    coverImageAlt: '',
    date: '',
    time: '18:00',
    endDate: '',
    endTime: '',
    timezone: 'UTC',
    defaultCurrency: 'USD',
    venue: '',
    ownerId: '',
    invitationOnly: true,
    invitationEnabled: true,
    rsvpEnabled: true,
    guestbookEnabled: true,
    checkInEnabled: true,
    maxRecordingDuration: 120,
    minRecordingDuration: 30,
    maxPhotosPerGuest: 5,
    strictInviteOnly: false,
    itineraryEnabled: false,
    giftingEnabled: false,
    votingEnabled: false,
    rsvpMode: 'free' as 'free' | 'paid',
    ticketingEnabled: false,
    feeOverridesEnabled: false,
    platformFeeMode: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    platformFeePercent: 5,
    platformFeeFixed: 0,
    processingFeePercent: 2.9,
    processingFeeFixed: 0.3,
    // Template selections
    invitationTemplateId: '',
    rsvpTemplateId: '',
    guestbookTemplateId: '',
    guestbookVideoTemplateId: '',
    guestbookAudioTemplateId: '',
    guestbookPhotoTemplateId: '',
    thankYouTemplateId: '',
    liveLandingTemplateId: '',
    eventEndedTemplateId: '',
    itineraryPageTemplateId: '',
    giftingPageTemplateId: '',
    votingPageTemplateId: '',
    nominationPageTemplateId: '',
    nomineesPageTemplateId: '',
    leaderboardPageTemplateId: '',
  });

  useEffect(() => {
    fetchTemplates();
    fetchOwners();
    fetchDefaultFeeSettings();
  }, []);

  const fetchDefaultFeeSettings = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const response = await fetch(`${API_BASE_URL}/api/settings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) return;
      const payload = await response.json();
      const settings = payload?.settings || {};
      const defaults: {
        platformFeeMode: 'PERCENTAGE' | 'FIXED';
        platformFeePercent: number;
        platformFeeFixed: number;
        processingFeePercent: number;
        processingFeeFixed: number;
      } = {
        platformFeeMode: settings.platformFeeMode === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
        platformFeePercent: Number(settings.platformFeePercent ?? 5),
        platformFeeFixed: Number(settings.platformFeeFixed ?? 0),
        processingFeePercent: Number(settings.processingFeePercent ?? 2.9),
        processingFeeFixed: Number(settings.processingFeeFixed ?? 0.3),
      };
      setDefaultFeeSettings(defaults);
      setFormData((prev) => ({
        ...prev,
        platformFeeMode: defaults.platformFeeMode,
        platformFeePercent: defaults.platformFeePercent,
        platformFeeFixed: defaults.platformFeeFixed,
        processingFeePercent: defaults.processingFeePercent,
        processingFeeFixed: defaults.processingFeeFixed,
      }));
    } catch (error) {
      console.error('Failed to load default fee settings:', error);
    }
  };

  const fetchOwners = async () => {
    try {
      setLoadingOwners(true);
      const response = await ownersApi.list({ isActive: true });
      setOwners(response.data.owners);
    } catch (error) {
      toast.error('Failed to load owners');
    } finally {
      setLoadingOwners(false);
    }
  };

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
          if (t.type === 'LIVE_LANDING') defaults.liveLandingTemplateId = t.id;
          if (t.type === 'EVENT_ENDED') defaults.eventEndedTemplateId = t.id;
          if (t.type === 'ITINERARY') defaults.itineraryPageTemplateId = t.id;
          if (t.type === 'GIFTING') defaults.giftingPageTemplateId = t.id;
          if (t.type === 'VOTING') defaults.votingPageTemplateId = t.id;
          if (t.type === 'VOTING_NOMINATION') defaults.nominationPageTemplateId = t.id;
          if (t.type === 'VOTING_NOMINEES') defaults.nomineesPageTemplateId = t.id;
          if (t.type === 'VOTING_LEADERBOARD') defaults.leaderboardPageTemplateId = t.id;
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

  const handleCreateOwner = async () => {
    if (!newOwnerData.name || !newOwnerData.email) {
      toast.error('Name and email are required');
      return;
    }

    setCreatingOwner(true);
    try {
      const response = await ownersApi.create({
        name: newOwnerData.name,
        email: newOwnerData.email,
        phone: newOwnerData.phone || undefined,
        company: newOwnerData.company || undefined,
      });
      
      // Add to owners list and select it
      const newOwner = response.data.owner;
      setOwners([...owners, newOwner]);
      setFormData({ ...formData, ownerId: newOwner.id });
      setShowCreateOwner(false);
      setOwnerMode('select');
      setNewOwnerData({ name: '', email: '', phone: '', company: '' });
      toast.success('Owner created and selected');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create owner');
    } finally {
      setCreatingOwner(false);
    }
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
        socialTitle: formData.socialTitle || undefined,
        socialDescription: formData.socialDescription || undefined,
        coverImageAlt: formData.coverImageAlt || undefined,
        date: dateTime.toISOString(),
        endDate: endDateTime?.toISOString(),
        timezone: formData.timezone,
        defaultCurrency: formData.defaultCurrency,
        venue: formData.venue || undefined,
        ownerId: formData.ownerId || undefined,
        invitationOnly: formData.invitationOnly,
        invitationEnabled: formData.invitationEnabled,
        rsvpEnabled: formData.rsvpEnabled,
        guestbookEnabled: formData.guestbookEnabled,
        checkInEnabled: formData.invitationOnly ? formData.checkInEnabled : false,
        maxRecordingDuration: formData.maxRecordingDuration,
        minRecordingDuration: formData.minRecordingDuration,
        maxPhotosPerGuest: formData.maxPhotosPerGuest,
        strictInviteOnly: formData.strictInviteOnly,
        itineraryEnabled: formData.itineraryEnabled,
        giftingEnabled: formData.giftingEnabled,
        rsvpMode: formData.rsvpMode,
        ticketingEnabled: formData.ticketingEnabled,
        feeOverridesEnabled: formData.feeOverridesEnabled,
        platformFeeMode: formData.platformFeeMode,
        platformFeePercent: formData.platformFeePercent,
        platformFeeFixed: formData.platformFeeFixed,
        processingFeePercent: formData.processingFeePercent,
        processingFeeFixed: formData.processingFeeFixed,
        invitationTemplateId: formData.invitationEnabled ? (formData.invitationTemplateId || undefined) : undefined,
        rsvpTemplateId: formData.rsvpEnabled ? (formData.rsvpTemplateId || undefined) : undefined,
        guestbookTemplateId: formData.guestbookEnabled ? (formData.guestbookTemplateId || undefined) : undefined,
        guestbookVideoTemplateId: formData.guestbookEnabled ? (formData.guestbookVideoTemplateId || undefined) : undefined,
        guestbookAudioTemplateId: formData.guestbookEnabled ? (formData.guestbookAudioTemplateId || undefined) : undefined,
        guestbookPhotoTemplateId: formData.guestbookEnabled ? (formData.guestbookPhotoTemplateId || undefined) : undefined,
        thankYouTemplateId: formData.thankYouTemplateId || undefined,
        liveLandingTemplateId: formData.liveLandingTemplateId || undefined,
        eventEndedTemplateId: formData.eventEndedTemplateId || undefined,
        itineraryPageTemplateId: formData.itineraryEnabled ? (formData.itineraryPageTemplateId || undefined) : undefined,
        giftingPageTemplateId: formData.giftingEnabled ? (formData.giftingPageTemplateId || undefined) : undefined,
        votingPageTemplateId: formData.votingEnabled ? (formData.votingPageTemplateId || undefined) : undefined,
        nominationPageTemplateId: formData.votingEnabled ? (formData.nominationPageTemplateId || undefined) : undefined,
        nomineesPageTemplateId: formData.votingEnabled ? (formData.nomineesPageTemplateId || undefined) : undefined,
        leaderboardPageTemplateId: formData.votingEnabled ? (formData.leaderboardPageTemplateId || undefined) : undefined,
      });

      const createdEventId = response.data.event.id as string;
      const followUpWarnings: string[] = [];

      if (coverFile) {
        try {
          const coverData = new FormData();
          coverData.append('cover', coverFile);
          if (formData.coverImageAlt) {
            coverData.append('alt', formData.coverImageAlt);
          }
          await eventsApi.uploadCover(createdEventId, coverData);
        } catch (error) {
          console.error('Cover upload failed after event creation:', error);
          followUpWarnings.push('Cover image upload');
        }
      }

      if (followUpWarnings.length === 0) {
        toast.success('Event created successfully!');
      } else {
        toast.success('Event created. Complete remaining setup inside event settings.');
        toast.error(`${followUpWarnings.join(' and ')} could not be completed automatically.`);
      }

      router.push(`/admin/events/${createdEventId}`);
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="dashboard-canvas p-5 sm:p-6">
        <Link
          href="/admin/events"
          className="inline-flex items-center text-surface-600 hover:text-navy-900 mb-3 text-sm font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Events
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="pill-accent">Event Setup</span>
            <h1 className="text-2xl font-display font-bold text-navy-900 mt-2">Create New Event</h1>
            <p className="text-surface-600 mt-1">Set up details, services, templates, and access controls in one flow.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="dashboard-canvas p-5 sm:p-6">
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
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
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

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Social Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Title shown on social shares"
                  value={formData.socialTitle}
                  onChange={(e) => setFormData({ ...formData, socialTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Cover Image Alt Text</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Describe the cover image"
                  value={formData.coverImageAlt}
                  onChange={(e) => setFormData({ ...formData, coverImageAlt: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Social Description</label>
                <textarea
                  rows={2}
                  className="input"
                  placeholder="Description shown in social previews"
                  value={formData.socialDescription}
                  onChange={(e) => setFormData({ ...formData, socialDescription: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Cover Image</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setCoverFile(file);
                    setCoverPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
                <p className="text-xs text-surface-500 mt-1">
                  Use JPG/PNG/WEBP, minimum 800x420 (recommended 2000px wide). We auto-crop to 1200x630 for crisp social cards.
                </p>
                {coverPreview && (
                  <div className="mt-3 rounded-lg border border-surface-200 overflow-hidden aspect-[1200/630]">
                    <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Date & Location */}
        <div className="dashboard-canvas p-5 sm:p-6">
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

            <div>
              <label htmlFor="defaultCurrency" className="label">Default Currency</label>
              <select
                id="defaultCurrency"
                className="input"
                value={formData.defaultCurrency}
                onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="GHS">GHS</option>
                <option value="KES">KES</option>
                <option value="NGN">NGN</option>
              </select>
            </div>
          </div>
        </div>

        {/* Event Owner */}
        <div className="dashboard-canvas p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Event Owner</h2>
          <div className="space-y-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setOwnerMode('select');
                  setShowCreateOwner(false);
                }}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  ownerMode === 'select'
                    ? 'bg-navy-900 text-white'
                    : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                )}
              >
                Select Existing
              </button>
              <button
                type="button"
                onClick={() => {
                  setOwnerMode('create');
                  setShowCreateOwner(true);
                }}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  ownerMode === 'create'
                    ? 'bg-navy-900 text-white'
                    : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                )}
              >
                Create New
              </button>
            </div>

            {ownerMode === 'select' && (
              <div>
                <label htmlFor="ownerId" className="label">Owner (Optional)</label>
                <select
                  id="ownerId"
                  className="input"
                  value={formData.ownerId}
                  onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                >
                  <option value="">-- No owner assigned --</option>
                  {loadingOwners ? (
                    <option disabled>Loading owners...</option>
                  ) : (
                    owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name} {owner.company ? `(${owner.company})` : ''} - {owner.email}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-sm text-surface-500 mt-1">
                  Select an existing owner/client or create a new one
                </p>
              </div>
            )}

            {ownerMode === 'create' && showCreateOwner && (
              <div className="p-4 bg-surface-50 rounded-lg border border-surface-200 space-y-4">
                <div>
                  <label className="label">Owner Name *</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="John Doe"
                    value={newOwnerData.name}
                    onChange={(e) => setNewOwnerData({ ...newOwnerData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    required
                    className="input"
                    placeholder="john@example.com"
                    value={newOwnerData.email}
                    onChange={(e) => setNewOwnerData({ ...newOwnerData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+1 (555) 123-4567"
                    value={newOwnerData.phone}
                    onChange={(e) => setNewOwnerData({ ...newOwnerData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Company</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Acme Corporation"
                    value={newOwnerData.company}
                    onChange={(e) => setNewOwnerData({ ...newOwnerData, company: e.target.value })}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCreateOwner}
                    disabled={creatingOwner || !newOwnerData.name || !newOwnerData.email}
                    className="btn-primary flex-1"
                  >
                    {creatingOwner ? 'Creating...' : 'Create & Select Owner'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateOwner(false);
                      setOwnerMode('select');
                      setNewOwnerData({ name: '', email: '', phone: '', company: '' });
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Services */}
        <div className="dashboard-canvas p-5 sm:p-6">
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

            <label className={cn(
              'flex items-center justify-between p-4 rounded-lg border transition-colors',
              formData.invitationOnly
                ? 'bg-surface-50 border-surface-200 cursor-pointer hover:bg-surface-100'
                : 'bg-surface-100 border-surface-200 opacity-60 cursor-not-allowed'
            )}>
              <div>
                <p className="font-medium text-navy-900">Check-In System</p>
                <p className="text-sm text-surface-600">
                  {formData.invitationOnly ? 'QR code and manual verification' : 'Enable invitation-only first to use check-in'}
                </p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                checked={formData.checkInEnabled && formData.invitationOnly}
                disabled={!formData.invitationOnly}
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
                onChange={(e) => {
                  const invitationOnly = e.target.checked;
                  setFormData({
                    ...formData,
                    invitationOnly,
                    checkInEnabled: invitationOnly ? formData.checkInEnabled : false,
                  });
                }}
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
              <div>
                <p className="font-medium text-navy-900">Strict Invite Mode</p>
                <p className="text-sm text-surface-600">Require valid invite token for RSVP submission.</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                checked={formData.strictInviteOnly}
                onChange={(e) => setFormData({ ...formData, strictInviteOnly: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
              <div>
                <p className="font-medium text-navy-900">Enable Itinerary</p>
                <p className="text-sm text-surface-600">Activate attendee + MC synced itinerary tracking.</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                checked={formData.itineraryEnabled}
                onChange={(e) => setFormData({ ...formData, itineraryEnabled: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
              <div>
                <p className="font-medium text-navy-900">Enable Gifting</p>
                <p className="text-sm text-surface-600">Allow guests to gift via MoMo cash or packages.</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                checked={formData.giftingEnabled}
                onChange={(e) => setFormData({ ...formData, giftingEnabled: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100">
              <div>
                <p className="font-medium text-navy-900">Enable Voting</p>
                <p className="text-sm text-surface-600">Create nomination, nominees, vote, and leaderboard pages for this event.</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                checked={formData.votingEnabled}
                onChange={(e) => setFormData({ ...formData, votingEnabled: e.target.checked })}
              />
            </label>
          </div>
        </div>

        {/* RSVP Pricing & Ticketing */}
        <div className="dashboard-canvas p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">RSVP Pricing & Ticketing</h2>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className={cn(
                'flex items-center gap-3 cursor-pointer p-4 rounded-lg border-2 transition-colors',
                formData.rsvpMode === 'free' ? 'border-navy-900 bg-surface-50' : 'border-surface-200 hover:bg-surface-50'
              )}>
                <input
                  type="radio"
                  name="newEventRsvpMode"
                  value="free"
                  checked={formData.rsvpMode === 'free'}
                  onChange={() => setFormData({ ...formData, rsvpMode: 'free', ticketingEnabled: false })}
                  className="sr-only"
                />
                <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center', formData.rsvpMode === 'free' ? 'border-navy-900' : 'border-surface-300')}>
                  {formData.rsvpMode === 'free' && <div className="w-2.5 h-2.5 rounded-full bg-navy-900" />}
                </div>
                <div>
                  <div className="font-medium text-navy-900">Free RSVP</div>
                  <div className="text-xs text-surface-500">No ticket payment required</div>
                </div>
              </label>
              <label className={cn(
                'flex items-center gap-3 cursor-pointer p-4 rounded-lg border-2 transition-colors',
                formData.rsvpMode === 'paid' ? 'border-navy-900 bg-surface-50' : 'border-surface-200 hover:bg-surface-50'
              )}>
                <input
                  type="radio"
                  name="newEventRsvpMode"
                  value="paid"
                  checked={formData.rsvpMode === 'paid'}
                  onChange={() => setFormData({ ...formData, rsvpMode: 'paid', ticketingEnabled: true })}
                  className="sr-only"
                />
                <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center', formData.rsvpMode === 'paid' ? 'border-navy-900' : 'border-surface-300')}>
                  {formData.rsvpMode === 'paid' && <div className="w-2.5 h-2.5 rounded-full bg-navy-900" />}
                </div>
                <div>
                  <div className="font-medium text-navy-900">Paid RSVP</div>
                  <div className="text-xs text-surface-500">Enable ticketing and checkout</div>
                </div>
              </label>
            </div>

            {(formData.rsvpMode === 'paid' || formData.giftingEnabled) && (
              <div className="rounded-lg border border-surface-200 p-4 bg-surface-50 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-surface-200 bg-white">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-surface-300 text-navy-900"
                    checked={!formData.feeOverridesEnabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        feeOverridesEnabled: !e.target.checked,
                      })
                    }
                  />
                  <div>
                    <p className="font-medium text-navy-900">Use system default fees</p>
                    <p className="text-xs text-surface-500">Disable this to configure custom fees for this event only.</p>
                  </div>
                </label>

                {!formData.feeOverridesEnabled ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-lg border border-surface-200 bg-white p-3">
                      <p className="text-xs text-surface-500 mb-1">Default Platform Mode</p>
                      <p className="font-medium text-navy-900">{defaultFeeSettings.platformFeeMode}</p>
                    </div>
                    <div className="rounded-lg border border-surface-200 bg-white p-3">
                      <p className="text-xs text-surface-500 mb-1">
                        {defaultFeeSettings.platformFeeMode === 'FIXED' ? 'Default Platform Fee (Fixed)' : 'Default Platform Fee (%)'}
                      </p>
                      <p className="font-medium text-navy-900">
                        {defaultFeeSettings.platformFeeMode === 'FIXED'
                          ? defaultFeeSettings.platformFeeFixed
                          : defaultFeeSettings.platformFeePercent}
                      </p>
                    </div>
                    <div className="rounded-lg border border-surface-200 bg-white p-3">
                      <p className="text-xs text-surface-500 mb-1">Default Processing Fee (%)</p>
                      <p className="font-medium text-navy-900">{defaultFeeSettings.processingFeePercent}</p>
                    </div>
                    <div className="rounded-lg border border-surface-200 bg-white p-3">
                      <p className="text-xs text-surface-500 mb-1">Default Fixed Processing Fee</p>
                      <p className="font-medium text-navy-900">{defaultFeeSettings.processingFeeFixed}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="label">Platform Fee Mode</label>
                      <select
                        className="input"
                        value={formData.platformFeeMode}
                        onChange={(e) =>
                          setFormData({ ...formData, platformFeeMode: e.target.value as 'PERCENTAGE' | 'FIXED' })
                        }
                      >
                        <option value="PERCENTAGE">Percentage</option>
                        <option value="FIXED">Fixed Amount</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">
                        {formData.platformFeeMode === 'FIXED' ? 'Platform Fee (Fixed)' : 'Platform Fee (%)'}
                      </label>
                      <input
                        type="number"
                        step={formData.platformFeeMode === 'FIXED' ? '0.01' : '0.1'}
                        min="0"
                        max={formData.platformFeeMode === 'FIXED' ? undefined : '100'}
                        className="input"
                        value={formData.platformFeeMode === 'FIXED' ? formData.platformFeeFixed : formData.platformFeePercent}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            platformFeePercent:
                              formData.platformFeeMode === 'PERCENTAGE'
                                ? parseFloat(e.target.value) || 0
                                : formData.platformFeePercent,
                            platformFeeFixed:
                              formData.platformFeeMode === 'FIXED'
                                ? parseFloat(e.target.value) || 0
                                : formData.platformFeeFixed,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Processing Fee (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="input"
                        value={formData.processingFeePercent}
                        onChange={(e) => setFormData({ ...formData, processingFeePercent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="label">Fixed Processing Fee</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        value={formData.processingFeeFixed}
                        onChange={(e) => setFormData({ ...formData, processingFeeFixed: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Template Selection */}
        <div className="dashboard-canvas p-5 sm:p-6">
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

              <TemplateSelect
                type="LIVE_LANDING"
                label="Live Landing Page"
                value={formData.liveLandingTemplateId}
                onChange={(id) => setFormData({ ...formData, liveLandingTemplateId: id })}
              />

              <TemplateSelect
                type="EVENT_ENDED"
                label="Event Ended Page"
                value={formData.eventEndedTemplateId}
                onChange={(id) => setFormData({ ...formData, eventEndedTemplateId: id })}
              />

              <TemplateSelect
                type="ITINERARY"
                label="Itinerary Page"
                value={formData.itineraryPageTemplateId}
                onChange={(id) => setFormData({ ...formData, itineraryPageTemplateId: id })}
                disabled={!formData.itineraryEnabled}
              />

              <TemplateSelect
                type="GIFTING"
                label="Gifting Page"
                value={formData.giftingPageTemplateId}
                onChange={(id) => setFormData({ ...formData, giftingPageTemplateId: id })}
                disabled={!formData.giftingEnabled}
              />

              <TemplateSelect
                type="VOTING"
                label="Voting Page"
                value={formData.votingPageTemplateId}
                onChange={(id) => setFormData({ ...formData, votingPageTemplateId: id })}
                disabled={!formData.votingEnabled}
              />

              <TemplateSelect
                type="VOTING_NOMINATION"
                label="Nomination Page"
                value={formData.nominationPageTemplateId}
                onChange={(id) => setFormData({ ...formData, nominationPageTemplateId: id })}
                disabled={!formData.votingEnabled}
              />

              <TemplateSelect
                type="VOTING_NOMINEES"
                label="Nominees Page"
                value={formData.nomineesPageTemplateId}
                onChange={(id) => setFormData({ ...formData, nomineesPageTemplateId: id })}
                disabled={!formData.votingEnabled}
              />

              <TemplateSelect
                type="VOTING_LEADERBOARD"
                label="Leaderboard Page"
                value={formData.leaderboardPageTemplateId}
                onChange={(id) => setFormData({ ...formData, leaderboardPageTemplateId: id })}
                disabled={!formData.votingEnabled}
              />
            </div>
          )}
        </div>

        {/* Guestbook Settings */}
        {formData.guestbookEnabled && (
          <div className="dashboard-canvas p-5 sm:p-6">
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
