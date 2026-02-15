type ItineraryUpdatePayload = {
    eventId: string;
    updatedAt: string;
    reason?: string;
    itemId?: string;
    isCompleted?: boolean;
};
type ItineraryUpdateListener = (payload: ItineraryUpdatePayload) => void;
export declare function subscribeToItineraryUpdates(eventId: string, listener: ItineraryUpdateListener): () => void;
export declare function publishItineraryUpdate(eventId: string, details?: Omit<ItineraryUpdatePayload, 'eventId' | 'updatedAt'>): void;
export {};
//# sourceMappingURL=itineraryRealtime.d.ts.map