export declare function getEventTemplate(templateType: string, assignedTemplateId: string | null | undefined): Promise<{
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
//# sourceMappingURL=template-helper.d.ts.map