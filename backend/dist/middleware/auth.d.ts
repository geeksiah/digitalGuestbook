import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            admin?: {
                id: string;
                email: string;
                name: string;
                role: string;
            };
            event?: any;
            ownerToken?: string;
            ownerId?: string;
            owner?: {
                id: string;
                email: string;
                name: string;
                isActive: boolean;
            };
        }
    }
}
export declare const authenticateAdmin: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authenticateOwner: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authenticateCouple: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authenticateOwnerAccount: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authenticateAdminOrOwnerAccount: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const optionalAdminAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map