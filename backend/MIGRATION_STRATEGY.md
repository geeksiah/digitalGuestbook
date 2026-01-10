# Database Migration Strategy

## Production Migration Approach (Idempotent)

For production PostgreSQL/Supabase, we use **Prisma Migrate Deploy** which is:
- ✅ **Idempotent**: Only runs pending migrations that haven't been applied yet
- ✅ **Safe**: Checks `_prisma_migrations` table to track applied migrations
- ✅ **Fast**: Skips migrations that are already applied (no database work on subsequent deploys)
- ✅ **One-time setup**: Uses `db push` only once on first deploy, then switches to migrations

## Migration Flow

### First Deploy (Fresh Database - Happens ONCE)
1. `prisma migrate deploy` attempts to run
2. If migrations table doesn't exist or migrations incompatible → Falls back to `prisma db push`
3. `db push` creates all tables from current schema (one-time bootstrap)
4. **This only happens once on first deploy**

### Subsequent Deploys (All Future Deploys)
1. `prisma migrate deploy` checks `_prisma_migrations` table
2. Only applies migrations that haven't been applied yet
3. If no pending migrations → Completes instantly (no database changes)
4. **This is idempotent - no work if already up to date**

## Performance

- **First deploy**: ~5-10 seconds (creates all tables via `db push`)
- **Subsequent deploys**: <1 second (checks for pending migrations, exits if none)
- **No re-running**: Migrations are tracked, never re-applied

## Creating New Migrations

When you modify `schema.prisma` in development:

```bash
# Development: Create new migration
npx prisma migrate dev --name add_new_feature

# This creates a migration file in prisma/migrations/
# Production will automatically apply it on next deploy via migrate deploy
```

## Migration Commands

- `prisma migrate deploy` - **Production**: Apply pending migrations (idempotent, fast)
- `prisma migrate dev` - **Development**: Create new migration and apply it
- `prisma db push` - **First-time only**: Bootstrap database (runs once, then never again)

## Current Status

- ✅ Migration lock file: Updated to `postgresql`
- ✅ Old SQLite migrations: Will be skipped (first deploy uses `db push` for fresh start)
- ✅ Future migrations: Will use PostgreSQL syntax and `migrate deploy`
- ✅ Idempotent: Subsequent deploys only check for new migrations, no unnecessary work

