"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToItineraryUpdates = subscribeToItineraryUpdates;
exports.publishItineraryUpdate = publishItineraryUpdate;
const listenersByEventId = new Map();
function subscribeToItineraryUpdates(eventId, listener) {
    if (!listenersByEventId.has(eventId)) {
        listenersByEventId.set(eventId, new Set());
    }
    const listeners = listenersByEventId.get(eventId);
    listeners.add(listener);
    return () => {
        const current = listenersByEventId.get(eventId);
        if (!current)
            return;
        current.delete(listener);
        if (current.size === 0) {
            listenersByEventId.delete(eventId);
        }
    };
}
function publishItineraryUpdate(eventId, details = {}) {
    const listeners = listenersByEventId.get(eventId);
    if (!listeners || listeners.size === 0)
        return;
    const payload = {
        eventId,
        updatedAt: new Date().toISOString(),
        ...details,
    };
    for (const listener of listeners) {
        try {
            listener(payload);
        }
        catch (error) {
            console.error('[ItineraryRealtime] Listener error:', error);
        }
    }
}
//# sourceMappingURL=itineraryRealtime.js.map