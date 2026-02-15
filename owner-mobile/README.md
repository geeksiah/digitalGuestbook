# EventPeepo Owner Mobile

Installable hybrid mobile app for event owners, built with Ionic React + Capacitor.

## Why this exists

- Keeps your existing web app untouched.
- Ships as real Android and iOS apps.
- Reuses existing backend APIs (`/api/owner-auth/*`, `/api/owner-dashboard/*`).
- Prioritizes smooth owner operations over feature bloat.

## Local setup

1. Install dependencies:

```bash
cd owner-mobile
npm install
```

2. Set API URL in `.env`:

```bash
VITE_API_BASE_URL=http://localhost:3001/api
```

3. Run dev app:

```bash
npm run dev
```

## Beginner quick start (Android live mode)

If you are testing for the first time and want one simple command:

1. Open Android Studio and start any emulator once (Device Manager).
2. From repo root, run:

```powershell
.\scripts\start-owner-mobile-android-live.ps1
```

What this script does:

- Creates `owner-mobile/.env` if missing with emulator-safe API URL.
- Starts backend API server in a new terminal.
- Starts the Vite dev server in a new terminal.
- Starts the Capacitor run command in your current terminal (so arrow-key device selection works).

If backend is already running, use:

```powershell
.\scripts\start-owner-mobile-android-live.ps1 -SkipBackend
```

If the device picker appears, use arrow keys + Enter in that same terminal.

Note: this launcher auto-selects a compatible JDK (21/23) for Gradle to avoid JDK 25 build crashes.
It also auto-detects Android SDK and writes `owner-mobile/android/local.properties` for Gradle.

## Build app package

1. Build web bundle and sync native projects:

```bash
npm run cap:sync
```

2. Open Android Studio project:

```bash
npm run cap:android
```

3. Open Xcode project (macOS required):

```bash
npm run cap:ios
```

## UX structure

- Onboarding: first-run orientation.
- Auth: login, registration, admin-created account setup, reset request.
- Home: stats + next actions.
- Events: list and full event operations (overview, RSVP review, check-in, media, tickets, itinerary, invites, domains, gifts).
- Payouts: balances, request workflow, status tracking.
- Account: profile, password, wallet settings, Paystack connect, secure logout.
