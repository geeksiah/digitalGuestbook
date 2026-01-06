import { Router } from "express";
import { requireDevice } from "../middleware/deviceAuth.js";
import { prisma } from "../db.js";
import { isQrSignatureValid, verifyQrPayload } from "../utils/qr.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const router = Router();

async function completeCheckin(invitationId: string, deviceId: string, eventId: string) {
  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId }, include: { rsvp: true } });
  if (!invitation) return { result: "NOT_FOUND" as const };
  if (invitation.rsvp.status !== "APPROVED") {
    await prisma.checkinLog.create({ data: { eventId, invitationId, method: "QR", result: "UNAPPROVED", deviceId } });
    return { result: "UNAPPROVED" as const };
  }
  if (invitation.checkedInAt) {
    await prisma.checkinLog.create({ data: { eventId, invitationId, method: "QR", result: "DUPLICATE", deviceId } });
    return { result: "DUPLICATE" as const, checkedInAt: invitation.checkedInAt };
  }
  const updated = await prisma.invitation.update({
    where: { id: invitationId },
    data: { checkedInAt: new Date() }
  });
  await prisma.checkinLog.create({ data: { eventId, invitationId, method: "QR", result: "SUCCESS", deviceId } });
  return { result: "SUCCESS" as const, checkedInAt: updated.checkedInAt };
}

router.post("/v1/checkin/scan", requireDevice, async (req, res) => {
  const device = req.checkinDevice!;
  const payload = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return null; } })() : req.body;
  if (!verifyQrPayload(payload) || !isQrSignatureValid(payload)) {
    await prisma.checkinLog.create({ data: { eventId: device.eventId, invitationId: null, method: "QR", result: "INVALID", deviceId: device.id } });
    return res.status(400).json({ error: "Invalid QR" });
  }
  const invitation = await prisma.invitation.findFirst({
    where: { attendeeToken: payload.t, sixDigitCode: payload.c, event: { slug: payload.e, id: device.eventId } },
    include: { rsvp: true, event: true }
  });
  if (!invitation) {
    await prisma.checkinLog.create({ data: { eventId: device.eventId, invitationId: null, method: "QR", result: "NOT_FOUND", deviceId: device.id } });
    return res.status(404).json({ error: "Not found" });
  }
  const result = await completeCheckin(invitation.id, device.id, device.eventId);
  return res.json({ result: result.result, checkedInAt: result.checkedInAt || null, partyName: invitation.rsvp.partyName });
});

const codeSchema = z.object({
  code: z.string().regex(/^[0-9]{6}$/),
  eventSlug: z.string().min(1)
});

router.post("/v1/checkin/code", requireDevice, async (req, res) => {
  const device = req.checkinDevice!;
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { code, eventSlug } = parsed.data;
  const invitation = await prisma.invitation.findFirst({
    where: { sixDigitCode: code, event: { slug: eventSlug, id: device.eventId } },
    include: { rsvp: true }
  });
  if (!invitation) {
    await prisma.checkinLog.create({ data: { eventId: device.eventId, invitationId: null, method: "CODE", result: "NOT_FOUND", deviceId: device.id } });
    return res.status(404).json({ error: "Not found" });
  }
  if (invitation.rsvp.status !== "APPROVED") {
    await prisma.checkinLog.create({ data: { eventId: device.eventId, invitationId: invitation.id, method: "CODE", result: "UNAPPROVED", deviceId: device.id } });
    return res.status(400).json({ error: "Unapproved" });
  }
  if (invitation.checkedInAt) {
    await prisma.checkinLog.create({ data: { eventId: device.eventId, invitationId: invitation.id, method: "CODE", result: "DUPLICATE", deviceId: device.id } });
    return res.json({ result: "DUPLICATE", checkedInAt: invitation.checkedInAt, partyName: invitation.rsvp.partyName });
  }
  const updated = await prisma.invitation.update({ where: { id: invitation.id }, data: { checkedInAt: new Date() } });
  await prisma.checkinLog.create({ data: { eventId: device.eventId, invitationId: invitation.id, method: "CODE", result: "SUCCESS", deviceId: device.id } });
  return res.json({ result: "SUCCESS", checkedInAt: updated.checkedInAt, partyName: invitation.rsvp.partyName });
});

export default router;


