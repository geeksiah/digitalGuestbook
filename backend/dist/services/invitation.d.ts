/**
 * Generate invitation pass for an approved RSVP
 * Per SRS Section 6
 */
export declare function generateInvitationPass(rsvpId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    guestCount: number;
    token: string;
    accessCode: string;
    guestName: string;
    eventId: string;
    rsvpId: string;
    qrCodeData: string;
    emailSent: boolean;
    smsSent: boolean;
    whatsappSent: boolean;
    pdfGenerated: boolean;
    pdfPath: string | null;
    isCheckedIn: boolean;
    checkedInAt: Date | null;
}>;
/**
 * Generate PDF invitation card
 * Per SRS Section 6.2
 */
export declare function generateInvitationPDF(invitationId: string): Promise<string>;
/**
 * Get or generate invitation PDF
 */
export declare function getInvitationPDF(invitationId: string): Promise<string>;
//# sourceMappingURL=invitation.d.ts.map