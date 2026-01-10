# Backend Route Registration

Add the couple routes to your main Express app file (e.g., `backend/src/index.ts` or `backend/src/app.ts`).

## Step 1: Import the route

```typescript
import coupleRoutes from './routes/couple';
```

## Step 2: Register the route (WITHOUT authentication middleware)

The couple routes handle their own authentication using the URL token, so they should NOT use your admin authentication middleware.

```typescript
// Public routes (no auth required)
app.use('/api/public', publicRoutes);

// Couple portal routes (uses URL token for auth - no middleware needed)
app.use('/api/couple', coupleRoutes);

// Admin routes (requires authentication)
app.use('/api/events', authenticateAdmin, eventsRoutes);
app.use('/api/templates', authenticateAdmin, templatesRoutes);
// ... other admin routes
```

## Important Notes

1. **Do NOT apply `authenticateAdmin` or `authenticateCouple` middleware** to the `/api/couple` routes - the routes handle their own token validation internally.

2. The token in the URL (`/api/couple/:token`) is the `coupleAccessToken` stored in the Event model.

3. Make sure your Event model has the `coupleAccessToken` field:

```prisma
model Event {
  id                String   @id @default(uuid())
  coupleAccessToken String   @unique @default(uuid())
  // ... other fields
}
```

## Example Full Setup

```typescript
import express from 'express';
import cors from 'cors';

// Import routes
import publicRoutes from './routes/public';
import coupleRoutes from './routes/couple';
import eventsRoutes from './routes/events';
import templatesRoutes from './routes/templates';
import rsvpRoutes from './routes/rsvp';
import mediaRoutes from './routes/media';
import checkInRoutes from './routes/checkin';
import guestbookRoutes from './routes/guestbook';

// Import middleware
import { authenticateAdmin } from './middleware/auth';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================
app.use('/api/public', publicRoutes);
app.use('/api/guestbook', guestbookRoutes);

// ============================================
// COUPLE PORTAL ROUTES (Token in URL for auth)
// ============================================
app.use('/api/couple', coupleRoutes);  // <-- NO MIDDLEWARE HERE

// ============================================
// ADMIN ROUTES (Requires authentication)
// ============================================
app.use('/api/events', authenticateAdmin, eventsRoutes);
app.use('/api/templates', authenticateAdmin, templatesRoutes);
app.use('/api/rsvps', authenticateAdmin, rsvpRoutes);
app.use('/api/media', authenticateAdmin, mediaRoutes);
app.use('/api/checkins', authenticateAdmin, checkInRoutes);

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```
