'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface SystemSettings {
  id: string;
  siteName: string;
  siteUrl: string | null;
  logoUrl: string | null;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
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
  { id: 'vonage', name: 'Vonage (Nexmo)', description: 'Global SMS provider' },
  { id: 'messagebird', name: 'MessageBird', description: 'Omnichannel messaging' },
  { id: 'custom', name: 'Custom API', description: 'Custom HTTP endpoint' },
];

const WHATSAPP_PROVIDERS = [
  { id: 'twilio', name: 'Twilio', description: 'WhatsApp via Twilio' },
  { id: 'meta', name: 'Meta Cloud API', description: 'Direct Meta integration' },
  { id: 'custom', name: 'Custom API', description: 'Custom HTTP endpoint' },
];

// Monochrome Icons
const Icons = {
  settings: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  email: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  phone: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  message: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  edit: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  trash: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  check: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  plus: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
};

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
      toast.error(error.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await apiCall('/', { method: 'PATCH', body: JSON.stringify(settings) });
      toast.success('Settings saved!');
    } catch (error: any) {
      toast.error(error.message);
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
        toast.success('Provider updated!');
      } else {
        await apiCall(endpoint, { method: 'POST', body: JSON.stringify(providerForm) });
        toast.success('Provider added!');
      }
      setShowProviderModal(false);
      fetchAll();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteProvider = async (type: 'email' | 'sms' | 'whatsapp', id: string) => {
    if (!confirm('Delete this provider?')) return;
    try {
      await apiCall(`/${type}-providers/${id}`, { method: 'DELETE' });
      toast.success('Provider deleted');
      fetchAll();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const testProvider = async (type: 'email' | 'sms' | 'whatsapp', id: string) => {
    if (!testRecipient) {
      toast.error(type === 'email' ? 'Enter email address' : 'Enter phone number');
      return;
    }
    setTesting(id);
    try {
      const body = type === 'email' ? { email: testRecipient } : { phone: testRecipient };
      await apiCall(`/${type}-providers/${id}/test`, { method: 'POST', body: JSON.stringify(body) });
      toast.success('Test sent successfully!');
    } catch (error: any) {
      toast.error(error.message);
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
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  const renderProviderCard = (type: 'email' | 'sms' | 'whatsapp', provider: Provider) => (
    <div key={provider.id} className={cn(
      'bg-white rounded-xl border p-5 transition-all',
      provider.isDefault ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-surface-200'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-navy-900">{provider.name}</h4>
            {provider.isDefault && (
              <span className="text-xs bg-primary-500 text-navy-900 px-2 py-0.5 rounded-full font-medium">Default</span>
            )}
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              provider.isActive ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-surface-500'
            )}>
              {provider.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-surface-500 capitalize">{provider.provider}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => openProviderModal(type, provider)} className="p-2 hover:bg-surface-50 rounded-lg transition-colors" title="Edit">
            <svg className="w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => deleteProvider(type, provider.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-4">
        {!provider.isDefault && (
          <button onClick={() => setAsDefault(type, provider.id)} className="text-xs text-primary-600 hover:underline">
            Set as default
          </button>
        )}
        <div className="flex-1" />
        <input
          type="text"
          placeholder={type === 'email' ? 'test@example.com' : '+1234567890'}
          value={testRecipient}
          onChange={(e) => setTestRecipient(e.target.value)}
          className="text-sm border border-surface-200 rounded-lg px-2 py-1 w-40"
        />
        <button 
          onClick={() => testProvider(type, provider.id)} 
          disabled={testing === provider.id}
          className="text-xs bg-navy-900 text-white px-3 py-1.5 rounded-lg hover:bg-navy-800 disabled:opacity-50"
        >
          {testing === provider.id ? 'Sending...' : 'Test'}
        </button>
      </div>
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
            {(providerForm.provider === 'termii' || providerForm.provider === 'africastalking' || providerForm.provider === 'vonage' || providerForm.provider === 'messagebird') && (
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
                  <input type="text" className="input" value={providerForm.senderId || ''} onChange={(e) => setProviderForm({ ...providerForm, senderId: e.target.value })} placeholder="EventApp" />
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

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-navy-900 mb-6">System Settings</h1>

      <div className="bg-white rounded-xl shadow-sm border border-surface-200">
        <div className="border-b border-surface-200 p-4">
          <nav className="flex space-x-1 overflow-x-auto">
            {([
              { id: 'general', label: 'General', icon: Icons.settings },
              { id: 'email', label: 'Email Providers', icon: Icons.email },
              { id: 'sms', label: 'SMS Providers', icon: Icons.phone },
              { id: 'whatsapp', label: 'WhatsApp Providers', icon: Icons.message },
            ] as { id: Tab; label: string; icon: React.ReactNode }[]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2',
                  activeTab === tab.id
                    ? 'bg-navy-900 text-white'
                    : 'text-surface-600 hover:bg-surface-100'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && settings && (
            <div className="space-y-6">
              <div>
                <label className="label">Site Name</label>
                <input
                  type="text"
                  className="input"
                  value={settings.siteName}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Site URL</label>
                <input
                  type="url"
                  className="input"
                  value={settings.siteUrl || ''}
                  onChange={(e) => setSettings({ ...settings, siteUrl: e.target.value })}
                  placeholder="https://yourevent.com"
                />
              </div>
              <div>
                <label className="label">Logo URL</label>
                <input
                  type="url"
                  className="input"
                  value={settings.logoUrl || ''}
                  onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                  placeholder="https://yourevent.com/logo.png"
                />
              </div>

              <div className="border-t border-surface-100 pt-6">
                <h3 className="text-lg font-semibold text-navy-900 mb-4">Enable Notification Channels</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 rounded-lg bg-surface-50 cursor-pointer hover:bg-surface-100 transition-colors">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-surface-300 text-navy-900"
                      checked={settings.emailEnabled}
                      onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
                    />
                    <div className="flex items-center gap-3">
                      <span className="text-surface-500">{Icons.email}</span>
                      <div>
                        <span className="font-medium text-navy-900">Email Notifications</span>
                        <p className="text-sm text-surface-500">Send system emails (requires configured provider)</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-4 rounded-lg bg-surface-50 cursor-pointer hover:bg-surface-100 transition-colors">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-surface-300 text-navy-900"
                      checked={settings.smsEnabled}
                      onChange={(e) => setSettings({ ...settings, smsEnabled: e.target.checked })}
                    />
                    <div className="flex items-center gap-3">
                      <span className="text-surface-500">{Icons.phone}</span>
                      <div>
                        <span className="font-medium text-navy-900">SMS Notifications</span>
                        <p className="text-sm text-surface-500">Send SMS messages (requires configured provider)</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-4 rounded-lg bg-surface-50 cursor-pointer hover:bg-surface-100 transition-colors">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-surface-300 text-navy-900"
                      checked={settings.whatsappEnabled}
                      onChange={(e) => setSettings({ ...settings, whatsappEnabled: e.target.checked })}
                    />
                    <div className="flex items-center gap-3">
                      <span className="text-surface-500">{Icons.message}</span>
                      <div>
                        <span className="font-medium text-navy-900">WhatsApp Notifications</span>
                        <p className="text-sm text-surface-500">Send WhatsApp messages (requires configured provider)</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button onClick={handleSaveSettings} disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-navy-900">Email Providers</h3>
                  <p className="text-sm text-surface-500">Configure multiple email providers for redundancy</p>
                </div>
                <button onClick={() => openProviderModal('email')} className="btn-primary">
                  + Add Provider
                </button>
              </div>
              
              {emailProviders.length === 0 ? (
                <div className="text-center py-12 bg-surface-50 rounded-xl border-2 border-dashed border-surface-200">
                  <p className="text-surface-500">No email providers configured</p>
                  <button onClick={() => openProviderModal('email')} className="text-primary-600 font-medium hover:underline mt-2">
                    Add your first provider
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {emailProviders.map(p => renderProviderCard('email', p))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sms' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-navy-900">SMS Providers</h3>
                  <p className="text-sm text-surface-500">Configure SMS providers for text messaging</p>
                </div>
                <button onClick={() => openProviderModal('sms')} className="btn-primary">
                  + Add Provider
                </button>
              </div>
              
              {smsProviders.length === 0 ? (
                <div className="text-center py-12 bg-surface-50 rounded-xl border-2 border-dashed border-surface-200">
                  <p className="text-surface-500">No SMS providers configured</p>
                  <button onClick={() => openProviderModal('sms')} className="text-primary-600 font-medium hover:underline mt-2">
                    Add your first provider
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {smsProviders.map(p => renderProviderCard('sms', p))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-navy-900">WhatsApp Providers</h3>
                  <p className="text-sm text-surface-500">Configure WhatsApp Business API providers</p>
                </div>
                <button onClick={() => openProviderModal('whatsapp')} className="btn-primary">
                  + Add Provider
                </button>
              </div>
              
              {whatsappProviders.length === 0 ? (
                <div className="text-center py-12 bg-surface-50 rounded-xl border-2 border-dashed border-surface-200">
                  <p className="text-surface-500">No WhatsApp providers configured</p>
                  <button onClick={() => openProviderModal('whatsapp')} className="text-primary-600 font-medium hover:underline mt-2">
                    Add your first provider
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {whatsappProviders.map(p => renderProviderCard('whatsapp', p))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Provider Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowProviderModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-surface-200">
              <h2 className="text-xl font-bold text-navy-900">
                {editingProvider ? 'Edit Provider' : `Add ${providerType.charAt(0).toUpperCase() + providerType.slice(1)} Provider`}
              </h2>
            </div>
            <div className="p-6">
              {renderProviderForm()}
            </div>
            <div className="p-6 border-t border-surface-200 flex justify-end gap-3">
              <button onClick={() => setShowProviderModal(false)} className="btn-outline">Cancel</button>
              <button onClick={saveProvider} className="btn-primary">
                {editingProvider ? 'Update' : 'Add'} Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
