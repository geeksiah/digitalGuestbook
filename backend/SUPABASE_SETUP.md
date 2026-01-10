# Supabase PostgreSQL Setup Guide

This guide will help you migrate from SQLite to Supabase PostgreSQL for persistent data storage.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - **Name**: `digital-event-platform` (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine for development
5. Wait for project to be created (~2 minutes)

## Step 2: Get Database Connection String

1. In your Supabase project dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection string**
3. Select **Connection pooling** (transaction mode) for `DATABASE_URL`
4. Copy the connection string - it looks like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
5. For `DIRECT_URL` (used for migrations), use the **Direct connection** string:
   ```
   postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
   ```

## Step 3: Update Environment Variables

### For Render.com Deployment:

1. Go to your Render.com dashboard
2. Select your backend service
3. Go to **Environment** tab
4. **CRITICAL**: Add BOTH environment variables:

```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

**Important**: 
- `DATABASE_URL`: Use **Connection pooling** URL (for app queries) - port 6543
- `DIRECT_URL`: Use **Direct connection** URL (for migrations/schema ops) - port 5432
- **DIRECT_URL is REQUIRED** for `prisma db push` to work (pooler doesn't support DDL operations)
- Replace `[project-ref]`, `[password]`, and `[region]` with your actual values from Supabase

**Why two URLs?**
- Supabase pooler (DATABASE_URL) is optimized for queries but doesn't support schema changes
- Direct connection (DIRECT_URL) is needed for migrations but has connection limits
- Prisma automatically uses DIRECT_URL for `db push` and `migrate deploy`
- Prisma uses DATABASE_URL for regular queries

### For Local Development:

Create/update `.env` file in `backend/` directory:

```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

## Step 4: Update Prisma Schema

The schema has already been updated to use PostgreSQL. Key changes:
- `provider = "postgresql"` instead of `"sqlite"`
- Added `directUrl` for migrations

## Step 5: Create Database Migration

In your local machine (or build environment):

```bash
cd backend

# Generate Prisma client for PostgreSQL
npx prisma generate

# Push schema to Supabase (creates tables)
npx prisma db push

# OR create a migration (better for production)
npx prisma migrate dev --name init_postgresql
```

## Step 6: Update Dockerfile

The Dockerfile needs to handle PostgreSQL connection pooling. Update the `start:prod` script:

```dockerfile
# Start the application with proper database connection
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
```

Or for production with migrations:
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

## Step 7: Update Render.com Configuration

Update `render.yaml`:

```yaml
services:
  - type: web
    name: digital-event-backend
    runtime: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false  # Set this in Render dashboard from Supabase
      - key: DIRECT_URL
        sync: false  # Set this in Render dashboard from Supabase
      - key: JWT_SECRET
        generateValue: true
      - key: CORS_ORIGIN
        sync: false
    # Remove disk section - not needed with PostgreSQL
```

## Step 8: Deploy

1. Commit and push your changes:
   ```bash
   git add backend/prisma/schema.prisma backend/render.yaml backend/Dockerfile
   git commit -m "Migrate to Supabase PostgreSQL"
   git push origin main
   ```

2. In Render.com:
   - Go to your service
   - Add `DATABASE_URL` and `DIRECT_URL` environment variables
   - Deploy will happen automatically

3. Monitor deployment logs:
   - Check that Prisma migrations run successfully
   - Verify database connection
   - Check that tables are created

## Step 9: Verify Connection

After deployment, check the logs for:
- `[Database] Connected successfully`
- `🚀 Your database is now in sync with your Prisma schema`

## Step 10: Migrate Existing Data (Optional)

If you have existing SQLite data:

1. Export data from SQLite:
   ```bash
   sqlite3 data/prod.db .dump > backup.sql
   ```

2. Convert and import to PostgreSQL (manual process):
   - You may need to adjust SQL syntax differences
   - Use Supabase SQL Editor to run inserts

Or start fresh with the new database (recommended for MVP).

## Troubleshooting

### Connection Timeout
- Check that you're using connection pooling URL for `DATABASE_URL`
- Verify firewall/network access
- Check Supabase project status

### Migration Errors
- Ensure `DIRECT_URL` is set correctly
- Run migrations manually: `npx prisma migrate deploy`
- Check Prisma logs for specific errors

### Authentication Errors
- Verify password in connection string is correct
- Check Supabase project credentials

## Benefits of Supabase

✅ **Persistent Storage** - Data survives deployments  
✅ **Scalable** - Handles concurrent connections  
✅ **Reliable** - Managed database with backups  
✅ **Real-time** - Can enable real-time features later  
✅ **Free Tier** - 500MB database, 2GB bandwidth  

## Next Steps

After successful migration:
1. Monitor database usage in Supabase dashboard
2. Set up automated backups (Supabase Pro)
3. Configure connection pooling limits if needed
4. Consider enabling Row Level Security (RLS) for multi-tenancy

