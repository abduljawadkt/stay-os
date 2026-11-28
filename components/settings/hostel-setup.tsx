"use client";

// Settings → Hostel setup: what was fixed when the hostel was created. Rent for each room type, the blocks (name, men or
// women, gate time), the rooms and their beds, and until when residents can change a meal. Owner only; the shared live
// demo shows it read-only. Saving goes through lib/setup.ts, which loads the hostel again so every screen follows.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardHeader } from "@/components/common/card";
import { Field } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/lib/store";
import { useSession } from "@/lib/session";
import { useBlockName, useFormat } from "@/lib/hooks";
import { MEALS, cutoffParts, floorsOf } from "@/lib/selectors";
import { CAPACITY, ROOM_TYPES, addRoom, nextBlockId, removeRoom, setBlocks, setCutoffs, setRents, setRoomType, type BlockSetup } from "@/lib/setup";
import { hostel, messMenu, rooms, type Gender, type Meal, type RoomType } from "@/data";
import { cn } from "@/lib/utils";

const SELECT = "h-11 w-full rounded-md border border-input bg-surface px-2.5 text-base md:h-9 md:text-sm focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 focus-visible:outline-none disabled:opacity-60";

/** The database explains in English; say the common ones in the app's language. */
function useSetupError() {
  const t = useTranslations("settings.setup.err");
  return (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    let m: RegExpMatchArray | null;
    if ((m = msg.match(/bed (.+) is taken/))) return t("taken", { bed: m[1] });
    if ((m = msg.match(/room (.+) is already there/))) return t("exists", { room: m[1] });
    if ((m = msg.match(/block (.+) still has rooms/))) return t("blockHasRooms", { block: m[1] });
    if (/room numbers are up to/.test(msg)) return t("number");
    if (/live demo is shared/.test(msg)) return t("demo");
    return msg;
  };
}

export function HostelSetup() {
  const t = useTranslations("settings.setup");
  const shared = useSession((s) => s.org?.is_demo ?? false);
  return (
    <div className="space-y-5">
      {shared && <p className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-small text-fg-2">{t("demoNote")}</p>}
      <Rents disabled={shared} />
      <Blocks disabled={shared} />
      <Rooms disabled={shared} />
      <Cutoffs disabled={shared} />
    </div>
  );
}

// ---------------------------------------------------------------------------
function Rents({ disabled }: { disabled: boolean }) {
  const t = useTranslations("settings.setup.rents");
  const tt = useTranslations("roomType");
  const org = useSession((s) => s.org)!;
  const errText = useSetupError();
  const [form, setForm] = useState<Record<RoomType, string>>(() =>
    Object.fromEntries(ROOM_TYPES.map((k) => [k, String(org.rent_by_type?.[k] ?? hostel.rentByType[k] ?? 0)])) as Record<RoomType, string>);
  const [busy, setBusy] = useState(false);
  const count = (k: RoomType) => rooms.filter((r) => r.type === k).length;
  const bad = ROOM_TYPES.find((k) => !/^\d{1,7}$/.test(form[k].trim()) || Number(form[k]) > 1000000);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (bad) return;
    setBusy(true);
    try {
      await setRents(org.id, Object.fromEntries(ROOM_TYPES.map((k) => [k, Number(form[k])])) as Record<RoomType, number>);
      toast(t("saved"));
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={t("title")} meta={t("body")} />
      <form onSubmit={save} className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        {ROOM_TYPES.map((k) => (
          <Field key={k} id={`rent-${k}`} label={t("label", { type: tt(k), n: count(k) })} value={form[k]} inputMode="numeric" disabled={disabled}
            onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value.replace(/[^\d]/g, "") }))}
            error={bad === k ? t("invalid") : undefined} />
        ))}
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" loading={busy} disabled={disabled || !!bad}>{t("save")}</Button>
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function Blocks({ disabled }: { disabled: boolean }) {
  const t = useTranslations("settings.setup.blocks");
  const tg = useTranslations("blockGender");
  const orgId = useSession((s) => s.org?.id)!;
  const beds = useDemo((s) => s.beds);
  const residents = useDemo((s) => s.residents);
  const errText = useSetupError();
  const [rows, setRows] = useState<BlockSetup[]>(() => hostel.blocks.map(({ id, name, gender, curfew }) => ({ id, name, gender, curfew })));
  const [busy, setBusy] = useState(false);
  const roomsIn = (id: string) => rooms.filter((r) => r.block === id).length;
  const bedsIn = (id: string) => beds.filter((b) => b.block === id).length;
  /** People living in a block who aren't of the gender it is set for. */
  const others = (row: BlockSetup) => residents.filter((r) => r.status !== "checked_out" && r.bedId.split("-")[0] === row.id && r.gender !== row.gender).length;
  const set = (id: string, patch: Partial<BlockSetup>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const badRow = rows.find((r) => !r.name.trim() || r.name.trim().length > 40 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.curfew));
  const nextId = nextBlockId(rows.map((r) => r.id));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (badRow) return;
    setBusy(true);
    try {
      await setBlocks(orgId, rows.map((r) => ({ ...r, name: r.name.trim() })));
      toast(t("saved"));
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={t("title")} meta={t("body")} />
      <form onSubmit={save} className="space-y-3 px-5 pb-5">
        {rows.map((row) => {
          const n = roomsIn(row.id);
          const mixed = others(row);
          return (
            <fieldset key={row.id} className="rounded-lg border border-line p-4" disabled={disabled}>
              <legend className="sr-only">{t("legend", { block: row.id })}</legend>
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium text-fg">
                  <span className="grid size-7 place-items-center rounded-md bg-surface-2 font-mono text-xs" aria-hidden>{row.id}</span>
                  {t("size", { rooms: n, beds: bedsIn(row.id) })}
                </p>
                {n === 0 && rows.length > 1 && (
                  <Button type="button" variant="quiet" size="sm" onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))} aria-label={t("remove", { block: row.id })}>
                    <Trash2 /> {t("removeShort")}
                  </Button>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_8rem] sm:items-end">
                <Field id={`blk-name-${row.id}`} label={t("name")} value={row.name} maxLength={40} onChange={(e) => set(row.id, { name: e.target.value })}
                  error={!row.name.trim() ? t("nameMissing") : undefined} />
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-fg" id={`blk-g-${row.id}`}>{t("for")}</p>
                  <div role="radiogroup" aria-labelledby={`blk-g-${row.id}`} className="grid grid-cols-2 rounded-[10px] bg-surface-2 p-0.5">
                    {(["M", "F"] as Gender[]).map((g) => (
                      <button key={g} type="button" role="radio" aria-checked={row.gender === g} onClick={() => set(row.id, { gender: g })}
                        className={cn("h-10 rounded-lg px-4 text-sm font-medium transition-colors md:h-8", row.gender === g ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2")}>
                        {tg(g)}
                      </button>
                    ))}
                  </div>
                </div>
                <Field id={`blk-cf-${row.id}`} type="time" label={t("curfew")} value={row.curfew} onChange={(e) => set(row.id, { curfew: e.target.value })} />
              </div>
              {mixed > 0 && <p className="mt-2 text-small text-warning-fg">{t("mixed", { n: mixed, gender: row.gender === "M" ? "F" : "M" })}</p>}
            </fieldset>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" loading={busy} disabled={disabled || !!badRow}>{t("save")}</Button>
          {nextId && (
            <Button type="button" variant="secondary" disabled={disabled} onClick={() => setRows((rs) => [...rs, { id: nextId, name: `Block ${nextId}`, gender: "M", curfew: "22:00" }])}>
              <Plus /> {t("add")}
            </Button>
          )}
        </div>
        <p className="text-small text-fg-3">{t("note")}</p>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function Rooms({ disabled }: { disabled: boolean }) {
  const t = useTranslations("settings.setup.rooms");
  const tt = useTranslations("roomType");
  const f = useFormat();
  const blockName = useBlockName();
  const orgId = useSession((s) => s.org?.id)!;
  const beds = useDemo((s) => s.beds);
  const residents = useDemo((s) => s.residents);
  const errText = useSetupError();
  const blockList = hostel.blocks.map((b) => b.id);
  const [blockPick, setBlock] = useState(blockList[0] ?? "A");
  const block = blockList.includes(blockPick) ? blockPick : (blockList[0] ?? "A");
  const floors = floorsOf(block);
  const [floorPick, setFloor] = useState(floors[0]);
  const floor = floors.includes(floorPick) ? floorPick : floors[0];
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ floor: string; number: string; type: RoomType }>({ floor: String(floor), number: "", type: "double" });

  const taken = useMemo(() => {
    const live = new Set(residents.filter((r) => r.status !== "checked_out").map((r) => r.bedId));
    const out: Record<string, number> = {};
    for (const b of beds) if (b.status === "occupied" || b.status === "reserved" || b.residentId || live.has(b.id)) out[b.roomId] = (out[b.roomId] ?? 0) + 1;
    return out;
  }, [beds, residents]);
  const list = rooms.filter((r) => r.block === block && r.floor === floor).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  const draftFloor = Number(draft.floor);
  // the next free number on the floor being added to: 105 after 104, or 301 on an empty third floor
  function suggestedNumber() {
    const on = rooms.filter((r) => r.block === block && r.floor === draftFloor).map((r) => Number(r.number)).filter(Number.isFinite);
    let n = on.length ? Math.max(...on) + 1 : draftFloor * 100 + 1;
    while (rooms.some((r) => r.id === `${block}-${n}`)) n++;
    return String(n);
  }
  const draftNumber = (draft.number.trim() || suggestedNumber()).toUpperCase();
  const draftBad = !/^[A-Z0-9]{1,6}$/.test(draftNumber) ? "number" : !(draftFloor >= 1 && draftFloor <= 20) ? "floor" : rooms.some((r) => r.id === `${block}-${draftNumber}`) ? "exists" : null;

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast(ok);
      return true;
    } catch (err) {
      toast.error(errText(err));
      return false;
    } finally {
      setBusy(null);
    }
  }
  const pickFloor = (fl: number) => { setFloor(fl); setDraft((d) => ({ ...d, floor: String(fl) })); };

  return (
    <Card>
      <CardHeader title={t("title")} meta={t("body")} />
      <div className="space-y-4 px-5 pb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-1.5 sm:w-56">
            <Label htmlFor="rm-block">{t("block")}</Label>
            <select id="rm-block" className={SELECT} value={block} onChange={(e) => { setBlock(e.target.value); pickFloor(floorsOf(e.target.value)[0]); }}>
              {blockList.map((b) => <option key={b} value={b}>{blockName(b)}</option>)}
            </select>
          </div>
          <div role="radiogroup" aria-label={t("floor")} className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-md bg-surface-2 p-0.5">
            {floors.map((fl) => (
              <button key={fl} type="button" role="radio" aria-checked={floor === fl} onClick={() => pickFloor(fl)}
                className={cn("h-9 min-w-10 shrink-0 rounded-sm px-2.5 text-sm font-medium transition-colors md:h-8", floor === fl ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2 hover:text-fg")}>
                {t("floorN", { n: fl })}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-small text-fg-3">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {list.map((r) => {
              const used = taken[r.id] ?? 0;
              return (
                <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2.5 sm:grid-cols-[4.5rem_11rem_1fr_auto]">
                  <span className="font-mono text-sm font-medium text-fg">{r.id}</span>
                  <select aria-label={t("typeOf", { room: r.id })} className={cn(SELECT, "col-span-2 row-start-2 sm:col-span-1 sm:row-start-1")} value={r.type} disabled={disabled || busy !== null}
                    onChange={(e) => { const type = e.target.value as RoomType; run(r.id, () => setRoomType(orgId, r.id, type), t("changed", { room: r.id, type: tt(type) })); }}>
                    {ROOM_TYPES.map((k) => <option key={k} value={k}>{tt(k)} · {t("bedsN", { n: CAPACITY[k] })}</option>)}
                  </select>
                  <span className="col-span-2 row-start-3 min-w-0 text-small text-fg-3 sm:col-span-1 sm:row-start-1">{t("usage", { taken: used, beds: r.capacity })} · {f.inr(r.rent)}</span>
                  <Button type="button" variant="quiet" size="icon" className="col-start-2 row-start-1 sm:col-start-4" aria-label={used ? t("removeTaken", { room: r.id }) : t("remove", { room: r.id })} title={used ? t("removeTaken", { room: r.id }) : undefined}
                    disabled={disabled || used > 0 || busy !== null} onClick={() => setConfirm(r.id)}>
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <form className="grid gap-3 rounded-lg bg-surface-2/60 p-4 sm:grid-cols-[6rem_8rem_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (draftBad) return;
            run("add", () => addRoom(orgId, { block, floor: draftFloor, number: draftNumber, type: draft.type }), t("added", { room: `${block}-${draftNumber}` }))
              .then((ok) => { if (ok) { setFloor(draftFloor); setDraft((d) => ({ ...d, number: "" })); } });
          }}>
          <Field id="rm-floor" label={t("floor")} inputMode="numeric" value={draft.floor} disabled={disabled}
            onChange={(e) => setDraft((d) => ({ ...d, floor: e.target.value.replace(/[^\d]/g, "").slice(0, 2) }))} />
          <Field id="rm-number" label={t("number")} placeholder={draftFloor >= 1 && draftFloor <= 20 ? suggestedNumber() : ""} value={draft.number} disabled={disabled} maxLength={6}
            onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
            error={draft.number && draftBad === "number" ? t("numberHint") : draft.number && draftBad === "exists" ? t("exists") : draftBad === "floor" && draft.floor ? t("floorHint") : undefined} />
          <div className="space-y-1.5">
            <Label htmlFor="rm-type">{t("type")}</Label>
            <select id="rm-type" className={SELECT} value={draft.type} disabled={disabled} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as RoomType }))}>
              {ROOM_TYPES.map((k) => <option key={k} value={k}>{tt(k)} · {t("bedsN", { n: CAPACITY[k] })}</option>)}
            </select>
          </div>
          <Button type="submit" variant="primary" loading={busy === "add"} disabled={disabled || !!draftBad || busy !== null}><Plus /> {t("add")}</Button>
        </form>
        <p className="text-small text-fg-3">{t("note")}</p>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle", { room: confirm ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmBody", { beds: rooms.find((r) => r.id === confirm)?.capacity ?? 0 })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { const id = confirm!; setConfirm(null); run(id, () => removeRoom(orgId, id), t("removed", { room: id })); }}>
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function Cutoffs({ disabled }: { disabled: boolean }) {
  const t = useTranslations("settings.setup.cutoffs");
  const tm = useTranslations("meals");
  const orgId = useSession((s) => s.org?.id)!;
  const errText = useSetupError();
  const [form, setForm] = useState<Record<Meal, { time: string; dayBefore: boolean }>>(() =>
    Object.fromEntries(MEALS.map((m) => { const p = cutoffParts(messMenu.cutoffs[m]); return [m, { time: p.time.padStart(5, "0"), dayBefore: p.dayBefore }]; })) as Record<Meal, { time: string; dayBefore: boolean }>);
  const [busy, setBusy] = useState(false);
  const bad = MEALS.find((m) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(form[m].time));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (bad) return;
    setBusy(true);
    try {
      await setCutoffs(orgId, Object.fromEntries(MEALS.map((m) => [m, `${form[m].time}${form[m].dayBefore ? " previous day" : ""}`])) as Record<Meal, string>);
      toast(t("saved"));
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={t("title")} meta={t("body")} />
      <form onSubmit={save} className="space-y-3 px-5 pb-5">
        {MEALS.map((m) => (
          <div key={m} className="grid grid-cols-[1fr_9rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[10rem_9rem_1fr]">
            <Label htmlFor={`cut-${m}`} className="text-sm text-fg">{tm(m)}</Label>
            <input id={`cut-${m}`} type="time" value={form[m].time} disabled={disabled} aria-invalid={bad === m || undefined}
              onChange={(e) => setForm((fm) => ({ ...fm, [m]: { ...fm[m], time: e.target.value } }))}
              className={cn(SELECT, "tnum")} />
            <label className="col-span-2 flex items-center gap-2 text-small text-fg-2 sm:col-span-1">
              <Checkbox checked={form[m].dayBefore} disabled={disabled} onCheckedChange={(v) => setForm((fm) => ({ ...fm, [m]: { ...fm[m], dayBefore: v === true } }))} />
              {t("dayBefore")}
            </label>
          </div>
        ))}
        <Button type="submit" variant="primary" loading={busy} disabled={disabled || !!bad}>{t("save")}</Button>
        <p className="text-small text-fg-3">{t("note")}</p>
      </form>
    </Card>
  );
}
