'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/utils';
import {
  EmptyState,
  PageHeader,
  PageSkeleton,
  Panel,
  StatusBadge,
  SubmitButton,
  Switch,
  Tabs,
  Toolbar,
} from '@/components/ui/Primitives';
import { ConfirmDialog, Menu, MenuItem, MenuSeparator, Modal } from '@/components/ui/Overlay';

interface SystemSettings {
  id: string;
  siteName: string;
  siteUrl: string | null;
  logoUrl: string | null;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  platformFeeMode: 'PERCENTAGE' | 'FIXED';
  platformFeePercent: number;
  platformFeeFixed: number | null;
  processingFeePercent: number;
  processingFeeFixed: number;
}

interface Provider {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
  [key: string]: any;
}

type Tab = 'general' | 'email' | 'sms' | 'whatsapp';

const EMAIL_PROVIDERS = [
  { id: 'smtp', name: 'SMTP', description: 'Standard email protocol' },
  { id: 'sendgrid', name: 'SendGrid', description: 'Cloud email service' },
  { id: 'mailgun', name: 'Mailgun', description: 'Email API service' },
  { id: 'ses', name: 'Amazon SES', description: 'AWS Simple Email Service' },
  { id: 'postmark', name: 'Postmark', description: 'Transactional email' },
  { id: 'custom', name: 'Custom API', description: 'Custom HTTP endpoint' },
];

const SMS_PROVIDERS = [
  { id: 'twilio', name: 'Twilio', description: 'Cloud communications' },
  { id: 'termii', name: 'Termii', description: 'African SMS provider' },
  { id: 'africastalking', name: "Africa's Talking", description: 'African communications' },
  { id: 'arkesel', name: 'Arkesel', description: 'Ghana SMS provider' },
  { id: 'vonage', name: 'Vonage (Nexmo)', description: 'Global SMS provider' },
  { id: 'messagebird', name: 'MessageBird', description: 'Omnichannel messaging' },
  { id: 'custom', name: 'Custom API', description: 'Custom HTTP endpoint' },
];

const WHATSAPP_PROVIDERS = [
  { id: 'twilio', name: 'Twilio', description: 'WhatsApp via Twilio' },
  { id: 'meta', name: 'Meta Cloud API', description: 'Direct Meta integration' },
  { id: 'custom', name: 'Custom API', description: 'Custom HTTP endpoint' },
];


export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  
  // Providers state
  const [emailProviders, setEmailProviders] = useState<Provider[]>([]);
  const [smsProviders, setSmsProviders] = useState<Provider[]>([]);
  const [whatsappProviders, setWhatsappProviders] = useState<Provider[]>([]);
  
  // Modal state
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerType, setProviderType] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [providerForm, setProviderForm] = useState<any>({});
  
  // Test state
  const [testRecipient, setTestRecipient] = useState('');
  const [testTarget, setTestTarget] = useState<{ type: 'email' | 'sms' | 'whatsapp'; provider: Provider } | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<{ type: 'email' | 'sms' | 'whatsapp'; provider: Provider } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/api/settings${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return response.json();
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [settingsRes, emailRes, smsRes, whatsappRes] = await Promise.all([
        apiCall('/'),
        apiCall('/email-providers'),
        apiCall('/sms-providers'),
        apiCall('/whatsapp-providers'),
      ]);
      setSettings(settingsRes.settings);
      setEmailProviders(emailRes.providers);
      setSmsProviders(smsRes.providers);
      setWhatsappProviders(whatsappRes.providers);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Could not load settings.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await apiCall('/', { method: 'PATCH', body: JSON.stringify(settings) });
      toast.success('Settings saved');
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openProviderModal = (type: 'email' | 'sms' | 'whatsapp', provider?: Provider) => {
    setProviderType(type);
    setEditingProvider(provider || null);
    setProviderForm(provider ? { ...provider } : { provider: '', name: '', isActive: true, isDefault: false });
    setShowProviderModal(true);
  };

  const saveProvider = async () => {
    const endpoint = `/${providerType}-providers`;
    try {
      if (editingProvider) {
        await apiCall(`${endpoint}/${editingProvider.id}`, { method: 'PATCH', body: JSON.stringify(providerForm) });
        toast.success('Provider updated');
      } else {
        await apiCall(endpoint, { method: 'POST', body: JSON.stringify(providerForm) });
        toast.success('Provider added');
      }
      setShowProviderModal(false);
      fetchAll();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    }
  };

  const deleteProvider = async (type: 'email' | 'sms' | 'whatsapp', id: string) => {
    try {
      await apiCall(`/${type}-providers/${id}`, { method: 'DELETE' });
      toast.success('Provider deleted');
      fetchAll();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    }
  };

  const testProvider = async (type: 'email' | 'sms' | 'whatsapp', id: string) => {
    if (!testRecipient) {
      toast.error(type === 'email' ? 'Enter an email address' : 'Enter a phone number');
      return;
    }
    setTesting(id);
    try {
      const body = type === 'email' ? { email: testRecipient } : { phone: testRecipient };
      await apiCall(`/${type}-providers/${id}/test`, { method: 'POST', body: JSON.stringify(body) });
      toast.success('Test sent');
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setTesting(null);
    }
  };

  const setAsDefault = async (type: 'email' | 'sms' | 'whatsapp', id: string) => {
    try {
      await apiCall(`/${type}-providers/${id}`, { method: 'PATCH', body: JSON.stringify({ isDefault: true }) });
      toast.success('Default provider updated');
      fetchAll();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageSkeleton stats={0} rows={4} />
      </div>
    );
  }

  const renderProviderCard = (type: 'email' | 'sms' | 'whatsapp', provider: Provider) => (
    <div key={provider.id} className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-brand-900">{provider.name}</span>
          {provider.isDefault ? <StatusBadge tone="brand">Default</StatusBadge> : null}
          <StatusBadge tone={provider.isActive ? 'success' : 'neutral'} dot>
            {provider.isActive ? 'Active' : 'Inactive'}
          </StatusBadge>
        </div>
        <p className="mt-0.5 meta capitalize">{provider.provider}</p>
      </div>
      <button
        type="button"
        className="btn-outline btn-sm hidden shrink-0 sm:inline-flex"
        onClick={() => openProviderModal(type, provider)}
      >
        Edit
      </button>
      <Menu label={`Actions for ${provider.name}`} sheetTitle={provider.name}>
        <MenuItem onClick={() => openProviderModal(type, provider)}>Edit provider</MenuItem>
        <MenuItem onClick={() => setTestTarget({ type, provider })}>Send a test</MenuItem>
        {provider.isDefault ? null : (
          <MenuItem onClick={() => setAsDefault(type, provider.id)}>Make default</MenuItem>
        )}
        <MenuSeparator />
        <MenuItem danger onClick={() => setDeletingProvider({ type, provider })}>
          Delete provider
        </MenuItem>
      </Menu>
    </div>
  );

  const renderProviderForm = () => {
    const providerOptions = providerType === 'email' ? EMAIL_PROVIDERS : providerType === 'sms' ? SMS_PROVIDERS : WHATSAPP_PROVIDERS;
    const selectedProvider = providerOptions.find(p => p.id === providerForm.provider);
    
    return (
      <div className="space-y-4">
        <div>
          <label className="label">Provider Type</label>
          <select
            className="input"
            value={providerForm.provider}
            onChange={(e) => setProviderForm({ ...providerForm, provider: e.target.value })}
            disabled={!!editingProvider}
          >
            <option value="">Select provider...</option>
            {providerOptions.map(p => (
              <option key={p.id} value={p.id}>{p.name} - {p.description}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="label">Display Name</label>
          <input
            type="text"
            className="input"
            value={providerForm.name || ''}
            onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
            placeholder="My Email Provider"
          />
        </div>
        
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={providerForm.isActive ?? true}
              onChange={(e) => setProviderForm({ ...providerForm, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-surface-300"
            />
            <span className="text-sm">Active</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={providerForm.isDefault ?? false}
              onChange={(e) => setProviderForm({ ...providerForm, isDefault: e.target.checked })}
              className="w-4 h-4 rounded border-surface-300"
            />
            <span className="text-sm">Set as default</span>
          </label>
        </div>
        
        {/* Provider-specific fields */}
        {providerType === 'email' && (
          <>
            {providerForm.provider === 'smtp' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">SMTP Host</label>
                    <input type="text" className="input" value={providerForm.smtpHost || ''} onChange={(e) => setProviderForm({ ...providerForm, smtpHost: e.target.value })} placeholder="smtp.gmail.com" />
                  </div>
                  <div>
                    <label className="label">SMTP Port</label>
                    <input type="number" className="input" value={providerForm.smtpPort || ''} onChange={(e) => setProviderForm({ ...providerForm, smtpPort: parseInt(e.target.value) || 587 })} placeholder="587" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Username</label>
                    <input type="text" className="input" value={providerForm.smtpUser || ''} onChange={(e) => setProviderForm({ ...providerForm, smtpUser: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <input type="password" className="input" value={providerForm.smtpPass || ''} onChange={(e) => setProviderForm({ ...providerForm, smtpPass: e.target.value })} />
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={providerForm.smtpSecure ?? true} onChange={(e) => setProviderForm({ ...providerForm, smtpSecure: e.target.checked })} className="w-4 h-4 rounded border-surface-300" />
                  <span className="text-sm">Use TLS/SSL</span>
                </label>
              </>
            )}
            {(providerForm.provider === 'sendgrid' || providerForm.provider === 'mailgun' || providerForm.provider === 'ses' || providerForm.provider === 'postmark') && (
              <div>
                <label className="label">API Key</label>
                <input type="password" className="input" value={providerForm.apiKey || ''} onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })} />
                {providerForm.provider === 'mailgun' && <p className="text-xs text-surface-500 mt-1">Format: apikey:domain.mailgun.org</p>}
                {providerForm.provider === 'ses' && <p className="text-xs text-surface-500 mt-1">AWS Access Key ID</p>}
              </div>
            )}
            {providerForm.provider === 'ses' && (
              <>
                <div>
                  <label className="label">AWS Secret Key</label>
                  <input type="password" className="input" value={providerForm.smtpPass || ''} onChange={(e) => setProviderForm({ ...providerForm, smtpPass: e.target.value })} />
                </div>
                <div>
                  <label className="label">AWS Region</label>
                  <input type="text" className="input" value={providerForm.smtpHost || ''} onChange={(e) => setProviderForm({ ...providerForm, smtpHost: e.target.value })} placeholder="us-east-1" />
                </div>
              </>
            )}
            {providerForm.provider === 'custom' && (
              <>
                <div>
                  <label className="label">API Endpoint URL</label>
                  <input type="url" className="input" value={providerForm.smtpHost || ''} onChange={(e) => setProviderForm({ ...providerForm, smtpHost: e.target.value })} placeholder="https://api.yourprovider.com/send" />
                </div>
                <div>
                  <label className="label">API Key / Token</label>
                  <input type="password" className="input" value={providerForm.apiKey || ''} onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })} />
                </div>
                <div>
                  <label className="label">HTTP Method</label>
                  <select className="input" value={providerForm.smtpUser || 'POST'} onChange={(e) => setProviderForm({ ...providerForm, smtpUser: e.target.value })}>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>
                <p className="text-xs text-surface-500">Custom API expects JSON payload: {"{"} to, subject, html, text {"}"}</p>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">From Email</label>
                <input type="email" className="input" value={providerForm.fromEmail || ''} onChange={(e) => setProviderForm({ ...providerForm, fromEmail: e.target.value })} placeholder="noreply@example.com" />
              </div>
              <div>
                <label className="label">From Name</label>
                <input type="text" className="input" value={providerForm.fromName || ''} onChange={(e) => setProviderForm({ ...providerForm, fromName: e.target.value })} placeholder="Event Platform" />
              </div>
            </div>
          </>
        )}
        
        {providerType === 'sms' && (
          <>
            {providerForm.provider === 'twilio' && (
              <>
                <div>
                  <label className="label">Account SID</label>
                  <input type="text" className="input" value={providerForm.accountSid || ''} onChange={(e) => setProviderForm({ ...providerForm, accountSid: e.target.value })} placeholder="ACxxxxx" />
                </div>
                <div>
                  <label className="label">Auth Token</label>
                  <input type="password" className="input" value={providerForm.authToken || ''} onChange={(e) => setProviderForm({ ...providerForm, authToken: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input type="text" className="input" value={providerForm.phoneNumber || ''} onChange={(e) => setProviderForm({ ...providerForm, phoneNumber: e.target.value })} placeholder="+1234567890" />
                </div>
              </>
            )}
            {(providerForm.provider === 'termii' || providerForm.provider === 'africastalking' || providerForm.provider === 'arkesel' || providerForm.provider === 'vonage' || providerForm.provider === 'messagebird') && (
              <>
                <div>
                  <label className="label">API Key</label>
                  <input type="password" className="input" value={providerForm.apiKey || ''} onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })} />
                </div>
                {(providerForm.provider === 'africastalking' || providerForm.provider === 'vonage') && (
                  <div>
                    <label className="label">{providerForm.provider === 'vonage' ? 'API Secret' : 'Username'}</label>
                    <input type={providerForm.provider === 'vonage' ? 'password' : 'text'} className="input" value={providerForm.apiSecret || ''} onChange={(e) => setProviderForm({ ...providerForm, apiSecret: e.target.value })} placeholder={providerForm.provider === 'vonage' ? '' : 'sandbox'} />
                  </div>
                )}
                <div>
                  <label className="label">Sender ID / Phone</label>
                  <input type="text" className="input" value={providerForm.senderId || ''} onChange={(e) => setProviderForm({ ...providerForm, senderId: e.target.value })} placeholder={providerForm.provider === 'arkesel' ? 'Must be registered with Arkesel' : 'EventApp'} />
                  {providerForm.provider === 'arkesel' && (
                    <p className="text-xs text-surface-500 mt-1">Sender ID must be registered with Arkesel before use</p>
                  )}
                </div>
              </>
            )}
            {providerForm.provider === 'custom' && (
              <>
                <div>
                  <label className="label">API Endpoint URL</label>
                  <input type="url" className="input" value={providerForm.accountSid || ''} onChange={(e) => setProviderForm({ ...providerForm, accountSid: e.target.value })} placeholder="https://api.yourprovider.com/sms/send" />
                </div>
                <div>
                  <label className="label">API Key / Token</label>
                  <input type="password" className="input" value={providerForm.apiKey || ''} onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })} />
                </div>
                <div>
                  <label className="label">Sender ID</label>
                  <input type="text" className="input" value={providerForm.senderId || ''} onChange={(e) => setProviderForm({ ...providerForm, senderId: e.target.value })} placeholder="EventApp" />
                </div>
                <p className="text-xs text-surface-500">Custom API expects JSON payload: {"{"} to, message, from {"}"}</p>
              </>
            )}
          </>
        )}
        
        {providerType === 'whatsapp' && (
          <>
            {providerForm.provider === 'twilio' && (
              <>
                <div>
                  <label className="label">Account SID</label>
                  <input type="text" className="input" value={providerForm.accountSid || ''} onChange={(e) => setProviderForm({ ...providerForm, accountSid: e.target.value })} placeholder="ACxxxxx" />
                </div>
                <div>
                  <label className="label">Auth Token</label>
                  <input type="password" className="input" value={providerForm.authToken || ''} onChange={(e) => setProviderForm({ ...providerForm, authToken: e.target.value })} />
                </div>
                <div>
                  <label className="label">WhatsApp Number</label>
                  <input type="text" className="input" value={providerForm.phoneNumber || ''} onChange={(e) => setProviderForm({ ...providerForm, phoneNumber: e.target.value })} placeholder="whatsapp:+1234567890" />
                </div>
              </>
            )}
            {providerForm.provider === 'meta' && (
              <>
                <div>
                  <label className="label">Access Token</label>
                  <input type="password" className="input" value={providerForm.accessToken || ''} onChange={(e) => setProviderForm({ ...providerForm, accessToken: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone Number ID</label>
                  <input type="text" className="input" value={providerForm.phoneNumberId || ''} onChange={(e) => setProviderForm({ ...providerForm, phoneNumberId: e.target.value })} />
                </div>
                <div>
                  <label className="label">Business ID</label>
                  <input type="text" className="input" value={providerForm.businessId || ''} onChange={(e) => setProviderForm({ ...providerForm, businessId: e.target.value })} />
                </div>
              </>
            )}
            {providerForm.provider === 'custom' && (
              <>
                <div>
                  <label className="label">API Endpoint URL</label>
                  <input type="url" className="input" value={providerForm.accountSid || ''} onChange={(e) => setProviderForm({ ...providerForm, accountSid: e.target.value })} placeholder="https://api.yourprovider.com/whatsapp/send" />
                </div>
                <div>
                  <label className="label">API Key / Token</label>
                  <input type="password" className="input" value={providerForm.apiKey || ''} onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input type="text" className="input" value={providerForm.phoneNumber || ''} onChange={(e) => setProviderForm({ ...providerForm, phoneNumber: e.target.value })} placeholder="+1234567890" />
                </div>
                <p className="text-xs text-surface-500">Custom API expects JSON payload: {"{"} to, message, from {"}"}</p>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  const providerLists: Record<'email' | 'sms' | 'whatsapp', Provider[]> = {
    email: emailProviders,
    sms: smsProviders,
    whatsapp: whatsappProviders,
  };

  const channelLabels: Record<'email' | 'sms' | 'whatsapp', string> = {
    email: 'Email',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
  };

  const renderProviderTab = (type: 'email' | 'sms' | 'whatsapp') => {
    const providers = providerLists[type];
    return (
      <div className="space-y-4">
        <Toolbar
          end={
            <button onClick={() => openProviderModal(type)} className="btn-primary btn-sm">
              Add provider
            </button>
          }
        >
          <span className="meta">
            {channelLabels[type]} messages go out through the default provider. Add more as backups.
          </span>
        </Toolbar>

        {providers.length === 0 ? (
          <EmptyState
            title={`No ${channelLabels[type]} providers`}
            action={
              <button onClick={() => openProviderModal(type)} className="btn-primary btn-sm">
                Add provider
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white">
            {providers.map((provider) => renderProviderCard(type, provider))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page mx-auto max-w-5xl">
      <PageHeader
        title="Settings"
        actions={
          activeTab === 'general' ? (
            <SubmitButton loading={saving} onClick={handleSaveSettings}>
              Save
            </SubmitButton>
          ) : null
        }
      />

      <Tabs
        items={[
          { id: 'general', label: 'General' },
          { id: 'email', label: 'Email', count: emailProviders.length },
          { id: 'sms', label: 'SMS', count: smsProviders.length },
          { id: 'whatsapp', label: 'WhatsApp', count: whatsappProviders.length },
        ]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as Tab)}
        label="Settings sections"
      />

      {activeTab === 'general' && settings ? (
        <div className="space-y-4">
          <Panel title="Brand">
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="site-name">
                  Site name
                </label>
                <input
                  id="site-name"
                  type="text"
                  className="input"
                  value={settings.siteName}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="site-url">
                    Site URL
                  </label>
                  <input
                    id="site-url"
                    type="url"
                    className="input"
                    value={settings.siteUrl || ''}
                    onChange={(e) => setSettings({ ...settings, siteUrl: e.target.value })}
                    placeholder="https://app.eventpeepo.com"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="logo-url">
                    Logo URL
                  </label>
                  <input
                    id="logo-url"
                    type="url"
                    className="input"
                    value={settings.logoUrl || ''}
                    onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                    placeholder="https://…/logo.png"
                  />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Notification channels">
            <div className="space-y-1">
              <Switch
                label="Email"
                description={
                  emailProviders.length === 0 ? 'Add an email provider before turning this on.' : undefined
                }
                checked={settings.emailEnabled}
                onChange={(checked) => setSettings({ ...settings, emailEnabled: checked })}
              />
              <Switch
                label="SMS"
                description={smsProviders.length === 0 ? 'Add an SMS provider before turning this on.' : undefined}
                checked={settings.smsEnabled}
                onChange={(checked) => setSettings({ ...settings, smsEnabled: checked })}
              />
              <Switch
                label="WhatsApp"
                description={
                  whatsappProviders.length === 0 ? 'Add a WhatsApp provider before turning this on.' : undefined
                }
                checked={settings.whatsappEnabled}
                onChange={(checked) => setSettings({ ...settings, whatsappEnabled: checked })}
              />
            </div>
          </Panel>

          <Panel title="Default fees">
            <p className="field-hint mb-3 mt-0">Applies to every event that has not set its own fees.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label" htmlFor="fee-mode">
                  Platform fee type
                </label>
                <select
                  id="fee-mode"
                  className="input"
                  value={settings.platformFeeMode || 'PERCENTAGE'}
                  onChange={(e) =>
                    setSettings({ ...settings, platformFeeMode: e.target.value as 'PERCENTAGE' | 'FIXED' })
                  }
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="fee-platform">
                  {settings.platformFeeMode === 'FIXED' ? 'Platform fee' : 'Platform fee (%)'}
                </label>
                <input
                  id="fee-platform"
                  type="number"
                  step={settings.platformFeeMode === 'FIXED' ? '0.01' : '0.1'}
                  min="0"
                  max={settings.platformFeeMode === 'FIXED' ? undefined : '100'}
                  className="input"
                  value={
                    settings.platformFeeMode === 'FIXED'
                      ? settings.platformFeeFixed ?? 0
                      : settings.platformFeePercent ?? 0
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platformFeePercent:
                        settings.platformFeeMode === 'PERCENTAGE'
                          ? parseFloat(e.target.value) || 0
                          : settings.platformFeePercent,
                      platformFeeFixed:
                        settings.platformFeeMode === 'FIXED'
                          ? parseFloat(e.target.value) || 0
                          : settings.platformFeeFixed,
                    })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="fee-processing">
                  Processing fee (%)
                </label>
                <input
                  id="fee-processing"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="input"
                  value={settings.processingFeePercent ?? 0}
                  onChange={(e) =>
                    setSettings({ ...settings, processingFeePercent: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="fee-fixed">
                  Fixed processing fee
                </label>
                <input
                  id="fee-fixed"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={settings.processingFeeFixed ?? 0}
                  onChange={(e) =>
                    setSettings({ ...settings, processingFeeFixed: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
          </Panel>

          <div className="flex justify-end">
            <SubmitButton loading={saving} onClick={handleSaveSettings}>
              Save settings
            </SubmitButton>
          </div>
        </div>
      ) : null}

      {activeTab === 'email' ? renderProviderTab('email') : null}
      {activeTab === 'sms' ? renderProviderTab('sms') : null}
      {activeTab === 'whatsapp' ? renderProviderTab('whatsapp') : null}

      <Modal
        open={showProviderModal}
        onClose={() => setShowProviderModal(false)}
        title={editingProvider ? editingProvider.name : `Add ${channelLabels[providerType]} provider`}
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setShowProviderModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="button" onClick={saveProvider} className="btn-primary">
              {editingProvider ? 'Save' : 'Add provider'}
            </button>
          </>
        }
      >
        {renderProviderForm()}
      </Modal>

      <Modal
        open={Boolean(testTarget)}
        onClose={() => setTestTarget(null)}
        title="Send a test"
        description={testTarget ? testTarget.provider.name : undefined}
        size="sm"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setTestTarget(null)}>
              Cancel
            </button>
            <SubmitButton
              loading={Boolean(testTarget && testing === testTarget.provider.id)}
              disabled={!testRecipient.trim()}
              onClick={async () => {
                if (!testTarget) return;
                await testProvider(testTarget.type, testTarget.provider.id);
              }}
            >
              Send test
            </SubmitButton>
          </>
        }
      >
        <label className="label" htmlFor="test-recipient">
          {testTarget?.type === 'email' ? 'Email address' : 'Phone number'}
        </label>
        <input
          id="test-recipient"
          data-autofocus
          type={testTarget?.type === 'email' ? 'email' : 'tel'}
          className="input"
          placeholder={testTarget?.type === 'email' ? 'you@example.com' : '+233201234567'}
          value={testRecipient}
          onChange={(e) => setTestRecipient(e.target.value)}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingProvider)}
        onClose={() => setDeletingProvider(null)}
        onConfirm={() => {
          if (deletingProvider) void deleteProvider(deletingProvider.type, deletingProvider.provider.id);
          setDeletingProvider(null);
        }}
        title={`Delete ${deletingProvider?.provider.name || 'provider'}?`}
        body="Messages that relied on this provider stop sending until another one is set as default."
        confirmLabel="Delete provider"
      />
    </div>
  );
}
