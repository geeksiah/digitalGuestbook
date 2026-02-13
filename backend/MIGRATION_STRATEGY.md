# Database Migration Strategy

## Production Approach

Production uses `prisma db push` only.

- Idempotent: applies only schema differences
- Fast: no-op when schema is already up to date
- Safe by default: no `--accept-data-loss` in deploy startup

## Data Safety

Deploy-time sync runs:

```bash
npx prisma db push --skip-generate
```

Because `--accept-data-loss` is not used, Prisma blocks destructive changes instead of dropping data.

## Development Workflow

When editing schema in development:

```bash
# Sync local/dev database to current schema
npx prisma db push
```

Optional scripts:

- `npm run db:push`
- `npm run db:push:safe`

## Notes

- Existing migration files are kept for history/reference.
- Production does not depend on `prisma migrate deploy`.
