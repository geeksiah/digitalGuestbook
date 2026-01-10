# Quick Fix: Database Schema Sync Issue

## Problem
The database schema sync is failing with one of these errors:
- `Can't reach database server at db.*.supabase.co:5432` - Connection refused
- `Schema sync timeout/error` - Timeout during schema push
- `prepared statement already exists` - Prisma connection pooling issue (fixed in code)

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

5. **CRITICAL**: Allow Render.com IPs in Supabase:
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Go to **Settings** → **Database** → **Connection Pooling**
   - Or go to **Settings** → **Network Restrictions**
   - **Allow all connections** (or add Render.com IP ranges - see below)
   - For development, you can temporarily disable IP restrictions

6. Click **Save Changes** in Render.com
7. Render.com will automatically redeploy

**Note**: Supabase free tier may have IP restrictions. For production, you'll need to:
- Allow Render.com IP ranges: `0.0.0.0/0` (allow all) OR
- Find Render.com IP ranges and whitelist them
- Or upgrade Supabase plan for better IP allowlisting options

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

If you still see connection errors, check:
- ✅ DIRECT_URL uses port **5432** (not 6543) - this is the direct connection port
- ✅ DIRECT_URL format: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`
- ✅ Password is correct (URL-encode special characters if needed)
- ✅ Supabase project is active and accessible
- ✅ **IP allowlisting is disabled OR Render.com IPs are allowed** (most common issue!)
- ✅ Direct connection is enabled in Supabase settings
- ✅ Database password hasn't been reset (would break connection)

## Expected Behavior After Fix

- **First deploy**: ~10-15 seconds to create all tables
- **Subsequent deploys**: <1 second (schema matches, no changes)
- **Server starts**: Even if schema sync fails (non-fatal)
- **Tables created**: Admin, Event, Template, RSVP, etc.

## Still Having Issues?

### Common Issues & Solutions:

1. **"Can't reach database server"** 
   - **Fix**: Disable IP restrictions in Supabase Settings → Network Restrictions
   - Or whitelist Render.com IP ranges (Render uses dynamic IPs, so allow all is easier)

2. **"Prepared statement already exists"** (Code: 42P05)
   - **Fixed**: Code now handles this automatically by using unsafe queries for health checks
   - This happens with connection pooling - Prisma will use DIRECT_URL for operations that need prepared statements

3. **Connection timeout**
   - Check Supabase project is not paused (free tier pauses after inactivity)
   - Verify DATABASE_URL and DIRECT_URL are both set correctly
   - Check Supabase connection limits (free tier: 60 direct connections)

4. **Password authentication failed**
   - Reset database password in Supabase if needed
   - Ensure password is URL-encoded in connection string
   - Double-check username is `postgres` (not your Supabase account email)

5. **Test connection locally**:
   ```bash
   cd backend
   export DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
   npx prisma db push
   ```

6. **Alternative: Use Supabase SQL Editor**
   - Go to Supabase Dashboard → SQL Editor
   - Manually create tables using Prisma-generated SQL (from `prisma migrate dev` output)
   - This bypasses connection issues but is manual

