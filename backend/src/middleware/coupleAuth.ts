import { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";

declare global {
  namespace Express {
    interface Request {
      coupleEvent?: { id: string };
    }
  }
}

export async function requireCoupleForEvent(req: Request, res: Response, next: NextFunction) {
  const eventId = (req.params as any).eventId as string | undefined;
  const eventKey = req.header("x-couple-key");
  if (!eventId || !eventKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.coupleAccessKey !== eventKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.coupleEvent = { id: event.id };
  next();
}


