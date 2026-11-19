"use client";
import { create } from "zustand";
import { useDemo } from "@/lib/store";

interface TourState {
  active: boolean;
  index: number;
  start: () => void;
  stop: () => void;
  goto: (i: number) => void;
}
export const useTour = create<TourState>((set) => ({
  active: false,
  index: 0,
  // the story always starts from fresh data
  start: () => {
    const d = useDemo.getState();
    d.reset();
    d.closeWhatsApp();
    d.setAiOpen(false);
    set({ active: true, index: 0 });
  },
  stop: () => set({ active: false, index: 0 }),
  goto: (index) => set({ index }),
}));
