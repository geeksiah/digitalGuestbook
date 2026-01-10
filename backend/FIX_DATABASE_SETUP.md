# Quick Fix: Database Schema Sync Issue

## Problem
The database schema sync is timing out. This happens when `DIRECT_URL` is not set or incorrect.

## Solution

### Option 1: Set DIRECT_URL in Render.com (Recommended)

1. Go to [Render.com Dashboard](https://dashboard.render.com)
2. Select your backend service: `digital-event-backend`
3. Go to **Environment** tab
4. Add/Update these environment variables:

```
DIRECT_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

**Where to find these values:**
- Go to [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project
- Go to **Settings** → **Database**
- Scroll to **Connection string**
- Copy the **Direct connection** URL (NOT the pooling URL)
- Replace `[YOUR-PASSWORD]` with your actual database password
- Replace `[YOUR-PROJECT-REF]` with your project reference (visible in the URL)

5. Click **Save Changes**
6. Render.com will automatically redeploy

### Option 2: Manual Schema Push (One-time)

If you can't set DIRECT_URL immediately, you can manually push the schema once:

1. Connect to your Supabase database via SQL Editor
2. Or use local machine with environment variables set
3. Run:
   ```bash
   cd backend
   npx prisma db push
   ```

### Option 3: Temporarily Use Direct Connection for Both

If you just need to get it working quickly:

1. In Render.com Environment tab, set:
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
   (Use direct connection URL for both - not ideal for production but works)

2. Remove or leave DIRECT_URL empty (Prisma will use DATABASE_URL)

## Verify Fix

After setting DIRECT_URL, check deployment logs for:
```
✅ Schema synced (already up to date if no changes)
✅ Default admin created: admin@example.com
✅ Default templates created
✅ Database schema created (this happens once on first deploy)
```

If you still see timeouts, check:
- ✅ DIRECT_URL uses port **5432** (not 6543)
- ✅ DIRECT_URL format: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`
- ✅ Password is correct (no special characters that need URL encoding)
- ✅ Supabase project is active and accessible

## Expected Behavior After Fix

- **First deploy**: ~10-15 seconds to create all tables
- **Subsequent deploys**: <1 second (schema matches, no changes)
- **Server starts**: Even if schema sync fails (non-fatal)
- **Tables created**: Admin, Event, Template, RSVP, etc.

## Still Having Issues?

1. Check Supabase project status
2. Verify network connectivity from Render.com to Supabase
3. Check Supabase connection limits (free tier: 60 connections)
4. Review deployment logs for specific error messages
5. Try running `prisma db push` locally with DIRECT_URL set to test connection

