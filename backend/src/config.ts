import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  adminApiKey: process.env.ADMIN_API_KEY || "change-me",
  databaseUrl: process.env.DATABASE_URL || "file:./dev.db",
  templateStorageDir: path.resolve(process.cwd(), process.env.TEMPLATE_STORAGE_DIR || "./storage/templates")
};


