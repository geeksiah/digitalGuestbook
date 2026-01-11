'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PaymentGateway {
  id: string;
  name: string;
  gateway: string;
  description?: string;
  isActive: boolean;
  isLive: boolean;
  currency: string;
  stripePublicKey?: string;
  paystackPublicKey?: string;
  flutterwavePublicKey?: string;
  // ... other fields
}

export default function PaymentGatewaysPage() {
  const router = useRouter();
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      const response = await fetch('/api/payment-gateways', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setGateways(data.gateways || []);
      }
    } catch (error) {
      console.error('Failed to fetch gateways:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment gateway?')) return;

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/payment-gateways/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (response.ok) {
        fetchGateways();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to delete gateway');
      }
    } catch (error) {
      console.error('Failed to delete gateway:', error);
      alert('Failed to delete gateway');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading payment gateways...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Payment Gateways</h1>
        <button
          onClick={() => {
            setEditingGateway(null);
            setShowCreateModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Gateway
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gateway
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mode
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Currency
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {gateways.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No payment gateways configured. Click "Add Gateway" to create one.
                </td>
              </tr>
            ) : (
              gateways.map((gateway) => (
                <tr key={gateway.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{gateway.name}</div>
                    {gateway.description && (
                      <div className="text-sm text-gray-500">{gateway.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {gateway.gateway}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        gateway.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {gateway.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        gateway.isLive
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {gateway.isLive ? 'Live' : 'Test'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {gateway.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setEditingGateway(gateway);
                        setShowCreateModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(gateway.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <PaymentGatewayModal
          gateway={editingGateway}
          onClose={() => {
            setShowCreateModal(false);
            setEditingGateway(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingGateway(null);
            fetchGateways();
          }}
        />
      )}
    </div>
  );
}

function PaymentGatewayModal({
  gateway,
  onClose,
  onSuccess,
}: {
  gateway: PaymentGateway | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: gateway?.name || '',
    gateway: gateway?.gateway || 'stripe',
    description: gateway?.description || '',
    isActive: gateway?.isActive ?? true,
    isLive: gateway?.isLive ?? false,
    currency: gateway?.currency || 'USD',
    // Stripe
    stripePublicKey: gateway?.stripePublicKey || '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    // Paystack
    paystackPublicKey: gateway?.paystackPublicKey || '',
    paystackSecretKey: '',
    // Flutterwave
    flutterwavePublicKey: gateway?.flutterwavePublicKey || '',
    flutterwaveSecretKey: '',
    // MTN MoMo
    mtnMomoApiKey: '',
    mtnMomoApiSecret: '',
    mtnMomoSubscriptionKey: '',
    mtnMomoEnvironment: 'sandbox' as 'sandbox' | 'production',
    // Telecel Cash
    telecelCashApiKey: '',
    telecelCashApiSecret: '',
    telecelCashMerchantId: '',
    // Airteltigo Cash
    airteltigoCashApiKey: '',
    airteltigoCashApiSecret: '',
    airteltigoCashMerchantId: '',
    // Custom
    customGatewayName: '',
    customGatewayApiUrl: '',
    customGatewayApiKey: '',
    customGatewayApiSecret: '',
    customGatewayConfig: '',
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = gateway
        ? `${API_BASE_URL}/api/payment-gateways/${gateway.id}`
        : `${API_BASE_URL}/api/payment-gateways`;
      const method = gateway ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to save gateway');
      }
    } catch (error) {
      console.error('Failed to save gateway:', error);
      alert('Failed to save gateway');
    } finally {
      setSaving(false);
    }
  };

  const renderGatewayFields = () => {
    switch (formData.gateway) {
      case 'stripe':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Public Key</label>
              <input
                type="text"
                value={formData.stripePublicKey}
                onChange={(e) => setFormData({ ...formData, stripePublicKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder="pk_live_..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Secret Key</label>
              <input
                type="password"
                value={formData.stripeSecretKey}
                onChange={(e) => setFormData({ ...formData, stripeSecretKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder={gateway ? 'Leave blank to keep current' : 'sk_live_...'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Webhook Secret</label>
              <input
                type="password"
                value={formData.stripeWebhookSecret}
                onChange={(e) => setFormData({ ...formData, stripeWebhookSecret: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder={gateway ? 'Leave blank to keep current' : 'whsec_...'}
              />
            </div>
          </>
        );
      case 'paystack':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Public Key</label>
              <input
                type="text"
                value={formData.paystackPublicKey}
                onChange={(e) => setFormData({ ...formData, paystackPublicKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder="pk_live_..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Secret Key</label>
              <input
                type="password"
                value={formData.paystackSecretKey}
                onChange={(e) => setFormData({ ...formData, paystackSecretKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder={gateway ? 'Leave blank to keep current' : 'sk_live_...'}
              />
            </div>
          </>
        );
      case 'flutterwave':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Public Key</label>
              <input
                type="text"
                value={formData.flutterwavePublicKey}
                onChange={(e) => setFormData({ ...formData, flutterwavePublicKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder="FLWPUBK_..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Secret Key</label>
              <input
                type="password"
                value={formData.flutterwaveSecretKey}
                onChange={(e) => setFormData({ ...formData, flutterwaveSecretKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder={gateway ? 'Leave blank to keep current' : 'FLWSECK_...'}
              />
            </div>
          </>
        );
      case 'mtn_momo':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">API Key</label>
              <input
                type="text"
                value={formData.mtnMomoApiKey}
                onChange={(e) => setFormData({ ...formData, mtnMomoApiKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">API Secret</label>
              <input
                type="password"
                value={formData.mtnMomoApiSecret}
                onChange={(e) => setFormData({ ...formData, mtnMomoApiSecret: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder={gateway ? 'Leave blank to keep current' : ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Subscription Key</label>
              <input
                type="text"
                value={formData.mtnMomoSubscriptionKey}
                onChange={(e) => setFormData({ ...formData, mtnMomoSubscriptionKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Environment</label>
              <select
                value={formData.mtnMomoEnvironment}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mtnMomoEnvironment: e.target.value as 'sandbox' | 'production',
                  })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </div>
          </>
        );
      case 'telecel_cash':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">API Key</label>
              <input
                type="text"
                value={formData.telecelCashApiKey}
                onChange={(e) => setFormData({ ...formData, telecelCashApiKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">API Secret</label>
              <input
                type="password"
                value={formData.telecelCashApiSecret}
                onChange={(e) => setFormData({ ...formData, telecelCashApiSecret: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder={gateway ? 'Leave blank to keep current' : ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Merchant ID</label>
              <input
                type="text"
                value={formData.telecelCashMerchantId}
                onChange={(e) => setFormData({ ...formData, telecelCashMerchantId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
          </>
        );
      case 'airteltigo_cash':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">API Key</label>
              <input
                type="text"
                value={formData.airteltigoCashApiKey}
                onChange={(e) => setFormData({ ...formData, airteltigoCashApiKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">API Secret</label>
              <input
                type="password"
                value={formData.airteltigoCashApiSecret}
                onChange={(e) => setFormData({ ...formData, airteltigoCashApiSecret: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder={gateway ? 'Leave blank to keep current' : ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Merchant ID</label>
              <input
                type="text"
                value={formData.airteltigoCashMerchantId}
                onChange={(e) => setFormData({ ...formData, airteltigoCashMerchantId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
          </>
        );
      case 'custom':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gateway Name</label>
              <input
                type="text"
                value={formData.customGatewayName}
                onChange={(e) => setFormData({ ...formData, customGatewayName: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder="Custom Gateway"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">API URL</label>
              <input
                type="url"
                value={formData.customGatewayApiUrl}
                onChange={(e) => setFormData({ ...formData, customGatewayApiUrl: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder="https://api.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">API Key</label>
              <input
                type="text"
                value={formData.customGatewayApiKey}
                onChange={(e) => setFormData({ ...formData, customGatewayApiKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">API Secret</label>
              <input
                type="password"
                value={formData.customGatewayApiSecret}
                onChange={(e) => setFormData({ ...formData, customGatewayApiSecret: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder={gateway ? 'Leave blank to keep current' : ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Additional Config (JSON)</label>
              <textarea
                value={formData.customGatewayConfig}
                onChange={(e) => setFormData({ ...formData, customGatewayConfig: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                rows={3}
                placeholder='{"key": "value"}'
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {gateway ? 'Edit Payment Gateway' : 'Create Payment Gateway'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="Stripe Production"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Gateway Type *</label>
            <select
              required
              value={formData.gateway}
              onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="stripe">Stripe</option>
              <option value="paystack">Paystack</option>
              <option value="flutterwave">Flutterwave</option>
              <option value="paypal">PayPal</option>
              <option value="mtn_momo">MTN MoMo</option>
              <option value="telecel_cash">Telecel Cash</option>
              <option value="airteltigo_cash">Airteltigo Cash</option>
              <option value="custom">Custom Gateway</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isLive}
                  onChange={(e) => setFormData({ ...formData, isLive: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Live Mode</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Currency</label>
            <input
              type="text"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="USD"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-4">Gateway Configuration</h3>
            <div className="space-y-4">{renderGatewayFields()}</div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : gateway ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

