import fs from "fs";
import path from "path";
import Mustache from "mustache";
import { config } from "../config.js";

export type RenderContext = {
  event: {
    id: string;
    slug: string;
    name: string;
    dateTimeISO: string;
    timezone: string;
    phase: string;
    features: {
      invitationWebsite: boolean;
      rsvp: boolean;
      guestbook: boolean;
    };
  };
  ctas: {
    rsvpUrl?: string;
    guestbookUrl?: string;
    boothUrl?: string;
    thankYouUrl?: string;
  };
};

export function renderTemplateFromDir(templateDir: string, context: RenderContext): string {
  const indexPath = path.join(templateDir, "index.html");
  const template = fs.readFileSync(indexPath, "utf8");
  return Mustache.render(template, context);
}

export function resolveTemplateDir(storagePath: string): string {
  if (path.isAbsolute(storagePath)) {
    return storagePath;
  }
  return path.join(config.templateStorageDir, storagePath);
}


