import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  token: string | null;
  admin: Admin | null;
  isAuthenticated: boolean;
  setAuth: (token: string, admin: Admin) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      isAuthenticated: false,
      setAuth: (token, admin) => {
        localStorage.setItem('admin_token', token);
        set({ token, admin, isAuthenticated: true });
      },
      clearAuth: () => {
        localStorage.removeItem('admin_token');
        set({ token: null, admin: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, admin: state.admin }),
    }
  )
);

// Couple portal auth (separate from admin)
interface CoupleAuthState {
  coupleToken: string | null;
  eventId: string | null;
  setCoupleAuth: (token: string, eventId: string) => void;
  clearCoupleAuth: () => void;
}

export const useCoupleAuthStore = create<CoupleAuthState>()(
  persist(
    (set) => ({
      coupleToken: null,
      eventId: null,
      setCoupleAuth: (coupleToken, eventId) => {
        localStorage.setItem('couple_token', coupleToken);
        set({ coupleToken, eventId });
      },
      clearCoupleAuth: () => {
        localStorage.removeItem('couple_token');
        set({ coupleToken: null, eventId: null });
      },
    }),
    {
      name: 'couple-auth-storage',
    }
  )
);
