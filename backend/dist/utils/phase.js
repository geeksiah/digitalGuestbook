"use strict";
// Event Phase Calculator
// Per SRS Section 3: PRE_EVENT | LIVE | POST_EVENT
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEventPhase = calculateEventPhase;
exports.canSubmitRsvp = canSubmitRsvp;
exports.canAccessGuestbook = canAccessGuestbook;
exports.canCheckIn = canCheckIn;
exports.getPhaseCapabilities = getPhaseCapabilities;
exports.formatPhase = formatPhase;
/**
 * Calculate the current phase of an event based on date/time
 * If phaseOverride is true, return the manually set phase
 *
 * Logic per SRS:
 * - PRE_EVENT: Before event start date
 * - LIVE: During event (from start to end)
 * - POST_EVENT: After event end date
 */
function calculateEventPhase(event) {
    // If manual override is set, return the current phase as-is
    if (event.phaseOverride) {
        return event.phase;
    }
    const now = new Date();
    const eventStart = new Date(event.date);
    const eventEnd = event.endDate ? new Date(event.endDate) : null;
    // Before event start
    if (now < eventStart) {
        return 'PRE_EVENT';
    }
    // If no end date, assume single-day event ending at midnight
    if (!eventEnd) {
        const eventEndOfDay = new Date(eventStart);
        eventEndOfDay.setHours(23, 59, 59, 999);
        if (now <= eventEndOfDay) {
            return 'LIVE';
        }
        return 'POST_EVENT';
    }
    // During event
    if (now >= eventStart && now <= eventEnd) {
        return 'LIVE';
    }
    // After event
    return 'POST_EVENT';
}
/**
 * Check if guests can access RSVP (PRE_EVENT only)
 */
function canSubmitRsvp(phase) {
    return phase === 'PRE_EVENT';
}
/**
 * Check if guests can access guestbook (LIVE only)
 */
function canAccessGuestbook(phase) {
    return phase === 'LIVE';
}
/**
 * Check if guests can check in (LIVE only)
 */
function canCheckIn(phase) {
    return phase === 'LIVE';
}
/**
 * Get allowed guest capabilities for a phase
 */
function getPhaseCapabilities(phase) {
    switch (phase) {
        case 'PRE_EVENT':
            return {
                canViewInvitation: true,
                canSubmitRsvp: true,
                canAccessGuestbook: false,
                canCheckIn: false,
                canViewThankYou: false,
            };
        case 'LIVE':
            return {
                canViewInvitation: true,
                canSubmitRsvp: false,
                canAccessGuestbook: true,
                canCheckIn: true,
                canViewThankYou: false,
            };
        case 'POST_EVENT':
            return {
                canViewInvitation: false,
                canSubmitRsvp: false,
                canAccessGuestbook: false,
                canCheckIn: false,
                canViewThankYou: true,
            };
    }
}
/**
 * Format phase for display
 */
function formatPhase(phase) {
    const labels = {
        PRE_EVENT: 'Pre-Event',
        LIVE: 'Live',
        POST_EVENT: 'Post-Event',
    };
    return labels[phase];
}
//# sourceMappingURL=phase.js.map