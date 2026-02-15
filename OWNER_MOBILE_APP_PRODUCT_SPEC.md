# Event Owner Hybrid Mobile App Spec

## Goal

Ship a dedicated installable owner app for iOS and Android, while keeping the current web app.

## Product direction

- Fast operational workflows for event owners.
- Clear and elegant UI with low cognitive load.
- Simple architecture that reuses existing backend endpoints.
- Stability over feature complexity.

## IA and navigation

- Onboarding (first launch only)
- Auth (sign in, sign up, set password, reset request)
- Home tab (KPI and priority events)
- Events tab:
  - Event list/search/filter
  - Event detail operations: overview, RSVP review, check-in, media, tickets, itinerary, WhatsApp invites, domains, gifts
- Payouts tab (request + status tracking + balances)
- Account tab (profile, password, wallet/paystack, logout)

## UX principles

- One major action per screen section.
- High-contrast typography and clear status chips.
- Fast refresh via pull-to-refresh in operational views.
- Meaningful motion only (load-in transitions, no noisy effects).

## Technical strategy

- Stack: Ionic React + Capacitor.
- App module: `owner-mobile/`.
- API usage:
  - `/api/owner-auth/*`
  - `/api/owner-dashboard/*`
- Session: persisted token + owner profile bootstrap on app launch.

## Release plan

1. Stabilize onboarding/auth and session recovery.
2. Validate core owner ops on real devices (Android first, then iOS).
3. Add push notifications for critical owner actions (phase 2).
4. Add offline queue for lightweight write actions (phase 2).
