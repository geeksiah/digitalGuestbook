import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import { prisma } from "../../db.js";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { config } from "../../config.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const templateCreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INVITATION","RSVP","GUESTBOOK","THANK_YOU"])
});

router.get("/", async (_req, res) => {
  const templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
  res.json(templates);
});

router.post("/", upload.single("bundle"), async (req, res) => {
  const parsed = templateCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  if (!req.file) {
    return res.status(400).json({ error: "bundle file is required (zip)" });
  }
  const { name, type } = parsed.data;
  const created = await prisma.template.create({
    data: { name, type, storagePath: "" }
  });
  const templateDir = path.join(config.templateStorageDir, created.id);
  fs.mkdirSync(templateDir, { recursive: true });

  // Extract zip to templateDir
  const zip = new AdmZip(req.file.buffer);
  zip.extractAllTo(templateDir, true);

  // Ensure index.html exists
  const indexPath = path.join(templateDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    await prisma.template.delete({ where: { id: created.id } });
    fs.rmSync(templateDir, { recursive: true, force: true });
    return res.status(400).json({ error: "Template must contain index.html at root" });
  }
  const updated = await prisma.template.update({
    where: { id: created.id },
    data: { storagePath: created.id }
  });
  res.status(201).json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await prisma.template.delete({ where: { id } });
    const templateDir = path.join(config.templateStorageDir, id);
    if (fs.existsSync(templateDir)) {
      fs.rmSync(templateDir, { recursive: true, force: true });
    }
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

export default router;


