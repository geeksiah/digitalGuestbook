# Supabase Storage Bucket Setup Guide

## Bucket Configuration

The system uses 4 buckets with specific purposes and security settings:

### 1. `media-assets` (PUBLIC) ✅
- **Purpose**: Event media (photos, videos, audio from guests)
- **Visibility**: **PUBLIC** (recommended)
- **Why Public**: 
  - Event photos/videos are meant to be shared and viewed by guests
  - Allows direct URL access without authentication
  - Better performance (CDN caching)
  - Guestbook entries should be viewable by event attendees
- **Security**: Low risk - these are public event memories
- **File Types**: `image/*`, `video/*`, `audio/*`
- **Size Limit**: 50MB per file

### 2. `generated-reels` (PRIVATE) 🔒
- **Purpose**: Generated video reels from event media
- **Visibility**: **PRIVATE** (recommended)
- **Why Private**:
  - Generated content may contain curated/sensitive moments
  - Should be accessed through authenticated endpoints
  - Event owner should control who sees generated reels
- **Security**: Medium risk - generated content access should be controlled
- **File Types**: `video/*`
- **Size Limit**: No specific limit (reels can be large)

### 3. `templates` (PRIVATE) 🔒
- **Purpose**: HTML/CSS/JS template files for event pages
- **Visibility**: **PRIVATE** (required)
- **Why Private**:
  - Contains intellectual property (custom templates)
  - Admin-only assets
  - Templates may contain custom code/assets
- **Security**: Medium risk - protect IP and custom designs
- **File Types**: `application/zip`, `text/html`, `text/css`, `application/javascript`
- **Size Limit**: 50MB per file

### 4. `invitation-pdfs` (PRIVATE) 🔒
- **Purpose**: Generated PDF invitation passes with QR codes
- **Visibility**: **PRIVATE** (required)
- **Why Private**:
  - Contains sensitive data (access codes, QR codes, guest names)
  - Should only be accessible via signed URLs
  - Direct access would expose invitation security
- **Security**: **HIGH RISK** - contains access credentials
- **File Types**: `application/pdf`
- **Size Limit**: 10MB per file (PDFs are typically small)

## Recommended Bucket Configuration

### Option 1: Recommended (Balanced Security)

| Bucket | Visibility | Reason |
|--------|-----------|--------|
| `media-assets` | **PUBLIC** | Event memories are meant to be shared |
| `generated-reels` | **PRIVATE** | Generated content access should be controlled |
| `templates` | **PRIVATE** | Admin IP, not for public access |
| `invitation-pdfs` | **PRIVATE** | Contains sensitive access codes |

### Option 2: Maximum Security (All Private)

All buckets private - use signed URLs for everything:
- ✅ Maximum security
- ❌ Requires authentication for every file access
- ❌ More complex (need signed URL generation)
- ❌ Slightly slower (no CDN caching for public content)

### Option 3: Maximum Convenience (All Public)

All buckets public - direct URL access:
- ✅ Simple, fast access
- ✅ Better CDN performance
- ❌ No access control
- ❌ Security risk for PDFs/templates

## Bucket Naming Rules

Supabase bucket naming requirements:
- ✅ **Lowercase letters**: `a-z`
- ✅ **Numbers**: `0-9`
- ✅ **Hyphens**: `-`
- ❌ **No uppercase**: `A-Z` (not allowed)
- ❌ **No underscores**: `_` (not allowed)
- ❌ **No spaces**: (not allowed)
- ❌ **No special characters**: `@`, `#`, `%`, etc.

**Good Names**:
- `media-assets` ✅
- `generated-reels` ✅
- `event-media-2024` ✅

**Bad Names**:
- `Media_Assets` ❌ (uppercase, underscore)
- `media assets` ❌ (space)
- `media@assets` ❌ (special character)

## Automatic Bucket Creation

The system automatically creates buckets on first use if they don't exist:

```typescript
// Buckets are created automatically with these settings:
ensureBucketExists('media-assets')      // public: true
ensureBucketExists('generated-reels')   // public: false
ensureBucketExists('templates')         // public: false
ensureBucketExists('invitation-pdfs')   // public: false
```

**You don't need to manually create buckets** - they're created automatically on first upload.

## Manual Bucket Creation (Optional)

If you prefer to create buckets manually in Supabase:

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Configure each bucket:

### Bucket 1: `media-assets`
- **Name**: `media-assets`
- **Public bucket**: ✅ **YES** (checked)
- **File size limit**: 50 MB
- **Allowed MIME types**: 
  - `image/*`
  - `video/*`
  - `audio/*`

### Bucket 2: `generated-reels`
- **Name**: `generated-reels`
- **Public bucket**: ❌ **NO** (unchecked)
- **File size limit**: Leave empty (no limit) or set to 500 MB
- **Allowed MIME types**: 
  - `video/*`

### Bucket 3: `templates`
- **Name**: `templates`
- **Public bucket**: ❌ **NO** (unchecked)
- **File size limit**: 50 MB
- **Allowed MIME types**: 
  - `application/zip`
  - `text/html`
  - `text/css`
  - `application/javascript`

### Bucket 4: `invitation-pdfs`
- **Name**: `invitation-pdfs`
- **Public bucket**: ❌ **NO** (unchecked)
- **File size limit**: 10 MB
- **Allowed MIME types**: 
  - `application/pdf`

## Security Considerations

### Public Buckets (`media-assets`)
- ✅ Anyone with the URL can access files
- ✅ No authentication required
- ✅ Better for CDN caching and performance
- ⚠️ Files can be indexed by search engines (if URLs are exposed)
- ⚠️ Files can be downloaded by anyone who has the URL
- ✅ **Recommendation**: Use Row Level Security (RLS) policies if you want access control

### Private Buckets (all others)
- ✅ Access controlled via signed URLs or authentication
- ✅ Files cannot be accessed without proper credentials
- ✅ Better security for sensitive data
- ❌ Requires signed URL generation (adds complexity)
- ❌ Cannot use direct CDN URLs

## Row Level Security (RLS) - Advanced

For `media-assets` bucket, you can add RLS policies for finer control:

```sql
-- Example: Only allow access to media from specific events
CREATE POLICY "Event media access"
ON storage.objects FOR SELECT
USING (bucket_id = 'media-assets' AND auth.uid() IS NOT NULL);
```

**Note**: RLS is optional and adds complexity. For most use cases, public bucket with proper URL structure is sufficient.

## Environment Variables Required

To use Supabase Storage, set these in Render.com:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find**:
- Supabase Dashboard → Settings → API
- `SUPABASE_URL`: Project URL (shown at top)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (secret, shown under "Project API keys")

## Bucket Initialization

Buckets are automatically initialized on server startup via `initializeBuckets()`. This happens:
- On first deployment
- If buckets don't exist yet
- Handles creation with correct settings automatically

## Changing Bucket Settings After Creation

**Important**: You **cannot** change bucket visibility (public/private) after creation in Supabase.

**Options**:
1. Delete bucket and recreate (⚠️ deletes all files!)
2. Create new bucket with different name and migrate files
3. Use RLS policies to control access to public buckets

**Recommendation**: Set visibility correctly from the start.

## Cost Considerations

Supabase Storage pricing (Free Tier):
- **Storage**: 1 GB free
- **Bandwidth**: 2 GB/month free
- **File uploads**: Unlimited

**Tips**:
- Compress images/videos before upload
- Delete old/unused media regularly
- Consider archiving old events to reduce storage

## Testing Bucket Configuration

After setting up, test with:

```bash
# Test upload
POST /api/guestbook/{eventId}/upload
# File should be uploaded to media-assets bucket

# Check if bucket exists
# Go to Supabase Dashboard → Storage → Check bucket list
```

## Summary

**Recommended Configuration**:
- ✅ `media-assets` → **PUBLIC** (event photos are shareable)
- ✅ `generated-reels` → **PRIVATE** (controlled access)
- ✅ `templates` → **PRIVATE** (admin IP)
- ✅ `invitation-pdfs` → **PRIVATE** (sensitive data)

**Bucket Names**: Use exactly `media-assets`, `generated-reels`, `templates`, `invitation-pdfs` (lowercase, hyphens only)

**Automatic Creation**: Buckets are created automatically on first use - no manual setup needed!

