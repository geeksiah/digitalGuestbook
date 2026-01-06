import { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";
import { resolveActivePhase } from "../utils/phase.js";

export async function requireGuestbookAccess(req: Request, res: Response, next: NextFunction) {
  const slug = (req.params as any).slug as string | undefined;
  if (!slug) return res.status(404).send("Not found");
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || !event.featureGuestbook) return res.status(404).send("Not found");
  const phase = resolveActivePhase(event.manualPhaseOverride ?? null, event.dateTime, event.timezone);
  if (phase !== "LIVE") return res.status(403).send("Guestbook not available");
  (req as any).event = event;
  next();
}

export async function requireApprovedIfInvitationOnly(req: Request, res: Response, next: NextFunction) {
  // Optional attendee token param for gated access; if event is invitationOnly and token is provided, verify RSVP approved
  const event = (req as any).event as { id: string; invitationOnly: boolean } | undefined;
  if (!event) return res.status(500).send("Misconfigured");
  if (!event.invitationOnly) return next();
  const token = (req.query.token as string) || (req.header("x-attendee-token") as string) || "";
  if (!token) return res.status(401).send("Unauthorized");
  const invitation = await prisma.invitation.findUnique({ where: { attendeeToken: token }, include: { rsvp: true } });
  if (!invitation || invitation.eventId !== (event as any).id) return res.status(401).send("Unauthorized");
  if (invitation.rsvp.status !== "APPROVED") return res.status(403).send("Access denied");
  (req as any).invitation = invitation;
  next();
}


