"use client";
import { create } from "zustand";

/** Lets the tour (or any screen) ask Ask StayOS a question, typed in front of the viewer. */
export const useAsk = create<{ pending: string | null; ask: (q: string) => void; clear: () => void }>((set) => ({
  pending: null,
  ask: (q) => set({ pending: q }),
  clear: () => set({ pending: null }),
}));
