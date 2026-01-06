import { Router } from "express";
import path from "path";
import express from "express";
import { prisma } from "../db.js";
import { resolveActivePhase } from "../utils/phase.js";
import { renderTemplateFromDir, resolveTemplateDir } from "../utils/templateRenderer.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { rsvpLimiter } from "../middleware/rateLimiters.js";

const router = Router();

// Serve static assets within template directories
router.use("/templates", express.static(path.resolve("storage/templates")));

router.get("/e/:slug", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event || !event.featureInvitationWebsite) {
    return res.status(404).send("Not found");
  }
  const activePhase = resolveActivePhase(event.manualPhaseOverride ?? null, event.dateTime, event.timezone);

  const assignment = await prisma.templateAssignment.findUnique({
    where: { eventId_templateType: { eventId: event.id, templateType: "INVITATION" } },
    include: { template: true }
  });
  if (!assignment) {
    return res.status(500).send("Template not assigned");
  }
  const templateDir = resolveTemplateDir(assignment.template.storagePath);

  const ctas = {
    rsvpUrl: event.featureRsvp ? `/e/${event.slug}/rsvp` : undefined,
    guestbookUrl: event.featureGuestbook && activePhase === "LIVE" ? `/e/${event.slug}/guestbook` : undefined,
    boothUrl: event.featureGuestbook && activePhase === "LIVE" ? `/e/${event.slug}/booth` : undefined,
    thankYouUrl: `/e/${event.slug}/thanks`
  };
  const html = renderTemplateFromDir(templateDir, {
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      dateTimeISO: event.dateTime.toISOString(),
      timezone: event.timezone,
      phase: activePhase,
      features: {
        invitationWebsite: event.featureInvitationWebsite,
        rsvp: event.featureRsvp,
        guestbook: event.featureGuestbook
      }
    },
    ctas
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// Lightweight RSVP "form" endpoint to render a generic form if RSVP template not yet integrated
router.get("/v1/events/:slug/rsvp-form", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event || !event.featureRsvp) return res.status(404).send("Not found");
  const activePhase = resolveActivePhase(event.manualPhaseOverride ?? null, event.dateTime, event.timezone);
  if (activePhase !== "PRE_EVENT") {
    return res.status(403).send("RSVP is not available in current phase");
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>RSVP — ${event.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 2rem; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { margin-bottom: 1.5rem; color: #333; }
    label { display: block; margin-bottom: 1rem; }
    label span { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555; }
    input, select, textarea { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; }
    button { background: #007bff; color: white; padding: 0.75rem 2rem; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; width: 100%; margin-top: 1rem; }
    button:hover { background: #0056b3; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .message { padding: 1rem; border-radius: 4px; margin-bottom: 1rem; }
    .message.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .message.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
  </style>
</head>
<body>
  <div class="container">
    <h1>RSVP — ${event.name}</h1>
    <div id="message"></div>
    <form id="rsvpForm">
      <label>
        <span>Name(s) *</span>
        <input name="partyName" required />
      </label>
      <label>
        <span>Attendance *</span>
        <select name="response" required>
          <option value="">Select...</option>
          <option value="YES">Yes, I'll be there</option>
          <option value="NO">No, I can't make it</option>
          <option value="MAYBE">Maybe</option>
        </select>
      </label>
      <label>
        <span>Number of Guests</span>
        <input type="number" name="guestCount" min="1" />
      </label>
      <label>
        <span>Meal Preference</span>
        <input name="mealPreference" placeholder="e.g., Vegetarian, Gluten-free" />
      </label>
      <label>
        <span>Email (optional)</span>
        <input type="email" name="contactEmail" />
      </label>
      <label>
        <span>Phone (optional)</span>
        <input type="tel" name="contactPhone" />
      </label>
      <label>
        <span>Note</span>
        <textarea name="note" rows="3"></textarea>
      </label>
      <button type="submit" id="submitBtn">Submit RSVP</button>
    </form>
  </div>
  <script>
    document.getElementById('rsvpForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const msg = document.getElementById('message');
      btn.disabled = true;
      btn.textContent = 'Submitting...';
      msg.innerHTML = '';
      
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      if (data.guestCount) data.guestCount = parseInt(data.guestCount);
      
      try {
        const res = await fetch('/v1/events/${event.slug}/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (res.ok) {
          msg.innerHTML = '<div class="message success">' + (result.message || 'RSVP submitted successfully!') + '</div>';
          e.target.reset();
        } else {
          msg.innerHTML = '<div class="message error">' + (result.error || 'Error submitting RSVP') + '</div>';
        }
      } catch (err) {
        msg.innerHTML = '<div class="message error">Network error. Please try again.</div>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Submit RSVP';
      }
    });
  </script>
</body>
</html>`);
});

const rsvpSchema = z.object({
  partyName: z.string().min(1),
  response: z.enum(["YES","NO","MAYBE"]),
  guestCount: z.coerce.number().int().positive().optional(),
  mealPreference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional()
});

router.post("/v1/events/:slug/rsvp", rsvpLimiter, express.urlencoded({ extended: true }), async (req, res) => {
  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event || !event.featureRsvp) return res.status(404).json({ error: "Not found" });
  const activePhase = resolveActivePhase(event.manualPhaseOverride ?? null, event.dateTime, event.timezone);
  if (activePhase !== "PRE_EVENT") {
    return res.status(403).json({ error: "RSVP not available in current phase" });
  }
  const parsed = rsvpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const payload = parsed.data;
  const status = event.invitationOnly ? "PENDING" : "APPROVED";
  const created = await prisma.rSVP.create({
    data: {
      eventId: event.id,
      partyName: payload.partyName,
      guestCount: payload.guestCount,
      response: payload.response,
      mealPreference: payload.mealPreference || null,
      note: payload.note || null,
      status,
      sourceChannel: "WEB",
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone
    }
  });
  if (status === "PENDING") {
    return res.json({
      ok: true,
      status: "PENDING",
      message: "Thank you for your response. The event organizers will be in touch."
    });
  }
  return res.json({ ok: true, status: "APPROVED" });
});

export default router;


