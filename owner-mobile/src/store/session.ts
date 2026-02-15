import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Owner } from '../types/domain';

interface SessionState {
  token: string | null;
  owner: Owner | null;
  hydrated: boolean;
  setSession: (token: string, owner: Owner) => void;
  clearSession: () => void;
  setOwner: (owner: Owner) => void;
  markHydrated: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      owner: null,
      hydrated: false,
      setSession: (token, owner) => set({ token, owner }),
      clearSession: () => set({ token: null, owner: null }),
      setOwner: (owner) => set({ owner }),
      markHydrated: () => set({ hydrated: true })
    }),
    {
      name: 'owner-mobile-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, owner: state.owner }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);
