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
}
/**
 * Copy template assets to event-specific directory for isolation
 * This ensures templates assigned to Event A don't leak into Event B
 */
export declare const copyTemplateAssetsForEvent: (eventId: string, assignments: TemplateAssignments) => Promise<void>;
/**
 * Get event-specific template asset path
 * Returns event-specific path if exists, otherwise returns template's default path
 */
export declare const getEventTemplateAssetPath: (eventId: string, templateId: string | null, fieldName: string) => Promise<string | null>;
export {};
//# sourceMappingURL=templateIsolation.d.ts.map