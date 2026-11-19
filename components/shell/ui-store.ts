"use client";
import { create } from "zustand";

/** Global overlays that several screens (and the tour and AI assistant) can open. */
interface UIStore {
  checkIn: { open: boolean; bedId: string | null };
  residentId: string | null;
  bedId: string | null;
  openCheckIn: (bedId?: string | null) => void;
  closeCheckIn: () => void;
  openResident: (id: string | null) => void;
  openBed: (id: string | null) => void;
}
export const useUI = create<UIStore>((set) => ({
  checkIn: { open: false, bedId: null },
  residentId: null,
  bedId: null,
  openCheckIn: (bedId = null) => set({ checkIn: { open: true, bedId }, residentId: null, bedId: null }),
  closeCheckIn: () => set((s) => ({ checkIn: { ...s.checkIn, open: false } })),
  openResident: (residentId) => set({ residentId, bedId: null }),
  openBed: (bedId) => set({ bedId, residentId: null }),
}));
