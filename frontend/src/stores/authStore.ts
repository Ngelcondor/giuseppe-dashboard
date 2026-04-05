import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  twoFARequired: boolean;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setTwoFARequired: (required: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      twoFARequired: false,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),
      setToken: (token) =>
        set({
          token,
        }),
      setTwoFARequired: (required) =>
        set({
          twoFARequired: required,
        }),
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          twoFARequired: false,
        }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
