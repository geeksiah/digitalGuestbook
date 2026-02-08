Render deployment notes

Quick Render setup for DigitalGuestbook backend

1) Environment variables
- Set `CORS_ORIGIN` to your frontend origin, for example:
  https://app.eventpeepo.com

2) Make sure the service has persistent directories available for template assets.

3) Start Command (ensures directories exist before starting the app)

Use this as the Render service Start Command (in Service → Settings → Start Command):

```bash
bash -lc "mkdir -p /app/templates/archives /app/templates/events && npm run start"
```

This will ensure the `/app/templates` directories exist after each deploy/start and prevent failures when extracting or copying template asset archives.

4) Long-term recommendation
- Store uploaded template assets in persistent object storage (S3 / Supabase Storage / Spaces) and reference them by URL in `Template.assetsPath` instead of relying on the local container filesystem. This avoids data loss on redeploys.

5) Quick verification
- After deployment, tail logs in Render dashboard and reproduce a template upload/assignment. Look for messages about copying assets and absence of "Template assets not found".
