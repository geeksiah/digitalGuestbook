"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventTemplate = getEventTemplate;
exports.getDefaultTemplate = getDefaultTemplate;
exports.getEventTemplateWithFallback = getEventTemplateWithFallback;
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
/**
 * Get template for an event page
 * CRITICAL FIX: Only return assigned template, NO automatic fallback to defaults
 * This ensures events use their explicitly assigned templates
 */
async function getEventTemplate(templateType, assignedTemplateId) {
    // If no template assigned, return null (let caller handle fallback)
    if (!assignedTemplateId) {
        console.warn(`[TemplateHelper] No template assigned for type=${templateType}`);
        return null;
    }
    // Get the assigned template
    const assigned = await prisma_js_1.default.template.findUnique({
        where: { id: assignedTemplateId }
    });
    if (!assigned) {
        console.error(`[TemplateHelper] Assigned template not found: id=${assignedTemplateId} type=${templateType}`);
        return null;
    }
    // CRITICAL: Verify type matches to prevent wrong template being served
    if (assigned.type !== templateType) {
        console.error(`[TemplateHelper] Template type mismatch: assigned=${assignedTemplateId} ` +
            `expectedType=${templateType} actualType=${assigned.type}`);
        return null;
    }
    console.info(`[TemplateHelper] Using assigned template: id=${assigned.id} ` +
        `type=${assigned.type} name=${assigned.name}`);
    return assigned;
}
/**
 * Get default template as explicit fallback
 * Use this when you WANT the default, not as an automatic fallback
 */
async function getDefaultTemplate(templateType) {
    const defaultTemplate = await prisma_js_1.default.template.findFirst({
        where: {
            type: templateType,
            isDefault: true
        }
    });
    if (!defaultTemplate) {
        console.warn(`[TemplateHelper] No default template found for type=${templateType}`);
    }
    return defaultTemplate;
}
/**
 * Get template with explicit fallback behavior
 * This gives callers control over when to use defaults
 */
async function getEventTemplateWithFallback(templateType, assignedTemplateId, useDefaultFallback = false) {
    // Try assigned template first
    const assigned = await getEventTemplate(templateType, assignedTemplateId);
    if (assigned) {
        return assigned;
    }
    // Only fall back to default if explicitly requested
    if (useDefaultFallback) {
        console.info(`[TemplateHelper] Falling back to default for type=${templateType}`);
        return await getDefaultTemplate(templateType);
    }
    return null;
}
//# sourceMappingURL=template-helper.js.map