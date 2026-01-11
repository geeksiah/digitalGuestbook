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

// Owner Account Auth Store (for owner dashboard)
interface Owner {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  isActive: boolean;
}

interface OwnerAuthState {
  token: string | null;
  owner: Owner | null;
  isAuthenticated: boolean;
  setAuth: (token: string, owner: Owner) => void;
  clearAuth: () => void;
}

export const useOwnerAuthStore = create<OwnerAuthState>()(
  persist(
    (set) => ({
      token: null,
      owner: null,
      isAuthenticated: false,
      setAuth: (token, owner) => {
        localStorage.setItem('owner_token', token);
        set({ token, owner, isAuthenticated: true });
      },
      clearAuth: () => {
        localStorage.removeItem('owner_token');
        set({ token: null, owner: null, isAuthenticated: false });
      },
    }),
    {
      name: 'owner-auth-storage',
      partialize: (state) => ({ token: state.token, owner: state.owner }),
    }
  )
);
