import { Router } from "express";
import { prisma } from "../db.js";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { mediaInitLimiter, mediaUploadLimiter } from "../middleware/rateLimiters.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const router = Router();

const initSchema = z.object({
  eventSlug: z.string().min(1),
  type: z.enum(["VIDEO", "AUDIO", "PHOTO"]),
  source: z.enum(["PERSONAL", "BOOTH"]),
  durationSec: z.number().int().positive().optional()
});

router.post("/v1/media/upload-init", mediaInitLimiter, async (req, res) => {
  const parsed = initSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { eventSlug, type, source, durationSec } = parsed.data;
  const event = await prisma.event.findUnique({ where: { slug: eventSlug } });
  if (!event || !event.featureGuestbook) return res.status(404).json({ error: "Not found" });
  const asset = await prisma.mediaAsset.create({
    data: {
      eventId: event.id,
      type,
      source,
      durationSec: durationSec ?? null,
      originalPath: ""
    }
  });
  res.json({ assetId: asset.id, uploadUrl: `/v1/media/upload/${asset.id}` });
});

router.post("/v1/media/upload/:assetId", mediaUploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.assetId }, include: { event: true } });
  if (!asset) return res.status(404).json({ error: "Not found" });
  // Store locally
  const dir = path.join("storage", "media", asset.eventId);
  fs.mkdirSync(dir, { recursive: true });
  const extension = mimeFromBuffer(req.file.mimetype) || extFromMime(req.file.mimetype) || "";
  const filename = `${asset.id}${extension}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, req.file.buffer);
  await prisma.mediaAsset.update({ where: { id: asset.id }, data: { originalPath: filePath, status: "READY" } });
  res.json({ ok: true, assetId: asset.id });
});

function extFromMime(mime: string) {
  if (mime === "video/mp4") return ".mp4";
  if (mime === "audio/mpeg") return ".mp3";
  if (mime === "audio/mp4") return ".m4a";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  return "";
}

function mimeFromBuffer(mime: string) {
  // placeholder to keep interface; rely on provided mimetype
  return "";
}

export default router;


