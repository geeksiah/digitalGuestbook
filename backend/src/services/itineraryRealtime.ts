type ItineraryUpdatePayload = {
  eventId: string;
  updatedAt: string;
  reason?: string;
  itemId?: string;
  isCompleted?: boolean;
};

type ItineraryUpdateListener = (payload: ItineraryUpdatePayload) => void;

const listenersByEventId = new Map<string, Set<ItineraryUpdateListener>>();

export function subscribeToItineraryUpdates(eventId: string, listener: ItineraryUpdateListener): () => void {
  if (!listenersByEventId.has(eventId)) {
    listenersByEventId.set(eventId, new Set());
  }

  const listeners = listenersByEventId.get(eventId)!;
  listeners.add(listener);

  return () => {
    const current = listenersByEventId.get(eventId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listenersByEventId.delete(eventId);
    }
  };
}

export function publishItineraryUpdate(
  eventId: string,
  details: Omit<ItineraryUpdatePayload, 'eventId' | 'updatedAt'> = {}
) {
  const listeners = listenersByEventId.get(eventId);
  if (!listeners || listeners.size === 0) return;

  const payload: ItineraryUpdatePayload = {
    eventId,
    updatedAt: new Date().toISOString(),
    ...details,
  };

  for (const listener of listeners) {
    try {
      listener(payload);
    } catch (error) {
      console.error('[ItineraryRealtime] Listener error:', error);
    }
  }
}
