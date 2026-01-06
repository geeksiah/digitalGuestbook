import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config.js";
import { requireAdminApiKey } from "./middleware/adminAuth.js";
import adminEventsRouter from "./routes/admin/events.js";
import adminTemplatesRouter from "./routes/admin/templates.js";
import adminCheckinDevicesRouter from "./routes/admin/checkinDevices.js";
import publicRouter from "./routes/public.js";
import coupleRouter from "./routes/couple.js";
import invitationCardRouter from "./routes/invitationCard.js";
import checkinRouter from "./routes/checkin.js";
import checkinUiRouter from "./routes/checkinUi.js";
import mediaRouter from "./routes/media.js";
import guestbookUiRouter from "./routes/guestbookUi.js";
import coupleMediaRouter from "./routes/coupleMedia.js";
import broadcastsRouter from "./routes/broadcasts.js";
import publicPagesRouter from "./routes/publicPages.js";
import devSeedRouter from "./routes/admin/devSeed.js";
import fs from "fs";
import path from "path";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Ensure template storage directory exists
fs.mkdirSync(config.templateStorageDir, { recursive: true });

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Admin routes
app.use("/v1/admin/events", requireAdminApiKey, adminEventsRouter);
app.use("/v1/admin/templates", requireAdminApiKey, adminTemplatesRouter);
app.use("/v1/admin", requireAdminApiKey, adminCheckinDevicesRouter);

// Public/guest routes
app.use(publicRouter);
// Couple routes
app.use(coupleRouter);
app.use(invitationCardRouter);
app.use(checkinRouter);
app.use(checkinUiRouter);
app.use(mediaRouter);
app.use(guestbookUiRouter);
app.use(coupleMediaRouter);
app.use(broadcastsRouter);
app.use(publicPagesRouter);
app.use(devSeedRouter);

// Serve static frontend files
app.use("/admin", express.static(path.join(process.cwd(), "public", "admin")));
app.use("/couple", express.static(path.join(process.cwd(), "public", "couple")));

// Static: serve uploaded templates root directory listing blocked
app.use("/storage/templates", (_req, res) => res.status(403).send("Forbidden"));

// Fallback
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${config.port}`);
});


