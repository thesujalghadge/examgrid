import { create } from "zustand";
import { STORAGE_KEYS } from "@/repositories/storage-keys";

export interface AdminUser {
  email: string;
  name: string;
}

interface AdminAuthState {
  admin: AdminUser | null;
  isHydrated: boolean;
  hydrate: () => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  admin: null,
  isHydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") {
      set({ isHydrated: true });
      return;
    }
    const raw = sessionStorage.getItem(STORAGE_KEYS.adminSession);
    if (!raw) {
      set({ admin: null, isHydrated: true });
      return;
    }
    try {
      set({ admin: JSON.parse(raw) as AdminUser, isHydrated: true });
    } catch {
      set({ admin: null, isHydrated: true });
    }
  },

  login: (email, password) => {
    if (!email.trim() || password.length < 4) return false;
    const admin: AdminUser = {
      email: email.trim(),
      name: email.split("@")[0] || "Admin",
    };
    sessionStorage.setItem(STORAGE_KEYS.adminSession, JSON.stringify(admin));
    set({ admin });
    return true;
  },

  logout: () => {
    sessionStorage.removeItem(STORAGE_KEYS.adminSession);
    set({ admin: null });
  },
}));
