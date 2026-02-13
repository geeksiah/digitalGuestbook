import path from 'path';
import fs from 'fs';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { isSupabaseConfigured, BUCKETS, listFiles, downloadFile } from './supabaseStorage.js';

interface TemplateAssignments {
  invitationTemplateId?: string | null;
  rsvpTemplateId?: string | null;
  guestbookTemplateId?: string | null;
  guestbookVideoTemplateId?: string | null;
  guestbookAudioTemplateId?: string | null;
  guestbookPhotoTemplateId?: string | null;
  boothTemplateId?: string | null;
  boothVideoTemplateId?: string | null;
  boothAudioTemplateId?: string | null;
  boothPhotoTemplateId?: string | null;
  thankYouTemplateId?: string | null;
  liveLandingTemplateId?: string | null;
  eventEndedTemplateId?: string | null;
  itineraryPageTemplateId?: string | null;
  giftingPageTemplateId?: string | null;
}

/**
 * Copy template assets to event-specific directory for isolation
 * This ensures templates assigned to Event A don't leak into Event B
 */
export const copyTemplateAssetsForEvent = async (
  eventId: string,
  assignments: TemplateAssignments
): Promise<void> => {
  const eventAssetsDir = path.join(process.cwd(), 'templates', 'events', eventId);
  
  // Ensure event directory exists
  if (!fs.existsSync(eventAssetsDir)) {
    fs.mkdirSync(eventAssetsDir, { recursive: true });
  }

  // Helper to copy template assets
  const copyAssets = async (templateId: string | null | undefined, fieldName: string) => {
    if (!templateId) return;
    
    try {
      const template = await prisma.template.findUnique({
        where: { id: templateId },
        select: { assetsPath: true, id: true, name: true },
      });
      
      if (!template || !template.assetsPath) {
        // No assets to copy (template is HTML-only)
        return;
      }
      
      const sourcePath = path.join(process.cwd(), template.assetsPath);
      const destPath = path.join(eventAssetsDir, fieldName.replace('TemplateId', ''));
      
      if (!fs.existsSync(sourcePath)) {
        console.warn(`[TemplateIsolation] Local template assets not found: ${sourcePath} for template ${template.id}`);

        // If Supabase is configured, attempt to download the assets into the event folder
        if (isSupabaseConfigured() && template.assetsPath) {
          try {
            const normalized = template.assetsPath.replace(/^\/+/,'').replace(/\\/g, '/');

            // Ensure destination exists
            if (!fs.existsSync(destPath)) {
              fs.mkdirSync(destPath, { recursive: true });
            }

            // Recursive downloader using listFiles + downloadFile
            const downloadRecursive = async (folderPrefix: string, outDir: string) => {
              const entries = await listFiles(BUCKETS.TEMPLATES, folderPrefix);
              for (const e of entries) {
                const entryPath = folderPrefix.endsWith('/') ? `${folderPrefix}${e.name}` : `${folderPrefix}/${e.name}`;
                try {
                  const buf = await downloadFile(BUCKETS.TEMPLATES, entryPath);
                  const outFile = path.join(outDir, e.name);
                  fs.writeFileSync(outFile, buf);
                  console.log(`[TemplateIsolation] Downloaded ${entryPath} -> ${outFile}`);
                } catch (err: any) {
                  // If download failed, it may be a folder - recurse into it
                  try {
                    const nestedOut = path.join(outDir, e.name);
                    if (!fs.existsSync(nestedOut)) {
                      fs.mkdirSync(nestedOut, { recursive: true });
                    }
                    await downloadRecursive(entryPath, nestedOut);
                  } catch (nestedErr: any) {
                    console.warn(`[TemplateIsolation] Skipping ${entryPath}: ${nestedErr?.message || nestedErr}`);
                  }
                }
              }
            };

            await downloadRecursive(normalized, destPath);
            console.log(`[TemplateIsolation] Downloaded assets from Supabase for template ${template.id} into ${destPath}`);
            return;
          } catch (err: any) {
            console.error(`[TemplateIsolation] Failed to download assets from Supabase for template ${template.id}:`, err.message || err);
            // fall through and skip copying
            return;
          }
        }

        return;
      }
      
      // Remove old assets for this field if exists
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
      }
      
      // Copy assets recursively
      fs.cpSync(sourcePath, destPath, { recursive: true });
      
      console.log(`[TemplateIsolation] Copied assets for ${fieldName} to ${destPath}`);
    } catch (error: any) {
      console.error(`[TemplateIsolation] Failed to copy assets for ${fieldName}:`, error.message);
      // Don't throw - template assignment can still succeed without assets
    }
  };

  // Copy assets for all assigned templates
  await copyAssets(assignments.invitationTemplateId, 'invitationTemplateId');
  await copyAssets(assignments.rsvpTemplateId, 'rsvpTemplateId');
  await copyAssets(assignments.guestbookTemplateId, 'guestbookTemplateId');
  await copyAssets(assignments.guestbookVideoTemplateId, 'guestbookVideoTemplateId');
  await copyAssets(assignments.guestbookAudioTemplateId, 'guestbookAudioTemplateId');
  await copyAssets(assignments.guestbookPhotoTemplateId, 'guestbookPhotoTemplateId');
  await copyAssets(assignments.boothTemplateId, 'boothTemplateId');
  await copyAssets(assignments.boothVideoTemplateId, 'boothVideoTemplateId');
  await copyAssets(assignments.boothAudioTemplateId, 'boothAudioTemplateId');
  await copyAssets(assignments.boothPhotoTemplateId, 'boothPhotoTemplateId');
  await copyAssets(assignments.thankYouTemplateId, 'thankYouTemplateId');
  await copyAssets(assignments.liveLandingTemplateId, 'liveLandingTemplateId');
  await copyAssets(assignments.eventEndedTemplateId, 'eventEndedTemplateId');
  await copyAssets(assignments.itineraryPageTemplateId, 'itineraryPageTemplateId');
  await copyAssets(assignments.giftingPageTemplateId, 'giftingPageTemplateId');
};

/**
 * Get event-specific template asset path
 * Returns event-specific path if exists, otherwise returns template's default path
 */
export const getEventTemplateAssetPath = async (
  eventId: string,
  templateId: string | null,
  fieldName: string
): Promise<string | null> => {
  if (!templateId) return null;
  
  const eventAssetPath = path.join(process.cwd(), 'templates', 'events', eventId, fieldName.replace('TemplateId', ''));
  
  // Check if event-specific assets exist
  if (fs.existsSync(eventAssetPath)) {
    return `templates/events/${eventId}/${fieldName.replace('TemplateId', '')}`;
  }
  
  // Fallback to template's default assets
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: { assetsPath: true },
  });
  
  return template?.assetsPath || null;
};

