export type EventPhase = 'PRE_EVENT' | 'LIVE' | 'POST_EVENT';
interface EventForPhase {
    date: Date;
    endDate: Date | null;
    phase: string;
    phaseOverride: boolean;
}
/**
 * Calculate the current phase of an event based on date/time
 * If phaseOverride is true, return the manually set phase
 *
 * Logic per SRS:
 * - PRE_EVENT: Before event start date
 * - LIVE: During event (from start to end)
 * - POST_EVENT: After event end date
 */
export declare function calculateEventPhase(event: EventForPhase): EventPhase;
/**
 * Check if guests can access RSVP (PRE_EVENT only)
 */
export declare function canSubmitRsvp(phase: EventPhase): boolean;
/**
 * Check if guests can access guestbook (LIVE only)
 */
export declare function canAccessGuestbook(phase: EventPhase): boolean;
/**
 * Check if guests can check in (LIVE only)
 */
export declare function canCheckIn(phase: EventPhase): boolean;
/**
 * Get allowed guest capabilities for a phase
 */
export declare function getPhaseCapabilities(phase: EventPhase): {
    canViewInvitation: boolean;
    canSubmitRsvp: boolean;
    canAccessGuestbook: boolean;
    canCheckIn: boolean;
    canViewThankYou: boolean;
};
/**
 * Format phase for display
 */
export declare function formatPhase(phase: EventPhase): string;
export {};
//# sourceMappingURL=phase.d.ts.map