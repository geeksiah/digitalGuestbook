/**
 * Generate a secure download token for a booth photo session (all photos from a session)
 */
export declare function generateBoothSessionDownloadToken(eventId: string, deviceId: string, sessionStart: Date): Promise<string>;
/**
 * Generate QR code for booth photo session download
 */
export declare function generateBoothSessionDownloadQR(eventId: string, deviceId: string, sessionStart: Date): Promise<string>;
/**
 * Generate a secure download token for a single booth photo (backward compatibility)
 */
export declare function generateBoothDownloadToken(mediaId: string): Promise<string>;
/**
 * Generate QR code for single booth photo download (backward compatibility)
 */
export declare function generateBoothDownloadQR(mediaId: string): Promise<string>;
/**
 * Verify and get download token info (for session-based downloads)
 * Note: Token is NOT marked as used here - it's marked when individual photos are downloaded
 */
export declare function verifyBoothDownloadToken(token: string, markAsUsed?: boolean): Promise<{
    type: 'single' | 'session';
    mediaId?: string;
    filePath?: string;
    sessionId?: string;
    eventId?: string;
    deviceId?: string;
} | null>;
/**
 * Get all photos for a session
 */
export declare function getSessionPhotos(sessionId: string, eventId: string, deviceId: string | null): Promise<Array<{
    id: string;
    filePath: string;
    fileName: string;
}>>;
//# sourceMappingURL=boothDownload.d.ts.map