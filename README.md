# Digital Event Platform

A premium, managed digital event platform for invitations, RSVPs, check-in, and guestbooks.

## 🎯 Overview

This platform enables a complete digital event experience:

- **Custom Digital Invitations** - Beautiful, template-based invitation pages
- **RSVP Collection** - With approval gating for invitation-only events
- **Secure Check-In** - QR code and 6-digit access code verification
- **Digital Guestbook** - Video, audio, and photo capture from guests
- **Couple Portal** - Read-only RSVP visibility with approve/reject capabilities
- **Admin Dashboard** - Full event management and configuration

## 🏗️ Architecture

```
digital-event-platform/
├── backend/                 # Express.js API Server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, error handling
│   │   └── utils/          # Helpers, validation
│   ├── prisma/             # Database schema & migrations
│   └── uploads/            # Media storage
│
├── frontend/               # Next.js 14 App
│   ├── app/               # App router pages
│   │   ├── admin/         # Admin dashboard
│   │   ├── couple/        # Couple portal
│   │   └── e/[slug]/      # Public event pages
│   ├── components/        # Reusable UI
│   └── lib/               # API client, utilities
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Initialize database
npx prisma generate
npx prisma db push

# Seed initial data
npm run db:seed

# Start server
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```


## 📋 Event Phases

Each event operates in exactly one phase at a time:

| Phase | Guest Capabilities |
|-------|-------------------|
| **PRE_EVENT** | View invitation, submit RSVP |
| **LIVE** | Record messages, upload photos, check-in |
| **POST_EVENT** | View thank-you page only |

Phases can be:
- Automatically set based on event date/time
- Manually overridden by admins

## 🔐 RSVP Approval Flow

For invitation-only events (`invitationOnly = true`):

```
RSVP Submitted → Pending → Approved → Invitation Issued
                        ↘ Rejected → Neutral notification
```

**Rejection Message (Fixed per SRS):**
> "Thank you for your response. The event organizers will be in touch."

## 🎫 Invitation Pass

When an RSVP is approved, the system generates:

1. **Unique QR Code** - For scanning at check-in
2. **6-Digit Access Code** - For manual entry
3. **PDF Invitation Card** - Downloadable/printable

## 📱 Check-In System

Two verification methods:
- QR code scan (tablet/phone camera)
- Manual 6-digit code entry

Validation rules:
- Code must be valid, approved, and unused
- Duplicate check-ins are blocked

## 🎬 Guestbook

During LIVE phase:
- Video messages (30-120 seconds)
- Audio messages (30-120 seconds)
- Photo uploads (plan-based limits)

**Access Modes:**
- Personal device (`/e/{slug}/guestbook`)
- Booth mode (`/e/{slug}/booth`) - kiosk-style, auto-reset

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/me` - Get current admin

### Events
- `GET /api/events` - List events
- `POST /api/events` - Create event
- `PATCH /api/events/:id` - Update event
- `POST /api/events/:id/phase` - Set phase

### RSVPs
- `POST /api/rsvp/:eventSlug` - Submit RSVP (public)
- `GET /api/rsvp/event/:eventId` - List RSVPs
- `POST /api/rsvp/:id/review` - Approve/reject

### Check-In
- `POST /api/checkin/:eventId` - Check in guest
- `GET /api/checkin/:eventId/stats` - Get stats

### Guestbook
- `POST /api/guestbook/:eventId/upload` - Upload media
- `GET /api/guestbook/:eventId/quota` - Check quota

### Couple Portal
- `GET /api/couple/event` - Get event data
- `GET /api/couple/rsvps` - List RSVPs
- `POST /api/couple/rsvps/:id/approve` - Approve RSVP
- `POST /api/couple/rsvps/:id/reject` - Reject RSVP

## 🗄️ Database Schema

Core models:
- **Admin** - Platform operators
- **Event** - Event configuration and metadata
- **Template** - HTML/CSS/JS page templates
- **RSVP** - Guest responses
- **Invitation** - Generated passes
- **CheckIn** - Check-in records
- **MediaAsset** - Guestbook uploads
- **AuditLog** - Activity tracking

## 🎨 Template System

Templates are pure HTML/CSS/JS bundles with variable injection:

```html
<h1>{{event.name}}</h1>
<p>{{event.formattedDate}}</p>
<a href="{{urls.rsvp}}">RSVP Now</a>
```

Template types:
- INVITATION - Event landing page
- RSVP - RSVP form page
- GUESTBOOK - Message recording
- THANK_YOU - Post-event page

## 🔒 Security

- JWT-based admin authentication
- Token-based couple portal access
- Rate limiting on all endpoints
- Input validation with Zod
- No guest authentication required

## 📈 Non-Functional Requirements

- ✅ Mobile-first design
- ✅ Lightweight page loads
- ✅ Graceful offline handling
- ✅ Upload retry logic
- ✅ Audit logging
- ✅ Rate limiting

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express
- TypeScript
- Prisma ORM
- SQLite (dev) / PostgreSQL (prod)
- PDFKit for invitation cards
- QRCode for QR generation

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- React Query
- Zustand

## 📝 License

Proprietary - All rights reserved.

## 🤝 Support

For support, please contact the platform administrator.
