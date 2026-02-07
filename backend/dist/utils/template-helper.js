"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventTemplate = getEventTemplate;
const prisma_js_1 = require("../utils/prisma.js");
async function getEventTemplate(templateType, assignedTemplateId) {
    // 1. Try assigned template first
    if (assignedTemplateId) {
        const assigned = await prisma_js_1.prisma.template.findUnique({
            where: { id: assignedTemplateId }
        });
        if (assigned && assigned.type === templateType) {
            return assigned;
        }
    }
    // 2. Fallback to default
    return await prisma_js_1.prisma.template.findFirst({
        where: { type: templateType, isDefault: true }
    });
}
//# sourceMappingURL=template-helper.js.map