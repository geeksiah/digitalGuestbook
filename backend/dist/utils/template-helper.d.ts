/**
 * Get template for an event page
 * CRITICAL FIX: Only return assigned template, NO automatic fallback to defaults
 * This ensures events use their explicitly assigned templates
 */
export declare function getEventTemplate(templateType: string, assignedTemplateId: string | null | undefined): Promise<any | null>;
/**
 * Get default template as explicit fallback
 * Use this when you WANT the default, not as an automatic fallback
 */
export declare function getDefaultTemplate(templateType: string): Promise<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    type: string;
    htmlContent: string;
    cssContent: string | null;
    jsContent: string | null;
    variables: string | null;
    isDefault: boolean;
    assetsPath: string | null;
    thumbnailPath: string | null;
} | null>;
/**
 * Get template with explicit fallback behavior
 * This gives callers control over when to use defaults
 */
export declare function getEventTemplateWithFallback(templateType: string, assignedTemplateId: string | null | undefined, useDefaultFallback?: boolean): Promise<any>;
//# sourceMappingURL=template-helper.d.ts.map