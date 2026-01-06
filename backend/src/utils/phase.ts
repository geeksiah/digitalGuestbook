import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezonePlugin from "dayjs/plugin/timezone.js";
import { Prisma } from "@prisma/client";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export function computeAutoPhase(dateTimeISO: Date, timezone: string): Prisma.Phase {
  const now = dayjs().tz(timezone);
  const eventTime = dayjs(dateTimeISO).tz(timezone);
  if (now.isBefore(eventTime)) {
    return "PRE_EVENT";
  }
  // Treat the day of the event as LIVE; after that POST_EVENT
  if (now.isSame(eventTime, "day")) {
    return "LIVE";
  }
  return "POST_EVENT";
}

export function resolveActivePhase(manualPhaseOverride: Prisma.Phase | null, dateTimeISO: Date, timezone: string): Prisma.Phase {
  if (manualPhaseOverride) {
    return manualPhaseOverride;
  }
  return computeAutoPhase(dateTimeISO, timezone);
}


