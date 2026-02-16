import { useEffect, useState } from 'react';
import { ownerAuthApi, ownerDashboardApi, publicApi } from '../api/client';
import { useSessionStore } from '../store/session';

export const useOwnerBootstrap = () => {
  const token = useSessionStore((state) => state.token);
  const owner = useSessionStore((state) => state.owner);
  const hydrated = useSessionStore((state) => state.hydrated);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setOwner = useSessionStore((state) => state.setOwner);
  const [bootstrapping, setBootstrapping] = useState(false);

  const detectPlatform = (): 'android' | 'ios' => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios';
    return 'android';
  };

  useEffect(() => {
    const hydrateOwner = async () => {
      if (!hydrated || !token || owner) return;
      setBootstrapping(true);
      try {
        const response = await ownerAuthApi.me();
        setOwner(response.data.owner);
      } catch {
        clearSession();
      } finally {
        setBootstrapping(false);
      }
    };

    void hydrateOwner();
  }, [hydrated, token, owner, setOwner, clearSession]);

  useEffect(() => {
    const registerDeviceAndCheckVersion = async () => {
      if (!token) return;
      const platform = detectPlatform();
      const version = import.meta.env.VITE_APP_VERSION || '0.1.0';

      await ownerDashboardApi.registerDevice({
        platform,
        appVersion: version,
      }).catch(() => null);

      const response = await publicApi.checkMobileVersion(platform, version).catch(() => null);
      const payload = response?.data;
      if (!payload) return;
      if (payload.status === 'UP_TO_DATE') return;

      const message = payload.status === 'UPDATE_REQUIRED'
        ? `A critical update is required. Current: ${version}, minimum: ${payload.minimumVersion}.`
        : `A newer app version is available (${payload.latestVersion}).`;
      const shouldOpen = window.confirm(`${message}\n\nOpen store page now?`);
      if (shouldOpen && payload.storeUrl) {
        window.open(payload.storeUrl, '_blank', 'noopener,noreferrer');
      }
    };

    void registerDeviceAndCheckVersion();
  }, [token]);

  return { bootstrapping };
};
