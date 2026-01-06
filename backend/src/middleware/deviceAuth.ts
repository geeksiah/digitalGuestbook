import { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";

declare global {
  namespace Express {
    interface Request {
      checkinDevice?: { id: string; eventId: string };
    }
  }
}

export async function requireDevice(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.header("x-device-key");
  if (!apiKey) return res.status(401).json({ error: "Unauthorized" });
  const device = await prisma.checkinDevice.findUnique({ where: { apiKey } });
  if (!device) return res.status(401).json({ error: "Unauthorized" });
  req.checkinDevice = { id: device.id, eventId: device.eventId };
  next();
}


