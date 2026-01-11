"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventTemplateAssetPath = exports.copyTemplateAssetsForEvent = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
/**
 * Copy template assets to event-specific directory for isolation
 * This ensures templates assigned to Event A don't leak into Event B
 */
const copyTemplateAssetsForEvent = async (eventId, assignments) => {
    const eventAssetsDir = path_1.default.join(process.cwd(), 'templates', 'events', eventId);
    // Ensure event directory exists
    if (!fs_1.default.existsSync(eventAssetsDir)) {
        fs_1.default.mkdirSync(eventAssetsDir, { recursive: true });
    }
    // Helper to copy template assets
    const copyAssets = async (templateId, fieldName) => {
        if (!templateId)
            return;
        try {
            const template = await prisma_js_1.default.template.findUnique({
                where: { id: templateId },
                select: { assetsPath: true, id: true, name: true },
            });
            if (!template || !template.assetsPath) {
                // No assets to copy (template is HTML-only)
                return;
            }
            const sourcePath = path_1.default.join(process.cwd(), template.assetsPath);
            const destPath = path_1.default.join(eventAssetsDir, fieldName.replace('TemplateId', ''));
            if (!fs_1.default.existsSync(sourcePath)) {
                console.warn(`[TemplateIsolation] Template assets not found: ${sourcePath} for template ${template.id}`);
                return;
            }
            // Remove old assets for this field if exists
            if (fs_1.default.existsSync(destPath)) {
                fs_1.default.rmSync(destPath, { recursive: true, force: true });
            }
            // Copy assets recursively
            fs_1.default.cpSync(sourcePath, destPath, { recursive: true });
            console.log(`[TemplateIsolation] Copied assets for ${fieldName} to ${destPath}`);
        }
        catch (error) {
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
};
exports.copyTemplateAssetsForEvent = copyTemplateAssetsForEvent;
/**
 * Get event-specific template asset path
 * Returns event-specific path if exists, otherwise returns template's default path
 */
const getEventTemplateAssetPath = async (eventId, templateId, fieldName) => {
    if (!templateId)
        return null;
    const eventAssetPath = path_1.default.join(process.cwd(), 'templates', 'events', eventId, fieldName.replace('TemplateId', ''));
    // Check if event-specific assets exist
    if (fs_1.default.existsSync(eventAssetPath)) {
        return `templates/events/${eventId}/${fieldName.replace('TemplateId', '')}`;
    }
    // Fallback to template's default assets
    const template = await prisma_js_1.default.template.findUnique({
        where: { id: templateId },
        select: { assetsPath: true },
    });
    return template?.assetsPath || null;
};
exports.getEventTemplateAssetPath = getEventTemplateAssetPath;
//# sourceMappingURL=templateIsolation.js.map