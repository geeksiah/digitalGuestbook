'use client';

import { cn, getErrorMessage } from '@/lib/utils';

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
      toast.error(getErrorMessage(error, 'Failed to update event gateways'));
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
    return (
      <div className="space-y-2" role="status" aria-label="Loading payment gateways">
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title ? <h3 className="panel-title">{title}</h3> : null}
      {description ? <p className="meta">{description}</p> : null}

      {allGateways.length === 0 ? (
        <div className="banner-warning" role="status">
          <span>
            No gateways are set up yet. Add one in{' '}
            <a href="/admin/payment-gateways" className="font-semibold underline">
              Payment gateways
            </a>
            .
          </span>
        </div>
      ) : (
        <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200">
          {allGateways.map((gateway) => {
            const isSelected = selectedGatewayIds.has(gateway.id);
            const eventGateway = eventGateways.find((item) => item.paymentGatewayId === gateway.id);
            const inputId = `event-gateway-${gateway.id}`;

            return (
              <div key={gateway.id} className={cn('flex items-center gap-3 px-4 py-3', isSelected && 'bg-brand-50/50')}>
                <input
                  id={inputId}
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => handleToggleGateway(gateway.id, e.target.checked)}
                  disabled={saving}
                  className="shrink-0"
                />
                <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block truncate text-sm font-semibold text-brand-900">{gateway.name}</span>
                  <span className="block truncate text-[13px] text-surface-600">
                    {gateway.gateway} &middot; {gateway.currency} &middot; {gateway.isLive ? 'Live' : 'Test'}
                  </span>
                </label>

                {isSelected ? (
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      aria-label={`Move ${gateway.name} up`}
                      title="Move up"
                      disabled={saving || eventGateway?.sortOrder === 0}
                      onClick={() => handleReorder(gateway.id, 'up')}
                      className="icon-btn icon-btn-sm"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 15 7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${gateway.name} down`}
                      title="Move down"
                      disabled={saving || eventGateway?.sortOrder === eventGateways.length - 1}
                      onClick={() => handleReorder(gateway.id, 'down')}
                      className="icon-btn icon-btn-sm"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {eventGateways.length > 0 ? (
        <p className="meta num">
          {eventGateways.length} {eventGateways.length === 1 ? 'gateway' : 'gateways'} enabled. Guests see them in this
          order.
        </p>
      ) : null}
    </div>
  );
}
