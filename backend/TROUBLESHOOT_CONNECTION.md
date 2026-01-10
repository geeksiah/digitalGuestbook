# Troubleshooting Supabase Connection Issues

## Current Error: "Can't reach database server"

This error appears when Render.com cannot connect to your Supabase database.

## Quick Checklist

### ✅ Step 1: Verify Supabase Project is Active

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Check if your project shows "Paused" or "Inactive"
3. **Free tier projects pause after 7 days of inactivity**
4. Click "Restore" or "Resume" if paused
5. Wait 2-3 minutes for project to be ready

### ✅ Step 2: Check IP Allowlisting (Most Common Issue)

1. In Supabase Dashboard → **Settings** → **Database**
2. Scroll to **Connection Pooling** section
3. Check **Network Restrictions**
4. For development/testing, **disable IP restrictions** (allow all)
5. For production, you may need to:
   - Allow specific IP ranges (Render.com uses dynamic IPs)
   - Or upgrade Supabase plan for better IP management

**Note**: If you see "Restrict IP addresses" enabled, this is likely blocking Render.com.

### ✅ Step 3: Verify DIRECT_URL Format

Your DIRECT_URL should be:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Important**:
- Use `postgres` as username (NOT your Supabase account email)
- Use port **5432** (direct connection, NOT 6543 which is pooler)
- Use `db.*.supabase.co` (direct host, NOT `pooler.supabase.com`)
- Password must match your Supabase database password

### ✅ Step 4: Test Connection Locally

Test if the connection string works from your local machine:

```bash
# Set environment variable
export DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-REF].supabase.co:5432/postgres"

# Test connection
cd backend
npx prisma db push
```

If this works locally but not on Render.com:
- ✅ Connection string is correct
- ❌ Issue is IP allowlisting or network restrictions

### ✅ Step 5: Alternative - Use Supabase SQL Editor

If connection continues to fail, you can manually create tables:

1. Go to Supabase Dashboard → **SQL Editor**
2. Create a new query
3. Paste the SQL from Prisma schema (converted to PostgreSQL)
4. Or run: `npx prisma migrate dev` locally to generate migration SQL
5. Copy the SQL from the migration file and run in Supabase SQL Editor

### ✅ Step 6: Temporary Workaround - Use Direct Connection for Both

If you need to get working immediately:

1. In Render.com, set both `DATABASE_URL` and `DIRECT_URL` to the same direct connection URL:
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   ```

2. **Note**: This bypasses connection pooling but works for development
3. For production, use pooler for DATABASE_URL and direct for DIRECT_URL

## Understanding Supabase Connection Modes

### Connection Pooling (Port 6543) - Use for DATABASE_URL
- ✅ Optimized for high concurrency
- ✅ Lower connection limits
- ❌ Doesn't support DDL operations (schema changes)
- ❌ Doesn't support prepared statements

### Direct Connection (Port 5432) - Use for DIRECT_URL  
- ✅ Supports all SQL operations
- ✅ Supports prepared statements
- ✅ Required for migrations/schema changes
- ❌ Lower connection limits (free tier: 60 connections)

## Common Error Messages

### "Can't reach database server"
- **Cause**: IP restrictions, paused project, or wrong host
- **Fix**: Disable IP restrictions, unpause project, verify host

### "prepared statement already exists" (Code: 42P05)
- **Cause**: Using pooler with prepared statements
- **Fix**: Already handled in code - uses unsafe queries for health checks

### "The table does not exist"
- **Cause**: Schema sync failed, tables not created yet
- **Fix**: Ensure DIRECT_URL works, then redeploy to sync schema

### "Connection timeout"
- **Cause**: Network issues, IP restrictions, or paused project
- **Fix**: Check Supabase project status, disable IP restrictions

## Expected Connection Flow

1. **Deployment starts** → `prisma db push` runs using DIRECT_URL (port 5432)
2. **Schema sync** → Creates/updates tables if needed (idempotent)
3. **Server starts** → Uses DATABASE_URL (pooler, port 6543) for queries
4. **Migrations** → Automatically use DIRECT_URL when needed

## Verify Connection Works

After fixing connection issues, check deployment logs for:

```
✅ Schema synced (already up to date if no changes)
✅ Default admin created: admin@example.com
[Database] Prisma Client initialized and connected
```

## Still Having Issues?

1. Check Supabase project status (not paused)
2. Verify network restrictions are disabled (for testing)
3. Test connection locally with DIRECT_URL
4. Check Supabase dashboard for connection logs/errors
5. Consider upgrading Supabase plan for better support/features

