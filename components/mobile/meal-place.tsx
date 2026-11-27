"use client";

import { useTranslations } from "next-intl";
import { GraduationCap, Home } from "lucide-react";
import { hostel, type MealOptOut, type MealPlace, type PlaceMeal } from "@/data";
import { blockOfBed, mealPlace, placeBlock } from "@/lib/selectors";
import { cn } from "@/lib/utils";

export const blockName = (id: string) => hostel.blocks.find((b) => b.id === id)?.name ?? `Block ${id}`;

/** A short label for where a meal is had: "Institute", "Hostel", or the block's name when the hostel has several. */
export function usePlaceLabel() {
  const t = useTranslations("mobile.mess");
  return (place: MealPlace, bedId: string) => {
    const b = placeBlock(place, blockOfBed(bedId));
    if (b === null) return t("atInstitute");
    return hostel.blocks.length > 1 ? blockName(b) : t("atHostel");
  };
}

/**
 * Where a resident has breakfast, lunch or dinner on a day: at their institute or at the hostel, and in a hostel with
 * more than one block, which block's dining (their own first).
 */
export function MealPlacePicker({ meal, optOut, bedId, disabled, onChange }: {
  meal: PlaceMeal; optOut: MealOptOut | undefined; bedId: string; disabled?: boolean; onChange: (place: MealPlace) => void;
}) {
  const t = useTranslations("mobile.mess");
  const tm = useTranslations("meals");
  const own = blockOfBed(bedId);
  const at = placeBlock(mealPlace(optOut, meal), own); // null: at the institute
  const blocks = [...hostel.blocks].sort((a, b) => (a.id === own ? -1 : b.id === own ? 1 : a.id.localeCompare(b.id)));
  const label = t("mealAt", { meal: tm(meal) });
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center gap-3">
        <span className="text-small text-fg-2">{label}</span>
        <div role="radiogroup" aria-label={label} className="ml-auto grid grid-cols-2 rounded-[10px] bg-surface-2 p-0.5">
          {(["institute", "hostel"] as const).map((spot) => {
            const on = spot === "institute" ? at === null : at !== null;
            const Icon = spot === "institute" ? GraduationCap : Home;
            return (
              <button key={spot} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => !on && onChange(spot)}
                className={cn("flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-60", on ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2")}>
                <Icon className="size-4" aria-hidden />{spot === "institute" ? t("atInstitute") : t("atHostel")}
              </button>
            );
          })}
        </div>
      </div>
      {at !== null && blocks.length > 1 && (
        <div role="radiogroup" aria-label={t("whichBlock", { meal: tm(meal) })} className="no-scrollbar -mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1">
          {blocks.map((b) => {
            const on = at === b.id;
            return (
              <button key={b.id} type="button" role="radio" aria-checked={on} disabled={disabled}
                onClick={() => !on && onChange(b.id === own ? "hostel" : `block:${b.id}`)}
                className={cn("h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors disabled:opacity-60", on ? "border-brand bg-brand-tint text-brand-tint-fg" : "border-line bg-surface text-fg-2")}>
                {b.name}{b.id === own ? ` · ${t("yours")}` : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
