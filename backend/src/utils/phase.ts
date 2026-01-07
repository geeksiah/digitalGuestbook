// Event Phase Calculator
// Per SRS Section 3: PRE_EVENT | LIVE | POST_EVENT

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
export function calculateEventPhase(event: EventForPhase): EventPhase {
  // If manual override is set, return the current phase as-is
  if (event.phaseOverride) {
    return event.phase as EventPhase;
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
export function canSubmitRsvp(phase: EventPhase): boolean {
  return phase === 'PRE_EVENT';
}

/**
 * Check if guests can access guestbook (LIVE only)
 */
export function canAccessGuestbook(phase: EventPhase): boolean {
  return phase === 'LIVE';
}

/**
 * Check if guests can check in (LIVE only)
 */
export function canCheckIn(phase: EventPhase): boolean {
  return phase === 'LIVE';
}

/**
 * Get allowed guest capabilities for a phase
 */
export function getPhaseCapabilities(phase: EventPhase): {
  canViewInvitation: boolean;
  canSubmitRsvp: boolean;
  canAccessGuestbook: boolean;
  canCheckIn: boolean;
  canViewThankYou: boolean;
} {
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
export function formatPhase(phase: EventPhase): string {
  const labels: Record<EventPhase, string> = {
    PRE_EVENT: 'Pre-Event',
    LIVE: 'Live',
    POST_EVENT: 'Post-Event',
  };
  return labels[phase];
}
