import crypto from "crypto";
import { config } from "../config.js";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateAttendeeToken(length = 22): string {
  const bytes = crypto.randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i++) {
    token += BASE62[bytes[i] % BASE62.length];
  }
  return `att_${token}`;
}

export function generateSixDigitCode(): string {
  const num = crypto.randomInt(0, 1000000);
  return num.toString().padStart(6, "0");
}

export function signQrPayload(payload: Record<string, unknown>): string {
  const secret = process.env.QR_SIGNING_SECRET || "change-me-secret";
  const json = JSON.stringify(payload);
  return crypto.createHmac("sha256", secret).update(json).digest("hex");
}


