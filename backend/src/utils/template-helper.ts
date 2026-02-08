import prisma from '../utils/prisma.js';

export async function getEventTemplate(
  templateType: string,
  assignedTemplateId: string | null | undefined
) {
  // 1. Try assigned template first
  if (assignedTemplateId) {
    const assigned = await prisma.template.findUnique({
      where: { id: assignedTemplateId }
    });
    if (assigned && assigned.type === templateType) {
      return assigned;
    }
  }

  // 2. Fallback to default
  return await prisma.template.findFirst({
    where: { type: templateType, isDefault: true }
  });
}