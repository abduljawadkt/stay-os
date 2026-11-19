"use client";

import { Fragment, createContext, useContext, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Clock, GripVertical, Plus, Wrench, ArrowUpDown, Bath, Move } from "lucide-react";
import { Card, PageHeader } from "@/components/common/card";
import { ErrorState, Sk } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";
import { useUI } from "@/components/shell/ui-store";
import { useFormat, useScreenState } from "@/lib/hooks";
import { invoiceState, occupancy, roomById, genderFits, blockIds, blockGender } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";
import { initials } from "@/lib/format";
import { rooms, type Bed, type BlockId, type Resident } from "@/data";
import { cn } from "@/lib/utils";

export function RoomsScreen() {
  const t = useTranslations("rooms");
  const tb = useTranslations("bedStatus");
  const tg = useTranslations("blockGender");
  const f = useFormat();
  const params = useSearchParams();
  const [block, setBlock] = useState<BlockId>((params.get("block") as BlockId) || "A");
  const [floor, setFloor] = useState<number>(Number(params.get("floor")) || 1);
  const highlight = params.get("room");
  const { loading, error, retry } = useScreenState("rooms");
  const beds = useDemo((s) => s.beds);
  const residents = useDemo((s) => s.residents);
  const invoices = useDemo((s) => s.invoices);
  const moveResident = useDemo((s) => s.moveResident);
  const openCheckIn = useUI((s) => s.openCheckIn);
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, setPending] = useState<{ residentId: string; from: string; to: string } | null>(null);

  const today = todayISO();
  const resById = useMemo(() => Object.fromEntries(residents.map((r) => [r.id, r])), [residents]);
  const overdue = useMemo(() => {
    const s = new Set<string>();
    for (const i of invoices) if (i.status === "unpaid" && invoiceState(i, today).state === "overdue") s.add(i.residentId);
    return s;
  }, [invoices, today]);
  const all = occupancy(beds);
  const floorBeds = beds.filter((b) => b.block === block && b.floor === floor);
  const floorOcc = occupancy(floorBeds);
  const floorRooms = rooms.filter((r) => r.block === block && r.floor === floor);
  const topRow = floorRooms.filter((r) => ["single", "double"].includes(r.type));
  const bottomRow = floorRooms.filter((r) => ["triple", "six"].includes(r.type));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const from = String(e.active.id);
    const to = e.over ? String(e.over.id) : null;
    if (!to || to === from) return;
    const fromBed = beds.find((b) => b.id === from);
    const toBed = beds.find((b) => b.id === to);
    if (!fromBed?.residentId || toBed?.status !== "vacant") return;
    setPending({ residentId: fromBed.residentId, from, to });
  };
  const draggingBed = dragging ? beds.find((b) => b.id === dragging) : null;
  const draggingRes = draggingBed?.residentId ? resById[draggingBed.residentId] : null;

  const pr = pending ? resById[pending.residentId] : null;
  const fromRent = pending ? roomById[pending.from.split("-").slice(0, 2).join("-")].rent : 0;
  const toRent = pending ? roomById[pending.to.split("-").slice(0, 2).join("-")].rent : 0;
  const genderBlock = (b: string, r: Resident | null) => !r || genderFits(b, r.gender);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={loading ? " " : t("subtitle", { occupied: all.occupied, vacant: all.vacant, reserved: all.reserved, maintenance: all.maintenance })}
        actions={<Button variant="primary" onClick={() => openCheckIn()} data-tour="checkin-button"><Plus /> {t("checkIn")}</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label={t("blocks")} className="flex gap-1 rounded-md bg-surface-2 p-0.5">
          {(blockIds() as BlockId[]).map((b) => (
            <button key={b} role="tab" aria-selected={block === b} onClick={() => setBlock(b)} className={cn("h-8 rounded-sm px-3 text-sm font-medium transition-colors", block === b ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2 hover:text-fg")}>
              {t("block", { block: b })} <span className="text-xs font-normal text-fg-3">· {tg(blockGender(b))}</span>
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label={t("floor")} className="flex gap-1 rounded-md bg-surface-2 p-0.5">
          {[1, 2, 3, 4].map((fl) => (
            <button key={fl} role="radio" aria-checked={floor === fl} onClick={() => setFloor(fl)} className={cn("h-8 min-w-9 rounded-sm px-2.5 text-sm font-medium transition-colors", floor === fl ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2 hover:text-fg")}>
              {t("floorShort", { n: fl })}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2" aria-label={t("legend")}>
          {(["occupied", "vacant", "reserved", "maintenance"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs text-fg-2">
              <BedSwatch status={s} /> {tb(s)} <span className="text-fg-3 tnum">{loading ? "" : floorOcc[s]}</span>
            </span>
          ))}
        </div>
      </div>

      {error ? (
        <Card><ErrorState what={t("what")} onRetry={retry} /></Card>
      ) : (
        <RoomsCtx.Provider value={{ beds, resById, overdue, dragging, highlight, today }}>
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <Card className="overflow-hidden" data-tour="floorplan">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <p className="text-sm font-semibold text-fg">{t("floorTitle", { block, floor })}</p>
              <p className="hidden items-center gap-1.5 text-xs text-fg-3 sm:flex"><Move className="size-3.5" aria-hidden /> {t("dragHint")}</p>
            </div>
            <div className="scrollbar-thin overflow-x-auto p-4 sm:p-5">
              <div className="min-w-[760px]">
                <FloorRow rooms={topRow} loading={loading} />
                <div className="my-3 flex items-center gap-3" aria-hidden>
                  <span className="flex items-center gap-1 rounded-sm bg-surface-2 px-2 py-1 text-xs text-fg-3"><ArrowUpDown className="size-3" /> {t("stairs")}</span>
                  <div className="h-px flex-1 border-t border-dashed border-line-strong" />
                  <span className="text-xs tracking-wide text-fg-3">{t("corridor")}</span>
                  <div className="h-px flex-1 border-t border-dashed border-line-strong" />
                  <span className="flex items-center gap-1 rounded-sm bg-surface-2 px-2 py-1 text-xs text-fg-3"><Bath className="size-3" /> {t("washrooms")}</span>
                </div>
                <FloorRow rooms={bottomRow} loading={loading} />
              </div>
            </div>
          </Card>

          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(.2,0,0,1)" }}>
            {draggingRes ? (
              <div className="grid h-12 w-10 scale-[1.04] place-items-center rounded-sm bg-brand text-xs font-medium text-white shadow-lg">{initials(draggingRes.name)}</div>
            ) : null}
          </DragOverlay>
        </DndContext>
        </RoomsCtx.Provider>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pr ? t("moveTitle", { name: pr.name }) : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && t("moveBody", { from: pending.from, to: pending.to })}{" "}
              {pending && (fromRent === toRent ? t("rentSame", { rent: f.inr(fromRent) }) : t("rentChange", { from: f.inr(fromRent), to: f.inr(toRent) }))}
              {pending && pr && !genderBlock(pending.to[0], pr) && <span className="mt-2 block text-danger-fg">{t("genderWarn")}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!(pending && pr && !genderBlock(pending.to[0], pr))}
              onClick={() => pending && moveResident(pending.residentId, pending.to)}
            >
              {t("moveConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

}


type Ctx = {
  beds: Bed[];
  resById: Record<string, Resident>;
  overdue: Set<string>;
  dragging: string | null;
  highlight: string | null;
  today: string;
};
const RoomsCtx = createContext<Ctx>(null as unknown as Ctx);

function FloorRow({ rooms: list, loading: l }: { rooms: typeof rooms; loading: boolean }) {
  const { beds, resById, overdue, dragging, highlight } = useContext(RoomsCtx);
  const t = useTranslations("rooms");
  const f = useFormat();
  return (
    <div className="flex gap-3">
      {list.map((room) => (
        <div
          key={room.id}
          id={`room-${room.id}`}
          className={cn(
            "rounded-lg border bg-surface p-3 transition-colors hover:border-line-strong",
            highlight === room.id ? "border-brand ring-2 ring-brand/20" : "border-line",
            room.type === "six" ? "flex-[6]" : room.type === "triple" ? "flex-[3]" : room.type === "double" ? "flex-[2]" : "flex-[1.2]"
          )}
        >
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-small font-medium text-fg">{room.id}</span>
            <span className="truncate text-xs text-fg-3">{f.inrCompact(room.rent)}</span>
          </div>
          <p className="-mt-2 mb-2 truncate text-xs text-fg-3">{t(`type.${room.type}`)}</p>
          <div className="flex flex-wrap gap-1.5">
            {beds.filter((b) => b.roomId === room.id).map((b) =>
              l ? <Sk key={b.id} className="h-12 w-10 rounded-sm" /> : (
                <BedTile key={b.id} bed={b} resident={b.residentId ? resById[b.residentId] : undefined} overdue={!!b.residentId && overdue.has(b.residentId)} dimmed={!!dragging && b.status !== "vacant" && b.id !== dragging} />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function BedTile({ bed, resident, overdue: od, dimmed }: { bed: Bed; resident?: Resident; overdue: boolean; dimmed: boolean }) {
  const t = useTranslations("rooms");
  const tb = useTranslations("bedStatus");
  const f = useFormat();
  const { today } = useContext(RoomsCtx);
  const openResident = useUI((s) => s.openResident);
  const openBed = useUI((s) => s.openBed);
  const label = t("bedAria", {
    bed: `${bed.roomId} ${t("bed", { n: bed.label })}`,
    status: tb(bed.status),
    name: resident?.name ?? "none",
    overdue: od ? "yes" : "no",
  });
  const onClick = () => (resident ? openResident(resident.id) : openBed(bed.id));
  if (bed.status === "occupied" && resident) return <OccupiedTile bed={bed} resident={resident} overdue={od} label={label} onClick={onClick} dimmed={dimmed} />;
  if (bed.status === "vacant") return <VacantTile bed={bed} label={label} onClick={onClick} />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
          className={cn(
            "grid h-12 w-10 place-items-center rounded-sm transition-opacity",
            bed.status === "reserved" ? "border border-warning bg-warning-tint text-warning-fg" : "bg-hatch text-fg-3",
            dimmed && "opacity-40"
          )}
        >
          {bed.status === "reserved" ? <Clock className="size-4" aria-hidden /> : <Wrench className="size-4" aria-hidden />}
        </button>
      </TooltipTrigger>
      <TooltipContent>{bed.status === "reserved" ? t("reservedFor", { name: bed.reservation?.name ?? "", date: f.day(bed.reservation?.from ?? today) }) : bed.maintenanceNote}</TooltipContent>
    </Tooltip>
  );
}

function OccupiedTile({ bed, resident, overdue: od, label, onClick, dimmed }: { bed: Bed; resident: Resident; overdue: boolean; label: string; onClick: () => void; dimmed: boolean }) {
  const t = useTranslations("rooms");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: bed.id });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          layoutId={`res-${resident.id}`}
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          onClick={onClick}
          aria-label={label}
          aria-roledescription={t("draggable")}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className={cn(
            "group relative grid h-12 w-10 cursor-grab touch-none place-items-center rounded-sm bg-brand text-xs font-medium text-white transition-opacity active:cursor-grabbing",
            isDragging && "opacity-30",
            dimmed && "opacity-40"
          )}
        >
          {initials(resident.name)}
          <GripVertical className="absolute bottom-0.5 size-3 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
          {od && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-danger ring-1 ring-white" aria-hidden />}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>{resident.name}{od ? ` · ${t("overdue")}` : ""}</TooltipContent>
    </Tooltip>
  );
}

function VacantTile({ bed, label, onClick }: { bed: Bed; label: string; onClick: () => void }) {
  const { dragging } = useContext(RoomsCtx);
  const { setNodeRef, isOver } = useDroppable({ id: bed.id });
  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      aria-label={label}
      data-tour={`bed-${bed.id}`}
      className={cn(
        "group grid h-12 w-10 place-items-center rounded-sm border-[1.5px] border-dashed text-fg-3 transition-colors",
        isOver ? "border-brand bg-brand-tint text-brand-tint-fg" : dragging ? "border-brand/70 text-brand-text" : "border-line-input hover:border-brand hover:text-brand-text"
      )}
    >
      <Plus className={cn("size-4 transition-opacity", isOver || dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")} aria-hidden />
    </button>
  );
}

export function BedSwatch({ status }: { status: Bed["status"] }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-3.5 w-3 rounded-xs",
        status === "occupied" && "bg-brand",
        status === "vacant" && "border border-dashed border-line-input",
        status === "reserved" && "border border-warning bg-warning-tint",
        status === "maintenance" && "bg-hatch"
      )}
    />
  );
}

export function RoomsFallback() {
  return <Fragment />;
}
