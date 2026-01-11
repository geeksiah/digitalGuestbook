'use client';

import { useState, useEffect } from 'react';

interface PaymentGateway {
  id: string;
  name: string;
  gateway: string;
  isActive: boolean;
  isLive: boolean;
  currency: string;
}

interface EventPaymentGateway {
  id: string;
  paymentGatewayId: string;
  isActive: boolean;
  sortOrder: number;
  paymentGateway: PaymentGateway;
}

interface PaymentGatewaySelectorProps {
  eventId: string;
  onUpdate?: () => void;
}

export default function PaymentGatewaySelector({
  eventId,
  onUpdate,
}: PaymentGatewaySelectorProps) {
  const [allGateways, setAllGateways] = useState<PaymentGateway[]>([]);
  const [eventGateways, setEventGateways] = useState<EventPaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('admin_token');

      const [gatewaysRes, eventGatewaysRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/payment-gateways`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/payment-gateways/events/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (gatewaysRes.ok) {
        const gatewaysData = await gatewaysRes.json();
        setAllGateways(gatewaysData.gateways || []);
      }

      if (eventGatewaysRes.ok) {
        const eventData = await eventGatewaysRes.json();
        setEventGateways(eventData.eventGateways || []);
      }
    } catch (error) {
      console.error('Failed to fetch gateways:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGateway = async (gatewayId: string, enabled: boolean) => {
    setSaving(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('admin_token');

      // Get current event gateways
      const currentSelected = eventGateways.map((eg) => eg.paymentGatewayId);
      
      let updatedSelected: string[];
      if (enabled) {
        // Add gateway if not already selected
        if (!currentSelected.includes(gatewayId)) {
          updatedSelected = [...currentSelected, gatewayId];
        } else {
          updatedSelected = currentSelected;
        }
      } else {
        // Remove gateway
        updatedSelected = currentSelected.filter((id) => id !== gatewayId);
      }

      // Update event gateways
      const gatewayIds = updatedSelected.map((id, index) => ({
        paymentGatewayId: id,
        isActive: true,
        sortOrder: index,
      }));

      const response = await fetch(
        `${API_BASE_URL}/api/payment-gateways/events/${eventId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ gatewayIds }),
        }
      );

      if (response.ok) {
        await fetchData();
        onUpdate?.();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update gateways');
      }
    } catch (error) {
      console.error('Failed to update gateways:', error);
      alert('Failed to update gateways');
    } finally {
      setSaving(false);
    }
  };

  const handleReorder = async (gatewayId: string, direction: 'up' | 'down') => {
    setSaving(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('admin_token');

      const current = [...eventGateways];
      const index = current.findIndex((eg) => eg.paymentGatewayId === gatewayId);
      
      if (index === -1) return;

      if (direction === 'up' && index > 0) {
        [current[index], current[index - 1]] = [current[index - 1], current[index]];
      } else if (direction === 'down' && index < current.length - 1) {
        [current[index], current[index + 1]] = [current[index + 1], current[index]];
      } else {
        setSaving(false);
        return;
      }

      const gatewayIds = current.map((eg, idx) => ({
        paymentGatewayId: eg.paymentGatewayId,
        isActive: eg.isActive,
        sortOrder: idx,
      }));

      const response = await fetch(
        `${API_BASE_URL}/api/payment-gateways/events/${eventId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ gatewayIds }),
        }
      );

      if (response.ok) {
        await fetchData();
        onUpdate?.();
      }
    } catch (error) {
      console.error('Failed to reorder gateways:', error);
      alert('Failed to reorder gateways');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading payment gateways...</div>;
  }

  const selectedGatewayIds = new Set(eventGateways.map((eg) => eg.paymentGatewayId));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">Payment Gateways</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select which payment gateways are available for this event. Users will see these options
          when purchasing tickets.
        </p>
      </div>

      {allGateways.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-sm text-yellow-800">
            No payment gateways configured. Please configure payment gateways in{' '}
            <a
              href="/admin/payment-gateways"
              className="underline font-medium"
              target="_blank"
            >
              Payment Gateways
            </a>{' '}
            first.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {allGateways.map((gateway) => {
            const isSelected = selectedGatewayIds.has(gateway.id);
            const eventGateway = eventGateways.find((eg) => eg.paymentGatewayId === gateway.id);

            return (
              <div
                key={gateway.id}
                className={`border rounded-lg p-4 ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleToggleGateway(gateway.id, e.target.checked)}
                      disabled={saving}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <div>
                      <div className="font-medium">{gateway.name}</div>
                      <div className="text-sm text-gray-500">
                        {gateway.gateway} • {gateway.currency} •{' '}
                        {gateway.isLive ? 'Live' : 'Test'} Mode
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleReorder(gateway.id, 'up')}
                        disabled={saving || eventGateway?.sortOrder === 0}
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleReorder(gateway.id, 'down')}
                        disabled={
                          saving ||
                          eventGateway?.sortOrder === eventGateways.length - 1
                        }
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <span className="text-xs text-gray-500">
                        Order: {eventGateway?.sortOrder !== undefined ? eventGateway.sortOrder + 1 : '-'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {eventGateways.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-600">
            <strong>Selected gateways:</strong> {eventGateways.length} gateway(s) will be
            available for ticket purchases. The order determines the display sequence.
          </p>
        </div>
      )}
    </div>
  );
}

