# Digital Event Platform - Developer Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [API Documentation](#api-documentation)
6. [Database Schema](#database-schema)
7. [Authentication & Authorization](#authentication--authorization)
8. [Template System](#template-system)
9. [Payment Integration](#payment-integration)
10. [Notification System](#notification-system)
11. [Owner Wallet System](#owner-wallet-system)
12. [Deployment](#deployment)
13. [Contributing](#contributing)

## Architecture Overview

The Digital Event Platform is a full-stack web application built with:
- **Backend**: Node.js + Express.js + TypeScript
- **Frontend**: Next.js 14 (App Router) + React + TypeScript
- **Database**: PostgreSQL (via Prisma ORM)
- **Storage**: Supabase Storage (for media files)

### System Components

1. **Admin Dashboard** - Full platform management
2. **Owner Dashboard** - Event owner portal for managing events
3. **Public Event Pages** - Guest-facing pages (invitations, RSVP, guestbook)
4. **API Server** - RESTful API for all operations

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL (Supabase)
- **Authentication**: JWT (admin), Token-based (owner portal)
- **File Storage**: Supabase Storage
- **Email/SMS/WhatsApp**: Multi-provider support

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL database (or Supabase account)
- Supabase account (for storage)

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database
npx prisma generate
npx prisma db push

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment
# Create .env.local with NEXT_PUBLIC_API_URL=http://localhost:3001

# Start development server
npm run dev
```

## Project Structure

```
digital-event-platform/
├── backend/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth, error handling
│   │   └── utils/           # Helpers, validation
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── migrations/      # Database migrations
│   └── templates/           # Template storage
│
├── frontend/
│   ├── app/                 # Next.js app router pages
│   │   ├── admin/          # Admin dashboard
│   │   ├── owner/          # Owner dashboard
│   │   └── e/[slug]/       # Public event pages
│   ├── components/         # Reusable components
│   └── lib/                # Utilities, API client
│
└── public/                  # Static assets
```

## API Documentation

### Authentication Endpoints

#### Admin Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/me` - Get current admin

#### Owner Authentication
- `POST /api/owner-auth/register` - Owner registration
- `POST /api/owner-auth/login` - Owner login
- `GET /api/owner-auth/me` - Get current owner
- `PUT /api/owner-auth/profile` - Update owner profile

### Event Endpoints

- `GET /api/events` - List events
- `POST /api/events` - Create event
- `GET /api/events/:id` - Get event details
- `PATCH /api/events/:id` - Update event
- `POST /api/events/:id/phase` - Set event phase
- `POST /api/events/:id/archive` - Archive event

### Template Endpoints

- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `POST /api/templates/upload` - Upload template ZIP
- `GET /api/templates/:id` - Get template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### RSVP Endpoints

- `POST /api/rsvp/:eventSlug` - Submit RSVP (public)
- `GET /api/rsvp/event/:eventId` - List RSVPs (admin)
- `POST /api/rsvp/:id/review` - Approve/reject RSVP

### Media/Guestbook Endpoints

- `POST /api/guestbook/:eventId/upload` - Upload media (public)
- `GET /api/media/event/:eventId` - List media (admin)
- `DELETE /api/media/:id` - Delete media

### Owner Wallet Endpoints

- `GET /api/owner-dashboard/wallet` - Get owner wallet
- `POST /api/owner-dashboard/wallet` - Update owner wallet
- `GET /api/owners/:id/wallet` - Get owner wallet (admin)
- `POST /api/owners/:id/wallet` - Update owner wallet (admin)

See [OWNER_WALLET_IMPLEMENTATION.md](./OWNER_WALLET_IMPLEMENTATION.md) for details.

## Database Schema

Key models:
- **Admin** - Platform administrators
- **Owner** - Event owners/clients
- **OwnerWallet** - Owner payout wallet configuration
- **Event** - Event configuration
- **Template** - Page templates
- **RSVP** - Guest responses
- **Invitation** - Generated invitation passes
- **CheckIn** - Check-in records
- **MediaAsset** - Guestbook uploads
- **Transaction** - Payment transactions
- **PayoutRequest** - Payout requests
- **PayoutWallet** - Event-level payout wallets

See `backend/prisma/schema.prisma` for complete schema.

## Authentication & Authorization

### Admin Authentication
- JWT-based authentication
- Token stored in localStorage (frontend)
- Token sent in `Authorization: Bearer <token>` header
- Expires after configured time (default: 24 hours)

### Owner Authentication
- JWT-based authentication (for owner accounts)
- Token-based access (for event owner portal via access token)
- Owner portal uses token from URL parameter

### Authorization Middleware
- `authenticateAdmin` - Admin routes
- `authenticateOwnerAccount` - Owner account routes
- `validateOwnerToken` - Event owner portal routes

## Template System

Templates are HTML/CSS/JS bundles that customize event pages.

### Template Types
- INVITATION, RSVP, GUESTBOOK, BOOTH, THANK_YOU
- GUESTBOOK_VIDEO, GUESTBOOK_AUDIO, GUESTBOOK_PHOTO
- BOOTH_VIDEO, BOOTH_AUDIO, BOOTH_PHOTO

### Template Variables
Templates support variable injection: `{{variable.name}}`

See [TEMPLATE_DEVELOPER_GUIDE.md](./TEMPLATE_DEVELOPER_GUIDE.md) for details.

## Payment Integration

### Payment Gateways
- Stripe
- Paystack
- PayPal
- Mobile Money (MTN, Airtel, M-Pesa)
- Custom gateways

### Payment Flow
1. Guest selects ticket type
2. Payment gateway configured for event
3. Payment processed via selected gateway
4. Transaction recorded
5. RSVP automatically approved on successful payment

### Payout System
- Event-level payout wallets (PayoutWallet)
- Owner-level payout wallets (OwnerWallet)
- Payout requests (PayoutRequest)
- Admin processes payouts

## Notification System

### Supported Channels
- Email (SMTP, SendGrid, Mailgun)
- SMS (Twilio, Termii, Arkesel)
- WhatsApp (Twilio, Meta)

### Notification Triggers
- RSVP submissions
- RSVP approvals/rejections
- Check-ins
- Payout processed
- Payout rejected

### Notification Configuration
- System-wide providers
- Event-level notification settings
- Owner notification preferences

## Owner Wallet System

Owners can set up payout wallets for receiving payments across all events.

### Features
- Multiple payment methods (bank, mobile, PayPal, Stripe, Paystack)
- Admin can set up wallet on behalf of owner
- Owner can manage their own wallet
- Wallet verification status
- Auto-payout configuration

See [OWNER_WALLET_IMPLEMENTATION.md](./OWNER_WALLET_IMPLEMENTATION.md) for details.

## Deployment

### Backend Deployment
1. Set environment variables
2. Run database migrations: `npx prisma migrate deploy`
3. Generate Prisma client: `npx prisma generate`
4. Build: `npm run build`
5. Start: `npm start`

### Frontend Deployment
1. Set environment variables
2. Build: `npm run build`
3. Start: `npm start`

### Environment Variables

**Backend:**
- `DATABASE_URL` - PostgreSQL connection string
- `DIRECT_URL` - Direct database URL (for migrations)
- `JWT_SECRET` - JWT signing secret
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service key

**Frontend:**
- `NEXT_PUBLIC_API_URL` - Backend API URL

See `.env.example` files for complete list.

## Contributing

### Code Style
- TypeScript strict mode
- ESLint configuration
- Prettier formatting (recommended)

### Git Workflow
1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

### Testing
- Manual testing required (no automated tests yet)
- Test on development environment
- Verify database migrations
- Test API endpoints

## Additional Resources

- [Template Developer Guide](./TEMPLATE_DEVELOPER_GUIDE.md)
- [Owner Wallet Implementation](./OWNER_WALLET_IMPLEMENTATION.md)
- [Production Audit](./PRODUCTION_AUDIT.md)
- [Deployment Guide](./backend/DEPLOYMENT.md)

## Support

For questions or issues, contact the platform administrator or refer to the documentation.

