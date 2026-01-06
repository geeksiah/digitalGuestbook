import { Router } from "express";
import { requireCoupleForEvent } from "../middleware/coupleAuth.js";
import { prisma } from "../db.js";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { generateAttendeeToken, generateSixDigitCode, signQrPayload } from "../utils/credentials.js";

const router = Router();

router.get("/v1/couple/events/:eventId/rsvps", requireCoupleForEvent, async (req, res) => {
  const eventId = req.coupleEvent!.id;
  const statusParam = (req.query.status as string | undefined)?.toUpperCase();
  const where: any = { eventId };
  if (statusParam && ["PENDING", "APPROVED", "REJECTED"].includes(statusParam)) {
    where.status = statusParam as RsvpStatus;
  }
  const rsvps = await prisma.rSVP.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });
  res.json(rsvps);
});

router.post("/v1/couple/rsvps/:rsvpId/approve", async (req, res) => {
  // We need to load RSVP->event to authorize with couple key
  const rsvp = await prisma.rSVP.findUnique({ where: { id: req.params.rsvpId }, include: { event: true, invitation: true } });
  if (!rsvp) return res.status(404).json({ error: "Not found" });
  const eventKey = req.header("x-couple-key");
  if (!eventKey || rsvp.event.coupleAccessKey !== eventKey) return res.status(401).json({ error: "Unauthorized" });
  if (!rsvp.event.invitationOnly) return res.status(400).json({ error: "Approval not applicable for this event" });
  if (rsvp.status === "REJECTED") return res.status(409).json({ error: "Already rejected" });

  // Idempotent: if already approved and invitation exists, return it
  if (rsvp.status === "APPROVED" && rsvp.invitation) {
    return res.json({ ok: true, invitation: rsvp.invitation });
  }

  // Approve RSVP
  const updated = await prisma.rSVP.update({
    where: { id: rsvp.id },
    data: { status: "APPROVED" }
  });
  await prisma.rsvpActionLog.create({
    data: { eventId: rsvp.eventId, rsvpId: rsvp.id, action: "APPROVE" }
  });

  // Create invitation if missing
  const existing = await prisma.invitation.findUnique({ where: { rsvpId: updated.id } });
  if (existing) return res.json({ ok: true, invitation: existing });

  // Generate unique six-digit code per event
  let six = generateSixDigitCode();
  // Retry a few times for collisions
  for (let i = 0; i < 5; i++) {
    const conflict = await prisma.invitation.findFirst({ where: { eventId: rsvp.eventId, sixDigitCode: six } });
    if (!conflict) break;
    six = generateSixDigitCode();
  }
  const token = generateAttendeeToken();
  const payload = { e: rsvp.event.slug, t: token, c: six };
  const s = signQrPayload(payload);
  const qrPayload = JSON.stringify({ ...payload, s });

  const invitation = await prisma.invitation.create({
    data: {
      eventId: rsvp.eventId,
      rsvpId: rsvp.id,
      attendeeToken: token,
      sixDigitCode: six,
      qrPayload,
      status: "ISSUED"
    }
  });
  res.json({ ok: true, invitation });
});

router.post("/v1/couple/rsvps/:rsvpId/reject", async (req, res) => {
  const rsvp = await prisma.rSVP.findUnique({ where: { id: req.params.rsvpId }, include: { event: true } });
  if (!rsvp) return res.status(404).json({ error: "Not found" });
  const eventKey = req.header("x-couple-key");
  if (!eventKey || rsvp.event.coupleAccessKey !== eventKey) return res.status(401).json({ error: "Unauthorized" });
  if (!rsvp.event.invitationOnly) return res.status(400).json({ error: "Rejection not applicable for this event" });
  if (rsvp.status === "REJECTED") return res.json({ ok: true, status: "REJECTED" });

  await prisma.rSVP.update({
    where: { id: rsvp.id },
    data: { status: "REJECTED" }
  });
  await prisma.rsvpActionLog.create({
    data: { eventId: rsvp.eventId, rsvpId: rsvp.id, action: "REJECT" }
  });
  // MVP rejection message per spec
  res.json({
    ok: true,
    message: "Thank you for your response. The event organizers will be in touch."
  });
});

export default router;


