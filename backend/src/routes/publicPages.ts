import { Router } from "express";
import { prisma } from "../db.js";
import { resolveActivePhase } from "../utils/phase.js";
import { Prisma } from "@prisma/client";
import { renderTemplateFromDir, resolveTemplateDir } from "../utils/templateRenderer.js";

const router = Router();

router.get("/e/:slug/rsvp", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event || !event.featureRsvp) return res.status(404).send("Not found");
  const phase = resolveActivePhase(event.manualPhaseOverride ?? null, event.dateTime, event.timezone);
  if (phase !== "PRE_EVENT") return res.status(403).send("RSVP not available");
  const assignment = await prisma.templateAssignment.findUnique({
    where: { eventId_templateType: { eventId: event.id, templateType: "RSVP" } },
    include: { template: true }
  });
  if (!assignment) return res.status(500).send("RSVP template not assigned");
  const templateDir = resolveTemplateDir(assignment.template.storagePath);
  const html = renderTemplateFromDir(templateDir, {
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      dateTimeISO: event.dateTime.toISOString(),
      timezone: event.timezone,
      phase,
      features: {
        invitationWebsite: event.featureInvitationWebsite,
        rsvp: event.featureRsvp,
        guestbook: event.featureGuestbook
      }
    },
    ctas: {
      rsvpUrl: `/v1/events/${event.slug}/rsvp`,
      guestbookUrl: event.featureGuestbook ? `/e/${event.slug}/guestbook` : undefined,
      thankYouUrl: `/e/${event.slug}/thanks`
    }
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

router.get("/e/:slug/thanks", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event) return res.status(404).send("Not found");
  const phase = resolveActivePhase(event.manualPhaseOverride ?? null, event.dateTime, event.timezone);
  if (phase !== "POST_EVENT") return res.status(403).send("Thank-you page available post-event only");
  const assignment = await prisma.templateAssignment.findUnique({
    where: { eventId_templateType: { eventId: event.id, templateType: "THANK_YOU" } },
    include: { template: true }
  });
  if (!assignment) return res.status(500).send("Thank-you template not assigned");
  const templateDir = resolveTemplateDir(assignment.template.storagePath);
  const html = renderTemplateFromDir(templateDir, {
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      dateTimeISO: event.dateTime.toISOString(),
      timezone: event.timezone,
      phase,
      features: {
        invitationWebsite: event.featureInvitationWebsite,
        rsvp: event.featureRsvp,
        guestbook: event.featureGuestbook
      }
    },
    ctas: {}
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;


