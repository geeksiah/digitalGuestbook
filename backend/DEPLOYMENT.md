# Deployment Guide - Render.com

## How Prisma Client Regeneration Works on Render.com

Since your backend is deployed on Render.com using Docker, Prisma client is automatically regenerated during the Docker build process. Here's how it works:

### Automatic Regeneration Process

1. **On every push to your main branch**, Render.com triggers a new build
2. **During the Docker build** (Stage 1 - Builder):
   - Dependencies are installed (including Prisma CLI)
   - `npx prisma generate` runs (line 16 of Dockerfile)
   - This generates Prisma client with your current schema
   - TypeScript is compiled using the generated client

3. **During the Docker build** (Stage 2 - Production):
   - Production dependencies are installed
   - `npx prisma generate` runs again (line 44 of Dockerfile)
   - This ensures Prisma client is generated for the production runtime
   - The compiled code is copied from the builder stage

4. **When the container starts**:
   - `start:prod` script runs `prisma db push` to sync schema to database
   - Then starts the Node.js application

### What You Need to Do

**Nothing!** The process is fully automatic. However, here are important points:

#### 1. Commit Schema Changes
Make sure you've committed your `prisma/schema.prisma` file with the latest changes:

```bash
git add backend/prisma/schema.prisma
git commit -m "Update Prisma schema with ReelJob model"
git push origin main
```

#### 2. Trigger a New Deployment
Render.com automatically deploys on push to main, but you can also:
- Go to your Render.com dashboard
- Click "Manual Deploy" → "Deploy latest commit"
- Or push an empty commit: `git commit --allow-empty -m "Trigger rebuild" && git push`

#### 3. Monitor the Build Logs
In Render.com dashboard, check the build logs to verify:
- `npx prisma generate` runs successfully
- No Prisma-related errors
- Database migration/sync completes

### Troubleshooting

#### If Prisma generation fails:
1. Check build logs in Render.com dashboard
2. Verify `prisma/schema.prisma` is included in the Docker build
3. Ensure DATABASE_URL is correctly set in Render.com environment variables
4. Check that the schema syntax is valid

#### If TypeScript errors occur:
The TypeScript compiler needs the generated Prisma client. Since generation happens in the builder stage before compilation, this should work automatically.

#### To manually test locally:
```bash
cd backend
npm ci
npx prisma generate
npm run build
```

### Current Status

✅ **Dockerfile is configured correctly**:
- Prisma client is generated in both build stages
- Production dependencies include `@prisma/client`
- `npx prisma generate` works even without Prisma CLI in production (npx downloads it)

✅ **Schema changes are ready**:
- `ReelJob` model is in `schema.prisma`
- TypeScript code uses `(prisma as any).reelJob` temporarily
- After deployment, Prisma client will be properly generated

### Next Steps

1. **Commit all changes** (if not already done):
   ```bash
   git add .
   git commit -m "Add template upload UI, per-event isolation, enhanced logging, health checks"
   git push origin main
   ```

2. **Monitor deployment**:
   - Go to Render.com dashboard
   - Watch the build logs
   - Verify the deployment succeeds

3. **Verify after deployment**:
   - Check `/health` endpoint
   - Verify template upload works
   - Test reel generation

### Notes

- **Database migrations**: Using `prisma db push` in `start:prod` ensures schema sync without manual migrations
- **SQLite on Render.com**: Using a mounted volume (`/app/data`) ensures database persistence
- **Production safety**: The multi-stage build ensures only necessary files are in the final image

