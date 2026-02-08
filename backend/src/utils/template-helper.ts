import prisma from '../utils/prisma.js';

export async function getEventTemplate(
  templateType: string,
  assignedTemplateId: string | null | undefined
) {
  try {
    // 1. Try assigned template first
    if (assignedTemplateId) {
      const assigned = await prisma.template.findUnique({
        where: { id: assignedTemplateId },
      });

      if (!assigned) {
        console.info(`[TemplateHelper] Assigned template id=${assignedTemplateId} not found`);
      } else {
        // If the types match, use it
        if (assigned.type === templateType) {
          return assigned;
        }

        // If types mismatch but the template contains HTML content (you may have pasted HTML),
        // prefer using the assigned template so admin-pasted templates still render.
        if (assigned.htmlContent && assigned.htmlContent.trim().length > 0) {
          console.warn(`[TemplateHelper] Assigned template id=${assigned.id} has type=${assigned.type} which does not match expected=${templateType}, but contains htmlContent; using assigned template.`);
          return assigned;
        }

        console.info(`[TemplateHelper] Assigned template id=${assigned.id} type=${assigned.type} does not match expected=${templateType}; falling back to default template.`);
      }
    }

    // 2. Fallback to default
    const def = await prisma.template.findFirst({
      where: { type: templateType, isDefault: true },
    });

    if (!def) {
      console.info(`[TemplateHelper] No default template found for type=${templateType}`);
    }

    return def || null;
  } catch (err) {
    const msg = (err && (err as any).message) ? (err as any).message : String(err);
    console.error('[TemplateHelper] Error resolving template:', msg);
    throw err;
  }
}