'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { paymentGatewaysApi } from '@/lib/api';

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
  title?: string;
  description?: string;
}

export default function PaymentGatewaySelector({
  eventId,
  onUpdate,
  title = 'Event Payment Gateways',
  description = 'Choose gateways for this event. These gateways are used by ticket checkout, gift checkout, and cash gift collections.',
}: PaymentGatewaySelectorProps) {
  const [allGateways, setAllGateways] = useState<PaymentGateway[]>([]);
  const [eventGateways, setEventGateways] = useState<EventPaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      const [gatewaysRes, eventGatewaysRes] = await Promise.all([
        paymentGatewaysApi.list(),
        paymentGatewaysApi.getEventGateways(eventId),
      ]);
      setAllGateways(gatewaysRes.data.gateways || []);
      setEventGateways(eventGatewaysRes.data.eventGateways || []);
    } catch (error) {
      console.error('Failed to fetch event gateway data:', error);
      toast.error('Failed to load payment gateways');
    } finally {
      setLoading(false);
    }
  };

  const selectedGatewayIds = useMemo(
    () => new Set(eventGateways.map((item) => item.paymentGatewayId)),
    [eventGateways]
  );

  const saveEventGateways = async (next: Array<{ paymentGatewayId: string; isActive: boolean; sortOrder: number }>) => {
    setSaving(true);
    try {
      await paymentGatewaysApi.updateEventGateways(eventId, next);
      await fetchData();
      onUpdate?.();
    } catch (error: any) {
      console.error('Failed to update event gateways:', error);
      toast.error(error?.response?.data?.error || 'Failed to update event gateways');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGateway = async (gatewayId: string, enabled: boolean) => {
    const current = eventGateways.map((item) => item.paymentGatewayId);
    const nextIds = enabled
      ? current.includes(gatewayId)
        ? current
        : [...current, gatewayId]
      : current.filter((id) => id !== gatewayId);

    const payload = nextIds.map((id, index) => ({
      paymentGatewayId: id,
      isActive: true,
      sortOrder: index,
    }));
    await saveEventGateways(payload);
  };

  const handleReorder = async (gatewayId: string, direction: 'up' | 'down') => {
    const current = [...eventGateways];
    const index = current.findIndex((item) => item.paymentGatewayId === gatewayId);
    if (index < 0) return;

    if (direction === 'up' && index > 0) {
      [current[index], current[index - 1]] = [current[index - 1], current[index]];
    } else if (direction === 'down' && index < current.length - 1) {
      [current[index], current[index + 1]] = [current[index + 1], current[index]];
    } else {
      return;
    }

    const payload = current.map((item, idx) => ({
      paymentGatewayId: item.paymentGatewayId,
      isActive: item.isActive,
      sortOrder: idx,
    }));
    await saveEventGateways(payload);
  };

  if (loading) {
    return <div className="text-center py-4 text-sm text-surface-500">Loading payment gateways...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-brand-900">{title}</h3>
        <p className="text-sm text-surface-600 mt-1">{description}</p>
      </div>

      {allGateways.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No system gateways are configured yet. Add them in{' '}
          <a href="/admin/payment-gateways" className="underline font-medium">
            Admin Payment Gateways
          </a>
          .
        </div>
      ) : (
        <div className="space-y-2">
          {allGateways.map((gateway) => {
            const isSelected = selectedGatewayIds.has(gateway.id);
            const eventGateway = eventGateways.find((item) => item.paymentGatewayId === gateway.id);

            return (
              <div
                key={gateway.id}
                className={[
                  'rounded-xl border p-4 transition-colors',
                  isSelected ? 'border-brand-300 bg-brand-50/40' : 'border-surface-200 bg-white',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleToggleGateway(gateway.id, e.target.checked)}
                      disabled={saving}
                      className="mt-1 h-4 w-4 rounded border-surface-300 text-brand-700"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-brand-900">{gateway.name}</span>
                      <span className="block text-xs text-surface-600 mt-0.5">
                        {gateway.gateway} | {gateway.currency} | {gateway.isLive ? 'Live' : 'Test'}
                      </span>
                    </span>
                  </label>

                  {isSelected && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Move up"
                        disabled={saving || eventGateway?.sortOrder === 0}
                        onClick={() => handleReorder(gateway.id, 'up')}
                        className="rounded border border-surface-300 px-2 py-1 text-xs text-surface-700 disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        disabled={saving || eventGateway?.sortOrder === eventGateways.length - 1}
                        onClick={() => handleReorder(gateway.id, 'down')}
                        className="rounded border border-surface-300 px-2 py-1 text-xs text-surface-700 disabled:opacity-40"
                      >
                        Down
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {eventGateways.length > 0 && (
        <div className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 border border-surface-200">
          {eventGateways.length} gateway(s) enabled for this event.
        </div>
      )}
    </div>
  );
}

