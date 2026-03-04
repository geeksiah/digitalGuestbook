"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const cleanupMarkerKey = "ep_sw_cleanup_done_v2";
    const shouldRegister = process.env.NEXT_PUBLIC_ENABLE_SW === "1";

    const cleanupLegacyWorkersAndCaches = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch (error) {
        console.warn("Failed to unregister legacy service workers:", error);
      }

      if (!("caches" in globalThis)) return;

      try {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys
            .filter((key) => key.startsWith("ep-") || key.startsWith("workbox-") || key.includes("_next"))
            .map((key) => caches.delete(key))
        );
      } catch (error) {
        console.warn("Failed to clear legacy caches:", error);
      }
    };

    const registerWorker = async () => {
      if (globalThis.localStorage.getItem(cleanupMarkerKey) === "1" && !shouldRegister) {
        return;
      }
      await cleanupLegacyWorkersAndCaches();
      globalThis.localStorage.setItem(cleanupMarkerKey, "1");

      if (!shouldRegister) {
        return;
      }

      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.warn("SW registration failed. Retrying with cache cleanup:", error);
        await cleanupLegacyWorkersAndCaches();
      }
    };

    void registerWorker();
  }, []);

  return null;
}
