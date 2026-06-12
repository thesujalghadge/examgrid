"use client";

import { create } from "zustand";

export const PARENT_ACCESS_STORAGE_KEY = "examgrid:parent-access";

export interface ParentLinkedStudent {
  fullName: string;
  rollNumber: string;
  batchId?: string;
  courseType?: string;
}

interface ParentAccessState {
  linkedStudent: ParentLinkedStudent | null;
  isHydrated: boolean;
  hydrate: () => void;
  linkStudent: (student: ParentLinkedStudent) => void;
  logout: () => void;
}

export const useParentAccessStore = create<ParentAccessState>((set) => ({
  linkedStudent: null,
  isHydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") {
      set({ isHydrated: true });
      return;
    }

    try {
      const raw = localStorage.getItem(PARENT_ACCESS_STORAGE_KEY);
      set({
        linkedStudent: raw ? (JSON.parse(raw) as ParentLinkedStudent) : null,
        isHydrated: true,
      });
    } catch {
      set({ linkedStudent: null, isHydrated: true });
    }
  },

  linkStudent: (student) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(PARENT_ACCESS_STORAGE_KEY, JSON.stringify(student));
    }
    set({ linkedStudent: student });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(PARENT_ACCESS_STORAGE_KEY);
    }
    set({ linkedStudent: null });
  },
}));
