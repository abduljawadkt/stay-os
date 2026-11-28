"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Plus, Search, SearchX, Download } from "lucide-react";
import { Card, PageHeader } from "@/components/common/card";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Avatar } from "@/components/common/avatar";
import { InvoiceChip, KycChip, PoliceChip } from "@/components/common/chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDemo } from "@/lib/store";
import { useUI } from "@/components/shell/ui-store";
import { useBlockName, useFormat, useScreenState } from "@/lib/hooks";
import { invoiceState, blockIds } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";
import { downloadCsv } from "@/lib/export";
import type { Invoice } from "@/data";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "overdue", "kyc", "police", "notice", "checked_out"] as const;
type Filter = (typeof FILTERS)[number];
const PAGE = 25;

export function ResidentsScreen() {
  const t = useTranslations("residents");
  const f = useFormat();
  const router = useRouter();
  const params = useSearchParams();
  const { loading, error, retry } = useScreenState("residents");
  const residents = useDemo((s) => s.residents);
  const invoices = useDemo((s) => s.invoices);
  const openCheckIn = useUI((s) => s.openCheckIn);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) || "all");
  const [block, setBlock] = useState("all");
  const blockName = useBlockName();
  const [page, setPage] = useState(0);
  const today = todayISO();

  useEffect(() => {
    if (params.get("checkin")) openCheckIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => setPage(0), [q, filter, block]);

  const latest = useMemo(() => {
    const m = new Map<string, Invoice>();
    for (const i of invoices) {
      const cur = m.get(i.residentId);
      if (!cur || i.month > cur.month || (i.month === cur.month && i.status === "unpaid")) m.set(i.residentId, i);
    }
    return m;
  }, [invoices]);
  const overdueIds = useMemo(() => new Set(invoices.filter((i) => i.status === "unpaid" && invoiceState(i, today).state === "overdue").map((i) => i.residentId)), [invoices, today]);

  const counts = useMemo(() => {
    const cur = residents.filter((r) => r.status !== "checked_out");
    return {
      all: cur.length, overdue: cur.filter((r) => overdueIds.has(r.id)).length, kyc: cur.filter((r) => r.kyc.status === "pending").length,
      police: cur.filter((r) => r.police.status === "pending").length, notice: cur.filter((r) => r.status === "notice").length,
      checked_out: residents.filter((r) => r.status === "checked_out").length,
    } as Record<Filter, number>;
  }, [residents, overdueIds]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return residents
      .filter((r) => (filter === "checked_out" ? r.status === "checked_out" : r.status !== "checked_out"))
      .filter((r) => filter !== "overdue" || overdueIds.has(r.id))
      .filter((r) => filter !== "kyc" || r.kyc.status === "pending")
      .filter((r) => filter !== "police" || r.police.status === "pending")
      .filter((r) => filter !== "notice" || r.status === "notice")
      .filter((r) => block === "all" || r.bedId.split("-")[0] === block)
      .filter((r) => !s || r.name.toLowerCase().includes(s) || r.bedId.toLowerCase().includes(s) || r.phone.replace(/\s/g, "").includes(s.replace(/\s/g, "")) || r.institution.toLowerCase().includes(s))
      .sort((a, b) => (filter === "checked_out" ? (b.checkOutDate ?? "").localeCompare(a.checkOutDate ?? "") : a.bedId.localeCompare(b.bedId, undefined, { numeric: true })));
  }, [residents, q, filter, block, overdueIds]);
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);

  const exportCsv = () =>
    downloadCsv(`residents_${today}.csv`, [
      ["ID", "Name", "Bed", "Phone", "Institution / company", "Parent", "Parent phone", "Checked in", "KYC", "Police verification"],
      ...rows.map((r) => [r.id, r.name, r.bedId, r.phone, r.institution, r.parent.name, r.parent.phone, r.checkInDate, r.kyc.status, r.police.status]),
    ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={loading ? " " : t("subtitle", { count: counts.all })}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}><Download /> {t("export")}</Button>
            <Button variant="primary" onClick={() => openCheckIn()}><Plus /> {t("checkIn")}</Button>
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("search")} className="pl-8" />
          </div>
          <div role="tablist" aria-label={t("filters")} className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1">
            {FILTERS.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-small font-medium transition-colors", filter === k ? "bg-surface-2 text-fg" : "text-fg-2 hover:bg-surface-2/60 hover:text-fg")}
              >
                {t(`filter.${k}`)} <span className="text-xs text-fg-3 tnum">{loading ? "" : counts[k]}</span>
              </button>
            ))}
          </div>
          <Select value={block} onValueChange={setBlock}>
            <SelectTrigger className="w-36 shrink-0 lg:ml-auto" aria-label={t("block")}><SelectValue>{block === "all" ? t("allBlocks") : blockName(block)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allBlocks")}</SelectItem>
              {blockIds().map((b) => <SelectItem key={b} value={b}>{blockName(b)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {error ? <ErrorState what={t("what")} onRetry={retry} /> : loading ? <TableSkeleton rows={10} cols={6} /> : rows.length === 0 ? (
          <EmptyState icon={SearchX} title={q ? t("emptyTitle", { q }) : t("emptyFilter")} body={t("emptyBody")} action={<Button variant="secondary" onClick={() => { setQ(""); setFilter("all"); setBlock("all"); }}>{t("clear")}</Button>} />
        ) : (
          <>
            <ul className="divide-y divide-line border-t border-line md:hidden">
              {pageRows.map((r) => {
                const inv = latest.get(r.id);
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => router.push(`/dashboard/residents/profile/?id=${r.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                      <Avatar name={r.name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-fg">{r.name}</span>
                        <span className="block truncate text-[13px] text-fg-3"><span className="font-mono">{r.bedId}</span> · {r.institution.split(" · ")[1] ?? r.institution}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {inv ? <InvoiceChip inv={inv} today={today} /> : null}
                        {filter === "police" ? <PoliceChip status={r.police.status} /> : r.kyc.status !== "verified" ? <KycChip status={r.kyc.status} /> : null}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="scrollbar-thin relative hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-line text-left text-xs font-medium text-fg-2">
                    <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">{t("col.name")}</th>
                    <th scope="col" className="px-3 font-medium">{t("col.bed")}</th>
                    <th scope="col" className="px-3 font-medium">{t("col.phone")}</th>
                    <th scope="col" className="px-3 font-medium">{filter === "checked_out" ? t("col.checkedOut") : t("col.checkIn")}</th>
                    <th scope="col" className="px-3 font-medium">{t("col.rent")}</th>
                    <th scope="col" className="py-2.5 pr-5 pl-3 font-medium">{filter === "police" ? t("col.police") : t("col.kyc")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const inv = latest.get(r.id);
                    const href = `/dashboard/residents/profile/?id=${r.id}`;
                    return (
                      <tr key={r.id} onClick={() => router.push(href)} className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2">
                        <td className="py-2 pr-3 pl-5">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.name} size={28} />
                            <div className="min-w-0">
                              <a href={href} onClick={(e) => { e.preventDefault(); router.push(href); }} className="block truncate font-medium text-fg hover:underline">{r.name}</a>
                              <p className="max-w-[300px] truncate text-xs text-fg-3">{r.institution}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 font-mono text-small text-fg-2">{r.bedId}</td>
                        <td className="px-3 text-fg-2 tnum">{r.phone}</td>
                        <td className="px-3 text-fg-2 tnum">{f.date(filter === "checked_out" ? r.checkOutDate ?? r.checkInDate : r.checkInDate)}</td>
                        <td className="px-3">{inv ? <InvoiceChip inv={inv} today={today} /> : <span className="text-fg-3">—</span>}</td>
                        <td className="py-2 pr-5 pl-3">{filter === "police" ? <PoliceChip status={r.police.status} /> : <KycChip status={r.kyc.status} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-small text-fg-2">
              <span className="tnum">{t("range", { from: page * PAGE + 1, to: Math.min(rows.length, (page + 1) * PAGE), total: rows.length })}</span>
              <div className="flex gap-1">
                <Button variant="quiet" size="icon-sm" aria-label={t("prev")} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
                <Button variant="quiet" size="icon-sm" aria-label={t("next")} disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
