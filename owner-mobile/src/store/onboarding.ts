import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface OnboardingState {
  complete: boolean;
  hydrated: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  markHydrated: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      complete: false,
      hydrated: false,
      completeOnboarding: () => set({ complete: true }),
      resetOnboarding: () => set({ complete: false }),
      markHydrated: () => set({ hydrated: true })
    }),
    {
      name: 'owner-mobile-onboarding',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ complete: state.complete }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);
