import { useEffect, useState } from 'react';
import { ownerAuthApi } from '../api/client';
import { useSessionStore } from '../store/session';

export const useOwnerBootstrap = () => {
  const token = useSessionStore((state) => state.token);
  const owner = useSessionStore((state) => state.owner);
  const hydrated = useSessionStore((state) => state.hydrated);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setOwner = useSessionStore((state) => state.setOwner);
  const [bootstrapping, setBootstrapping] = useState(false);

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

  return { bootstrapping };
};
