"use client";
import { create } from "zustand";

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
  start: () => set({ active: true, index: 0 }),
  stop: () => set({ active: false, index: 0 }),
  goto: (index) => set({ index }),
}));
