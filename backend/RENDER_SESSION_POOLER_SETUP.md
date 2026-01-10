# Render.com + Supabase Session Pooler Setup

## Why Session Pooler?

Render.com is **IPv4-only** and cannot use Supabase's Direct Connection which requires IPv6. 

**Solution**: Use **Session Pooler** which:
- ✅ Works on IPv4 (Render.com, Vercel, GitHub Actions, etc.)
- ✅ Supports schema operations (unlike Transaction Pooler)
- ✅ Supports Prisma migrations (`db push`, `migrate deploy`)
- ✅ Supports prepared statements

## Supabase Connection Pooling Types

### ❌ Transaction Pooler (Port 6543) - Don't Use for Schema Ops
- Optimized for queries
- **Does NOT support** schema changes (DDL)
- **Does NOT support** prepared statements
- Use only for read/write queries, not migrations

### ✅ Session Pooler (Port 5432) - Use This!
- Full PostgreSQL session support
- **Supports** schema operations (DDL)
- **Supports** prepared statements
- **Works on IPv4** - compatible with Render.com
- Can be used for both queries and migrations

### ❌ Direct Connection (db.*.supabase.co) - Doesn't Work on Render
- Full PostgreSQL access
- Requires **IPv6 support**
- Render.com, Vercel, GitHub Actions are IPv4-only
- Would need to purchase IPv4 support from Supabase ($10/month)

## Setup Instructions

### Step 1: Get Session Pooler URL from Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll to **Connection string**
5. Select **Connection pooling**
6. **IMPORTANT**: Select **Session mode** (NOT Transaction mode)
7. Copy the connection string - it will look like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true
   ```
   Notice: Port is **5432** (Session mode), NOT 6543 (Transaction mode)

### Step 2: Set Environment Variables in Render.com

1. Go to [Render.com Dashboard](https://dashboard.render.com)
2. Select your backend service: `digital-event-backend`
3. Go to **Environment** tab
4. Add/Update these variables:

**Option A: Same Session Pooler URL for Both (Recommended)**
```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true
```

**Option B: Transaction Pooler for Queries, Session Pooler for Migrations**
```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true
```

**Recommendation**: Use Option A (both use Session Pooler on port 5432) for simplicity.

### Step 3: Replace Placeholders

Replace in both URLs:
- `[project-ref]` → Your Supabase project reference (e.g., `csaplekqvcdvpsadlwkg`)
- `[password]` → Your Supabase database password
- `[region]` → Your Supabase region (e.g., `eu-west-1`)

**Example**:
```env
DATABASE_URL=postgresql://postgres.csaplekqvcdvpsadlwkg:yourpassword@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.csaplekqvcdvpsadlwkg:yourpassword@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true
```

### Step 4: Save and Deploy

1. Click **Save Changes** in Render.com
2. Render.com will automatically redeploy
3. Watch the deployment logs for:
   ```
   ✅ Schema synced (already up to date if no changes)
   ✅ Default admin created: admin@example.com
   ```

## Verify Configuration

After deployment, check logs for these success messages:

```
✅ Schema synced (already up to date if no changes)
✅ Default admin created: admin@example.com
✅ Default templates created
[Database] Prisma Client initialized and connected
```

If you see connection errors:
- ✅ Double-check port is **5432** (Session Pooler)
- ✅ Verify Session mode is selected in Supabase (not Transaction mode)
- ✅ Ensure both URLs are identical (for simplicity)

## Connection URL Format Reference

### Session Pooler (Port 5432) - ✅ Use This
```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true
```

### Transaction Pooler (Port 6543) - ❌ Don't Use for Migrations
```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Direct Connection (IPv6 Only) - ❌ Doesn't Work on Render
```
postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

## Troubleshooting

### "Can't reach database server"
- ✅ Check you're using Session Pooler (port 5432), not Direct Connection
- ✅ Verify Session mode is selected in Supabase settings
- ✅ Check Supabase project is not paused

### "Schema sync timeout"
- ✅ Ensure DIRECT_URL uses Session Pooler (port 5432)
- ✅ Both DATABASE_URL and DIRECT_URL should use Session Pooler
- ✅ Session Pooler supports DDL operations (unlike Transaction Pooler)

### "prepared statement already exists"
- ✅ This is handled automatically in the code
- ✅ Session Pooler supports prepared statements
- ✅ If this persists, ensure you're using Session mode (not Transaction mode)

## Cost Comparison

- **Session Pooler**: ✅ Free (included with Supabase)
- **Direct Connection with IPv4**: $10/month (Supabase add-on)
- **Session Pooler**: Same functionality, works on IPv4, no extra cost!

## Summary

✅ Use **Session Pooler (port 5432)** for both `DATABASE_URL` and `DIRECT_URL`  
✅ This works on Render.com (IPv4-only platform)  
✅ Supports schema operations and migrations  
✅ No additional cost (free with Supabase)  
✅ Set both environment variables to the same Session Pooler URL  

