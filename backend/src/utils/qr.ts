import { signQrPayload } from "./credentials.js";

export type QrPayload = {
  e: string;
  t: string;
  c: string;
  s: string;
};

export function verifyQrPayload(input: unknown): input is QrPayload {
  if (typeof input !== "object" || input === null) return false;
  const p = input as any;
  return typeof p.e === "string" && typeof p.t === "string" && typeof p.c === "string" && typeof p.s === "string";
}

export function isQrSignatureValid(payload: { e: string; t: string; c: string; s: string }): boolean {
  const { s, ...unsigned } = payload;
  const expected = signQrPayload(unsigned);
  return s === expected;
}


