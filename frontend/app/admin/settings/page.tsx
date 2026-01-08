'use client';

import { useState, useEffect } from 'react';
import { settingsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface SystemSettings {
  id: string;
  // Email
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string | null;
  smtpFromName: string | null;
  smtpSecure: boolean;
  // SMS
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioPhoneNumber: string | null;
  // WhatsApp
  whatsappApiKey: string | null;
  whatsappPhoneId: string | null;
  whatsappBusinessId: string | null;
  // General
  siteName: string;
  siteUrl: string | null;
  logoUrl: string | null;
  // Toggles
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
}

type Tab = 'general' | 'email' | 'sms' | 'whatsapp';

const Icons = {
  save: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  email: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  phone: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  whatsapp: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  settings: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  test: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsApi.get();
      setSettings(response.data.settings);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const response = await settingsApi.update(settings);
      setSettings(response.data.settings);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('Enter an email address');
      return;
    }
    setTesting('email');
    try {
      await settingsApi.testEmail(testEmail);
      toast.success('Test email sent!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send test email');
    } finally {
      setTesting(null);
    }
  };

  const handleTestSMS = async () => {
    if (!testPhone) {
      toast.error('Enter a phone number');
      return;
    }
    setTesting('sms');
    try {
      await settingsApi.testSMS(testPhone);
      toast.success('Test SMS sent!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send test SMS');
    } finally {
      setTesting(null);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testPhone) {
      toast.error('Enter a phone number');
      return;
    }
    setTesting('whatsapp');
    try {
      await settingsApi.testWhatsApp(testPhone);
      toast.success('Test WhatsApp sent!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send test WhatsApp');
    } finally {
      setTesting(null);
    }
  };

  const updateSettings = (updates: Partial<SystemSettings>) => {
    if (settings) {
      setSettings({ ...settings, ...updates });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-500">Failed to load settings</p>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Icons.settings },
    { id: 'email', label: 'Email (SMTP)', icon: Icons.email },
    { id: 'sms', label: 'SMS (Twilio)', icon: Icons.phone },
    { id: 'whatsapp', label: 'WhatsApp', icon: Icons.whatsapp },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy-900">System Settings</h1>
          <p className="text-surface-500 mt-1">Configure notifications and integrations</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : <>{Icons.save}<span className="ml-2">Save Changes</span></>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-lg p-1 border border-surface-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-md font-medium transition-colors flex-1 justify-center',
              activeTab === tab.id
                ? 'bg-navy-900 text-white'
                : 'text-surface-600 hover:bg-surface-50'
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-xl border border-surface-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-navy-900">General Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">Site Name</label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => updateSettings({ siteName: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">Site URL</label>
              <input
                type="url"
                value={settings.siteUrl || ''}
                onChange={(e) => updateSettings({ siteUrl: e.target.value || null })}
                placeholder="https://example.com"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-navy-900 mb-2">Logo URL</label>
              <input
                type="url"
                value={settings.logoUrl || ''}
                onChange={(e) => updateSettings({ logoUrl: e.target.value || null })}
                placeholder="https://example.com/logo.png"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="border-t border-surface-100 pt-6">
            <h3 className="text-sm font-semibold text-navy-900 mb-4">Notification Channels</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                settings.emailEnabled ? 'border-emerald-500 bg-emerald-50' : 'border-surface-200'
              )}>
                <input
                  type="checkbox"
                  checked={settings.emailEnabled}
                  onChange={(e) => updateSettings({ emailEnabled: e.target.checked })}
                  className="sr-only"
                />
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  settings.emailEnabled ? 'bg-emerald-500 text-white' : 'bg-surface-100 text-surface-400'
                )}>
                  {Icons.email}
                </div>
                <div>
                  <p className="font-medium text-navy-900">Email</p>
                  <p className="text-xs text-surface-500">{settings.emailEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </label>
              
              <label className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                settings.smsEnabled ? 'border-blue-500 bg-blue-50' : 'border-surface-200'
              )}>
                <input
                  type="checkbox"
                  checked={settings.smsEnabled}
                  onChange={(e) => updateSettings({ smsEnabled: e.target.checked })}
                  className="sr-only"
                />
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  settings.smsEnabled ? 'bg-blue-500 text-white' : 'bg-surface-100 text-surface-400'
                )}>
                  {Icons.phone}
                </div>
                <div>
                  <p className="font-medium text-navy-900">SMS</p>
                  <p className="text-xs text-surface-500">{settings.smsEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </label>
              
              <label className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                settings.whatsappEnabled ? 'border-green-500 bg-green-50' : 'border-surface-200'
              )}>
                <input
                  type="checkbox"
                  checked={settings.whatsappEnabled}
                  onChange={(e) => updateSettings({ whatsappEnabled: e.target.checked })}
                  className="sr-only"
                />
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  settings.whatsappEnabled ? 'bg-green-500 text-white' : 'bg-surface-100 text-surface-400'
                )}>
                  {Icons.whatsapp}
                </div>
                <div>
                  <p className="font-medium text-navy-900">WhatsApp</p>
                  <p className="text-xs text-surface-500">{settings.whatsappEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Email Settings */}
      {activeTab === 'email' && (
        <div className="bg-white rounded-xl border border-surface-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">Email Configuration (SMTP)</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-surface-600">Enable Email</span>
              <div className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                settings.emailEnabled ? 'bg-emerald-500' : 'bg-surface-300'
              )}>
                <input
                  type="checkbox"
                  checked={settings.emailEnabled}
                  onChange={(e) => updateSettings({ emailEnabled: e.target.checked })}
                  className="sr-only"
                />
                <div className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  settings.emailEnabled && 'translate-x-5'
                )} />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">SMTP Host</label>
              <input
                type="text"
                value={settings.smtpHost || ''}
                onChange={(e) => updateSettings({ smtpHost: e.target.value || null })}
                placeholder="smtp.gmail.com"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">SMTP Port</label>
              <input
                type="number"
                value={settings.smtpPort || ''}
                onChange={(e) => updateSettings({ smtpPort: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="587"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">SMTP Username</label>
              <input
                type="text"
                value={settings.smtpUser || ''}
                onChange={(e) => updateSettings({ smtpUser: e.target.value || null })}
                placeholder="your@email.com"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">SMTP Password</label>
              <input
                type="password"
                value={settings.smtpPass || ''}
                onChange={(e) => updateSettings({ smtpPass: e.target.value || null })}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">From Email</label>
              <input
                type="email"
                value={settings.smtpFrom || ''}
                onChange={(e) => updateSettings({ smtpFrom: e.target.value || null })}
                placeholder="noreply@example.com"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">From Name</label>
              <input
                type="text"
                value={settings.smtpFromName || ''}
                onChange={(e) => updateSettings({ smtpFromName: e.target.value || null })}
                placeholder="Event Platform"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="smtpSecure"
              checked={settings.smtpSecure}
              onChange={(e) => updateSettings({ smtpSecure: e.target.checked })}
              className="w-4 h-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
            />
            <label htmlFor="smtpSecure" className="text-sm text-surface-600">Use SSL/TLS (port 465)</label>
          </div>

          <div className="border-t border-surface-100 pt-6">
            <h3 className="text-sm font-semibold text-navy-900 mb-4">Test Email Configuration</h3>
            <div className="flex gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1 px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              <button
                onClick={handleTestEmail}
                disabled={testing === 'email' || !settings.emailEnabled}
                className="btn-outline disabled:opacity-50"
              >
                {testing === 'email' ? 'Sending...' : <>{Icons.test}<span className="ml-2">Send Test</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Settings */}
      {activeTab === 'sms' && (
        <div className="bg-white rounded-xl border border-surface-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">SMS Configuration (Twilio)</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-surface-600">Enable SMS</span>
              <div className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                settings.smsEnabled ? 'bg-blue-500' : 'bg-surface-300'
              )}>
                <input
                  type="checkbox"
                  checked={settings.smsEnabled}
                  onChange={(e) => updateSettings({ smsEnabled: e.target.checked })}
                  className="sr-only"
                />
                <div className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  settings.smsEnabled && 'translate-x-5'
                )} />
              </div>
            </label>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Get your Twilio credentials from{' '}
              <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                console.twilio.com
              </a>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">Account SID</label>
              <input
                type="text"
                value={settings.twilioAccountSid || ''}
                onChange={(e) => updateSettings({ twilioAccountSid: e.target.value || null })}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">Auth Token</label>
              <input
                type="password"
                value={settings.twilioAuthToken || ''}
                onChange={(e) => updateSettings({ twilioAuthToken: e.target.value || null })}
                placeholder="••••••••••••••••••••••••••••••••"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-navy-900 mb-2">Phone Number</label>
              <input
                type="tel"
                value={settings.twilioPhoneNumber || ''}
                onChange={(e) => updateSettings({ twilioPhoneNumber: e.target.value || null })}
                placeholder="+1234567890"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="border-t border-surface-100 pt-6">
            <h3 className="text-sm font-semibold text-navy-900 mb-4">Test SMS Configuration</h3>
            <div className="flex gap-3">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+1234567890"
                className="flex-1 px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              <button
                onClick={handleTestSMS}
                disabled={testing === 'sms' || !settings.smsEnabled}
                className="btn-outline disabled:opacity-50"
              >
                {testing === 'sms' ? 'Sending...' : <>{Icons.test}<span className="ml-2">Send Test</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Settings */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white rounded-xl border border-surface-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">WhatsApp Configuration</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-surface-600">Enable WhatsApp</span>
              <div className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                settings.whatsappEnabled ? 'bg-green-500' : 'bg-surface-300'
              )}>
                <input
                  type="checkbox"
                  checked={settings.whatsappEnabled}
                  onChange={(e) => updateSettings({ whatsappEnabled: e.target.checked })}
                  className="sr-only"
                />
                <div className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  settings.whatsappEnabled && 'translate-x-5'
                )} />
              </div>
            </label>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              WhatsApp uses the same Twilio credentials as SMS. Configure Twilio first, then enable WhatsApp messaging
              in your Twilio console.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">WhatsApp Phone Number</label>
              <input
                type="tel"
                value={settings.twilioPhoneNumber || ''}
                onChange={(e) => updateSettings({ twilioPhoneNumber: e.target.value || null })}
                placeholder="+1234567890"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              <p className="text-xs text-surface-500 mt-1">Same as Twilio phone number with WhatsApp enabled</p>
            </div>
          </div>

          <div className="border-t border-surface-100 pt-6">
            <h3 className="text-sm font-semibold text-navy-900 mb-4">Test WhatsApp Configuration</h3>
            <div className="flex gap-3">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+1234567890"
                className="flex-1 px-4 py-2.5 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              <button
                onClick={handleTestWhatsApp}
                disabled={testing === 'whatsapp' || !settings.whatsappEnabled}
                className="btn-outline disabled:opacity-50"
              >
                {testing === 'whatsapp' ? 'Sending...' : <>{Icons.test}<span className="ml-2">Send Test</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

