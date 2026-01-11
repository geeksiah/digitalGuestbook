interface EventDetails {
    name: string;
    date: Date | string;
    venue: string | null;
    primaryColor?: string;
    secondaryColor?: string;
}
interface ReelOptions {
    eventId: string;
    outputName?: string;
    maxDuration?: number;
    transition?: 'fade' | 'dissolve' | 'none';
    eventDetails?: EventDetails;
}
interface ReelStatus {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    outputPath?: string;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
}
export declare const checkFfmpegAvailable: () => Promise<boolean>;
export declare const generateReel: (options: ReelOptions) => Promise<string>;
export declare const getReelJobStatus: (jobId: string) => Promise<ReelStatus | null>;
export declare const getEventReelJobs: (eventId: string) => Promise<ReelStatus[]>;
export declare const cleanupOldJobs: () => Promise<void>;
export {};
//# sourceMappingURL=reelGenerator.d.ts.map