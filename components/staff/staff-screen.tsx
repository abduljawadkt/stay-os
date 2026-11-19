"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Banknote, Check, ChevronDown, Phone } from "lucide-react";
import { Card, PageHeader } from "@/components/common/card";
import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Avatar } from "@/components/common/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDemo } from "@/lib/store";
import { useFormat, useScreenState } from "@/lib/hooks";
import { staffMonth } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";
import { demo } from "@/config/demo";
import { staff as staffList, type AttendanceMark } from "@/data";
import { cn } from "@/lib/utils";

const MARK_STYLE: Record<AttendanceMark, string> = {
  P: "bg-brand", late: "bg-warning", H: "bg-brand/50", L: "bg-line-input", A: "bg-danger",
};
const MARK_VARIANT: Record<AttendanceMark, "success" | "warning" | "neutral" | "danger" | "brand"> = { P: "success", late: "warning", H: "brand", L: "neutral", A: "danger" };

export function StaffScreen() {
  const t = useTranslations("staff");
  const tr = useTranslations("staff.role");
  const tk = useTranslations("staff.mark");
  const f = useFormat();
  const { loading, error, retry } = useScreenState("staff");
  const role = useDemo((s) => s.role);
  const att = useDemo((s) => s.staffAttendance);
  const setAttendance = useDemo((s) => s.setAttendance);
  const [payOpen, setPayOpen] = useState(false);
  const today = todayISO();
  const owner = role !== "warden";
  const rows = useMemo(() => staffList.map((s) => ({ s, a: att[s.id] ?? {}, m: staffMonth(s, att[s.id] ?? {}, today) })), [att, today]);
  const todayCounts = rows.reduce((acc, r) => { const k = r.a[today] ?? "P"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const present = (todayCounts.P ?? 0) + (todayCounts.late ?? 0) + (todayCounts.H ?? 0);
  const totals = rows.reduce((a, r) => ({ gross: a.gross + r.s.salary, ded: a.ded + r.m.deduction, adv: a.adv + r.m.advance, net: a.net + r.m.net }), { gross: 0, ded: 0, adv: 0, net: 0 });
  const days = Array.from({ length: Number(today.slice(8)) }, (_, i) => `${today.slice(0, 8)}${String(i + 1).padStart(2, "0")}`);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { present, total: staffList.length, late: todayCounts.late ?? 0, leave: (todayCounts.L ?? 0) + (todayCounts.A ?? 0) })}
        actions={owner ? <Button variant="primary" onClick={() => setPayOpen(true)}><Banknote /> {t("process", { month: f.monthShort(demo.currentMonth) })}</Button> : undefined}
      />
      {owner && (
        <div className="mb-4 grid gap-4 sm:grid-cols-4">
          {[["gross", totals.gross], ["ded", totals.ded], ["adv", totals.adv], ["net", totals.net]].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-line bg-surface p-4">
              <p className="text-small font-medium text-fg-2">{t(`sum.${k}`)}</p>
              <p className={cn("mt-1 text-title font-semibold tnum", k === "net" ? "text-fg" : k === "gross" ? "text-fg" : "text-fg-2")}>{k === "ded" || k === "adv" ? `−${f.inr(v as number)}` : f.inr(v as number)}</p>
            </div>
          ))}
        </div>
      )}
      <Card>
        {error ? <ErrorState what={t("what")} onRetry={retry} /> : loading ? <TableSkeleton rows={10} cols={6} /> : (
          <div className="scrollbar-thin relative overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-fg-2">
                <th className="py-2.5 pr-3 pl-5 font-medium">{t("col.name")}</th><th className="px-3 font-medium">{t("col.shift")}</th><th className="px-3 font-medium">{t("col.today")}</th>
                <th className="px-3 font-medium">{t("col.month", { month: f.monthShort(demo.currentMonth) })}</th><th className="px-3 text-right font-medium">{t("col.present")}</th>
                {owner && <><th className="px-3 text-right font-medium">{t("col.salary")}</th><th className="px-3 text-right font-medium">{t("col.deductions")}</th><th className="py-2.5 pr-5 pl-3 text-right font-medium">{t("col.net")}</th></>}
              </tr></thead>
              <tbody>
                {rows.map(({ s, a, m }) => {
                  const mark = (a[today] ?? "P") as AttendanceMark;
                  return (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3 pl-5"><div className="flex items-center gap-3"><Avatar name={s.name} size={28} /><div><p className="font-medium text-fg">{s.name}</p><p className="text-xs text-fg-3">{s.title}</p></div></div></td>
                      <td className="px-3 text-fg-2 tnum">{s.shift}</td>
                      <td className="px-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><button className="inline-flex items-center gap-1 rounded-full" aria-label={t("markFor", { name: s.name })}><Badge variant={MARK_VARIANT[mark]} dot>{tk(mark)}</Badge><ChevronDown className="size-3 text-fg-3" aria-hidden /></button></DropdownMenuTrigger>
                          <DropdownMenuContent>{(["P", "late", "H", "L", "A"] as AttendanceMark[]).map((k) => <DropdownMenuItem key={k} onSelect={() => setAttendance(s.id, today, k)}>{k === mark && <Check />}{tk(k)}</DropdownMenuItem>)}</DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="px-3">
                        <div className="flex gap-[3px]" role="img" aria-label={t("stripAria", { present: m.present, absent: m.absent, leave: m.leave })}>
                          {days.map((d) => {
                            const k = (a[d] ?? "P") as AttendanceMark;
                            return (
                              <Tooltip key={d}><TooltipTrigger asChild><span className={cn("h-4 w-[5px] rounded-[2px]", MARK_STYLE[k])} /></TooltipTrigger><TooltipContent>{f.weekday(d)} · {tk(k)}</TooltipContent></Tooltip>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 text-right text-fg tnum">{m.present}/{days.length}</td>
                      {owner && <>
                        <td className="px-3 text-right text-fg tnum">{f.inr(s.salary)}</td>
                        <td className="px-3 text-right text-fg-2 tnum">{m.deduction + m.advance > 0 ? `−${f.inr(m.deduction + m.advance)}` : "—"}</td>
                        <td className="py-2.5 pr-5 pl-3 text-right font-medium text-fg tnum">{f.inr(m.net)}</td>
                      </>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-fg-2">
        {(["P", "late", "H", "L", "A"] as AttendanceMark[]).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className={cn("h-3 w-[5px] rounded-[2px]", MARK_STYLE[k])} aria-hidden />{tk(k)}</span>)}
        <span className="text-fg-3">{t("policy")}</span>
      </div>
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("payDialog.title", { month: f.month(demo.currentMonth) })}</DialogTitle><DialogDescription>{t("payDialog.body", { count: staffList.length, amount: f.inr(totals.net) })}</DialogDescription></DialogHeader>
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
            {rows.map(({ s, m }) => <li key={s.id} className="flex items-center justify-between px-4 py-2"><span className="text-fg">{s.name}</span><span className="text-fg tnum">{f.inr(m.net)}</span></li>)}
          </ul>
          <DialogFooter>
            <Button variant="quiet" onClick={() => setPayOpen(false)}>{t("payDialog.cancel")}</Button>
            <Button variant="primary" onClick={() => { setPayOpen(false); toast(t("payDialog.done", { amount: f.inr(totals.net) }), { description: t("payDialog.doneSub") }); }}>{t("payDialog.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <span className="sr-only"><Phone /></span>
    </>
  );
}
