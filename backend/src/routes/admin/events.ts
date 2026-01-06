import { Router } from "express";
import { prisma } from "../../db.js";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { resolveActivePhase } from "../../utils/phase.js";

const router = Router();

const eventCreateSchema = z.object({
  slug: z.string().min(3),
  name: z.string().min(1),
  dateTime: z.string().datetime(),
  timezone: z.string().min(1),
  invitationOnly: z.boolean().default(false),
  featureInvitationWebsite: z.boolean().default(false),
  featureRsvp: z.boolean().default(false),
  featureGuestbook: z.boolean().default(false)
});

const eventUpdateSchema = eventCreateSchema.partial();

router.get("/", async (_req, res) => {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" }
  });
  res.json(events);
});

router.post("/", async (req, res) => {
  const parsed = eventCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;
  const created = await prisma.event.create({
    data: {
      slug: data.slug,
      name: data.name,
      dateTime: new Date(data.dateTime),
      timezone: data.timezone,
      invitationOnly: data.invitationOnly,
      featureInvitationWebsite: data.featureInvitationWebsite,
      featureRsvp: data.featureRsvp,
      featureGuestbook: data.featureGuestbook
    }
  });
  res.status(201).json(created);
});

router.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    return res.status(404).json({ error: "Not found" });
  }
  const phase = resolveActivePhase(event.manualPhaseOverride ?? null, event.dateTime, event.timezone);
  res.json({ ...event, activePhase: phase });
});

router.patch("/:id", async (req, res) => {
  const parsed = eventUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;
  try {
    const updated = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...("slug" in data ? { slug: data.slug } : {}),
        ...("name" in data ? { name: data.name } : {}),
        ...("dateTime" in data ? { dateTime: data.dateTime ? new Date(data.dateTime) : undefined } : {}),
        ...("timezone" in data ? { timezone: data.timezone } : {}),
        ...("invitationOnly" in data ? { invitationOnly: data.invitationOnly } : {}),
        ...("featureInvitationWebsite" in data ? { featureInvitationWebsite: data.featureInvitationWebsite } : {}),
        ...("featureRsvp" in data ? { featureRsvp: data.featureRsvp } : {}),
        ...("featureGuestbook" in data ? { featureGuestbook: data.featureGuestbook } : {})
      }
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

router.post("/:id/phase-override", async (req, res) => {
  const body = z.object({ phase: z.enum(["PRE_EVENT","LIVE","POST_EVENT"]).nullable() }).safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }
  const phase = body.data.phase;
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.event.update({ where: { id: existing.id }, data: { manualPhaseOverride: phase ?? null } });
  await prisma.phaseHistory.create({
    data: {
      eventId: existing.id,
      fromPhase: existing.manualPhaseOverride ?? null,
      toPhase: updated.manualPhaseOverride ?? resolveActivePhase(null, updated.dateTime, updated.timezone)
    }
  });
  res.json(updated);
});

router.get("/:id/templates", async (req, res) => {
  const assignments = await prisma.templateAssignment.findMany({
    where: { eventId: req.params.id },
    include: { template: true }
  });
  res.json(assignments);
});

router.post("/:id/templates/assign", async (req, res) => {
  const body = z.object({
    templateType: z.enum(["INVITATION","RSVP","GUESTBOOK","THANK_YOU"]),
    templateId: z.string()
  }).safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }
  const { templateType, templateId } = body.data;
  try {
    const assignment = await prisma.templateAssignment.upsert({
      where: { eventId_templateType: { eventId: req.params.id, templateType } },
      update: { templateId },
      create: { eventId: req.params.id, templateId, templateType }
    });
    res.status(201).json(assignment);
  } catch (e) {
    res.status(400).json({ error: "Invalid event or template" });
  }
});

export default router;


