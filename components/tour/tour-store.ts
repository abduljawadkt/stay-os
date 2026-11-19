"use client";
import { create } from "zustand";
import { toast } from "sonner";
import { useDemo } from "@/lib/store";
import { useSession } from "@/lib/session";

interface TourState {
  active: boolean;
  preparing: boolean;
  index: number;
  start: () => Promise<void>;
  stop: () => void;
  goto: (i: number) => void;
}
export const useTour = create<TourState>((set, get) => ({
  active: false,
  preparing: false,
  index: 0,
  // the story always starts from fresh sample data (the owner of a sample hostel can reset it)
  start: async () => {
    if (get().preparing) return;
    const d = useDemo.getState();
    d.closeWhatsApp();
    d.setAiOpen(false);
    const s = useSession.getState();
    if (s.membership?.role === "owner" && s.org?.settings.clock?.mode === "demo") {
      set({ preparing: true });
      const id = toast.loading("Preparing a fresh copy of the sample hostel…");
      try {
        await d.reset();
        toast.dismiss(id);
      } catch (e) {
        toast.error("Could not reset the sample data", { id, description: e instanceof Error ? e.message : undefined });
      }
      set({ preparing: false });
    }
    set({ active: true, index: 0 });
  },
  stop: () => set({ active: false, index: 0 }),
  goto: (index) => set({ index }),
}));
