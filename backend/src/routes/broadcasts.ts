import { Router } from "express";
import { prisma } from "../db.js";
import { z } from "zod";
import { requireCoupleForEvent } from "../middleware/coupleAuth.js";
import { Prisma } from "@prisma/client";

const router = Router();

router.get("/v1/couple/events/:eventId/broadcasts", requireCoupleForEvent, async (req, res) => {
  const eventId = req.coupleEvent!.id;
  const rows = await prisma.broadcast.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: { deliveries: true }
  });
  res.json(rows);
});

const createSchema = z.object({
  audience: z.enum(["ALL_RSVPS","APPROVED_ONLY"]),
  channel: z.enum(["EMAIL","SMS","WHATSAPP"]),
  body: z.string().min(1).max(480)
});

router.post("/v1/couple/events/:eventId/broadcasts", requireCoupleForEvent, async (req, res) => {
  const eventId = req.coupleEvent!.id;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { audience, channel, body } = parsed.data;

  // Select targets based on audience and channel availability
  const where: any = { eventId };
  if (audience === "APPROVED_ONLY") {
    where.status = "APPROVED";
  }
  const rsvps = await prisma.rSVP.findMany({ where });
  const targets = rsvps
    .map(r => {
      if (channel === "EMAIL" && r.contactEmail) return { rsvpId: r.id, target: r.contactEmail };
      if ((channel === "SMS" || channel === "WHATSAPP") && r.contactPhone) return { rsvpId: r.id, target: r.contactPhone };
      return null;
    })
    .filter(Boolean) as { rsvpId: string; target: string }[];

  const broadcast = await prisma.broadcast.create({
    data: {
      eventId,
      audience,
      channel,
      body,
      sentCount: targets.length
    }
  });

  // Create delivery records (MVP: mark as SENT immediately; integration can update status asynchronously)
  await prisma.$transaction(
    targets.map(t =>
      prisma.broadcastDelivery.create({
        data: {
          broadcastId: broadcast.id,
          rsvpId: t.rsvpId,
          status: "SENT",
          target: t.target
        }
      })
    )
  );

  res.status(201).json({ ok: true, id: broadcast.id, sentCount: targets.length });
});

export default router;


