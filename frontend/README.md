# Event Platform Frontend

Premium, production-grade Next.js frontend for the digital event platform.

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS
- shadcn/ui components
- lucide-react icons
- framer-motion animations

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000` (Next.js default port).

## Environment Variables

Create a `.env.local` file in the frontend directory:

```
NEXT_PUBLIC_API_BASE=http://localhost:4000
```

## Routes

- `/` - Landing page
- `/admin` - Admin Dashboard
- `/admin/events` - Event Management
- `/admin/templates` - Template Management
- `/couple` - Couple Portal
- `/e/[slug]/guestbook` - Premium Guestbook Flow
- `/e/[slug]/booth` - Booth Mode (Kiosk)

## Build

```bash
npm run build
npm start
```

Output will be in the `.next` directory.

## Migration from Vite

If you were using the old Vite setup:
- Old server ran on port 5173
- New Next.js server runs on port 3000
- Make sure to stop any old Vite processes
- Use `http://localhost:3000` instead of `http://localhost:5173`
