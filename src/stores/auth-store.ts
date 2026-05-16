import { create } from "zustand";
import type { Candidate } from "@/types/exam";
import { clearSession, loadSession, saveSession } from "@/lib/persistence";

interface AuthState {
  candidate: Candidate | null;
  isHydrated: boolean;
  hydrate: () => void;
  login: (candidate: Candidate) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  candidate: null,
  isHydrated: false,

  hydrate: () => {
    const session = loadSession<{ candidate: Candidate }>();
    set({
      candidate: session?.candidate ?? null,
      isHydrated: true,
    });
  },

  login: (candidate) => {
    saveSession({ candidate });
    set({ candidate });
  },

  logout: () => {
    clearSession();
    set({ candidate: null });
  },
}));
