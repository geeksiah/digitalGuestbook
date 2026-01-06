import { Router } from "express";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { prisma } from "../db.js";

const router = Router();

router.get("/v1/couple/rsvps/:rsvpId/invitation-card.pdf", async (req, res) => {
  const rsvp = await prisma.rSVP.findUnique({
    where: { id: req.params.rsvpId },
    include: { event: true, invitation: true }
  });
  if (!rsvp || !rsvp.invitation) return res.status(404).send("Not found");
  const eventKey = req.header("x-couple-key");
  if (!eventKey || rsvp.event.coupleAccessKey !== eventKey) return res.status(401).json({ error: "Unauthorized" });

  const qrDataUrl = await QRCode.toDataURL(rsvp.invitation.qrPayload, { margin: 1, width: 300 });
  const doc = new PDFDocument({ size: "A6", layout: "portrait", margin: 24 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="invitation-${rsvp.id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).text(rsvp.event.name, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).text(new Date(rsvp.event.dateTime).toLocaleString("en-US", { timeZone: rsvp.event.timezone }), { align: "center" });
  doc.moveDown(1);

  const label = `Guest: ${rsvp.partyName}`;
  doc.fontSize(12).text(label, { align: "center" });
  doc.moveDown(1);

  // Render QR
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");
  const qrSize = 180;
  const pageWidth = doc.page.width;
  const x = (pageWidth - qrSize) / 2;
  doc.image(qrBuffer, x, doc.y, { width: qrSize, height: qrSize });
  doc.moveDown(1.2);

  doc.fontSize(14).text(`Code: ${rsvp.invitation.sixDigitCode}`, { align: "center" });
  doc.end();
});

export default router;


