import { Router } from "express";
import { prisma } from "../../db.js";
import { z } from "zod";
import crypto from "crypto";

const router = Router({ mergeParams: true });

router.get("/:eventId/devices", async (req, res) => {
  const rows = await prisma.checkinDevice.findMany({
    where: { eventId: req.params.eventId },
    orderBy: { createdAt: "desc" }
  });
  res.json(rows);
});

router.post("/:eventId/devices", async (req, res) => {
  const body = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  // Generate API key
  const apiKey = "dev_" + crypto.randomBytes(24).toString("hex");
  const created = await prisma.checkinDevice.create({
    data: {
      eventId: req.params.eventId,
      name: body.data.name,
      apiKey
    }
  });
  res.status(201).json(created);
});

export default router;


