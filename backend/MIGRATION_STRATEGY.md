# Database Migration Strategy

## Production Migration Approach (Idempotent)

For production PostgreSQL/Supabase, we currently use **Prisma DB Push** which is:
- ✅ **Idempotent**: Compares schema with database, only applies changes when needed
- ✅ **Safe**: Won't re-apply changes if schema already matches database
- ✅ **Fast**: Completes quickly when schema matches (no unnecessary work)
- ✅ **Reliable**: Works on fresh databases without requiring migration history

**Note**: Once we have proper PostgreSQL migrations, we can switch to `prisma migrate deploy` for better migration tracking.

## Migration Flow

### Every Deploy (Idempotent)
1. `prisma db push` compares `schema.prisma` with current database state
2. Only applies changes if schema differs from database
3. If schema matches → Completes in <1 second (no changes needed)
4. If schema differs → Applies only the necessary changes
5. **This is idempotent - no work if already up to date**

## Performance

- **First deploy**: ~5-10 seconds (creates all tables from schema)
- **Subsequent deploys (no schema changes)**: <1 second (detects schema matches, no work)
- **Subsequent deploys (with schema changes)**: ~2-5 seconds (applies only changed parts)
- **No re-running**: Schema comparison is idempotent, won't re-apply existing structures

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

