import { Router } from "express";
import { prisma } from "../db.js";
import { requireCoupleForEvent } from "../middleware/coupleAuth.js";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import archiver from "archiver";

const router = Router();

router.get("/v1/couple/events/:eventId/media", requireCoupleForEvent, async (req, res) => {
  const eventId = req.coupleEvent!.id;
  const assets = await prisma.mediaAsset.findMany({
    where: { eventId, status: "READY" },
    orderBy: { createdAt: "desc" }
  });
  const items = assets
    .filter(a => a.originalPath && fs.existsSync(a.originalPath))
    .map(a => ({
      id: a.id,
      type: a.type,
      source: a.source,
      durationSec: a.durationSec,
      createdAt: a.createdAt,
      downloadUrl: `/v1/couple/media/${a.id}/file`
    }));
  res.json(items);
});

router.get("/v1/couple/media/:assetId/file", async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.assetId }, include: { event: true } });
  if (!asset || !asset.originalPath || !fs.existsSync(asset.originalPath)) {
    return res.status(404).json({ error: "Not found" });
  }
  const key = req.header("x-couple-key");
  if (!key || key !== asset.event.coupleAccessKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const ctype = mime.lookup(path.extname(asset.originalPath)) || "application/octet-stream";
  res.setHeader("Content-Type", ctype as string);
  res.setHeader("Content-Disposition", `inline; filename="${path.basename(asset.originalPath)}"`);
  fs.createReadStream(asset.originalPath).pipe(res);
});

router.get("/v1/couple/events/:eventId/media.zip", requireCoupleForEvent, async (req, res) => {
  const eventId = req.coupleEvent!.id;
  const assets = await prisma.mediaAsset.findMany({
    where: { eventId, status: "READY" },
    orderBy: { createdAt: "asc" }
  });
  const files = assets.filter(a => a.originalPath && fs.existsSync(a.originalPath));
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="media-${eventId}.zip"`);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", err => {
    res.status(500).end();
  });
  archive.pipe(res);
  for (const a of files) {
    const ext = path.extname(a.originalPath);
    const name = `${a.createdAt.toISOString().replace(/[:.]/g, "-")}_${a.type}_${a.id}${ext}`;
    archive.file(a.originalPath, { name });
  }
  archive.finalize();
});

export default router;


