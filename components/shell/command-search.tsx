"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BedDouble, Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar } from "@/components/common/avatar";
import { useDemo } from "@/lib/store";
import { rooms } from "@/data";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOwnerView } from "@/components/common/owner-only";

export function CommandSearch({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations("shell");
  const tn = useTranslations("nav");
  const tr = useTranslations("roomType");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const residents = useDemo((s) => s.residents);
  const ownerView = useOwnerView();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 1) return residents.filter((r) => r.status !== "checked_out").slice(0, 5);
    return residents.filter((r) => r.status !== "checked_out" && (r.name.toLowerCase().includes(s) || r.bedId.toLowerCase().includes(s) || r.phone.replace(/\s/g, "").includes(s.replace(/\s/g, "")))).slice(0, 8);
  }, [q, residents]);
  const roomMatches = useMemo(() => {
    const s = q.trim().toUpperCase();
    if (!/^[ABC]-?\d/.test(s)) return [];
    const norm = s.includes("-") ? s : `${s[0]}-${s.slice(1)}`;
    return rooms.filter((r) => r.id.startsWith(norm)).slice(0, 6);
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <>
      {compact ? (
        <Button variant="quiet" size="icon" onClick={() => setOpen(true)} aria-label={t("search")} className={className}><Search /></Button>
      ) : (
      <button
        onClick={() => setOpen(true)}
        className={cn("flex h-8 w-full max-w-72 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-small text-fg-3 transition-colors hover:border-line-strong", className)}
        aria-label={t("search")}
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 truncate text-left">{t("searchPlaceholder")}</span>
        <kbd className="hidden rounded-xs border border-line bg-surface-2 px-1.5 font-mono text-[11px] text-fg-3 sm:inline">⌘K</kbd>
      </button>
      )}
      <CommandDialog open={open} onOpenChange={setOpen} title={t("search")} description={t("searchPlaceholder")}>
        <CommandInput placeholder={t("searchPlaceholder")} value={q} onValueChange={setQ} />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>{t("noResults")}</CommandEmpty>
          {matches.length > 0 && (
            <CommandGroup heading={t("residents")}>
              {matches.map((r) => (
                <CommandItem key={r.id} value={`${r.name} ${r.bedId} ${r.phone}`} onSelect={() => go(`/dashboard/residents/profile/?id=${r.id}`)}>
                  <Avatar name={r.name} size={22} />
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="font-mono text-xs text-fg-3">{r.bedId}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {roomMatches.length > 0 && (
            <CommandGroup heading={t("rooms")}>
              {roomMatches.map((r) => (
                <CommandItem key={r.id} value={`room ${r.id}`} onSelect={() => go(`/dashboard/rooms/?block=${r.block}&floor=${r.floor}&room=${r.id}`)}>
                  <BedDouble />
                  <span className="flex-1 font-mono">{r.id}</span>
                  <span className="text-xs text-fg-3">{tr(r.type)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading={t("pages")}>
            {NAV.flatMap((g) => g.items)
              .filter((i) => ownerView || !i.ownerOnly)
              .map((i) => (
                <CommandItem key={i.key} value={`page ${tn(i.key)}`} onSelect={() => go(i.href)}>
                  <i.icon />
                  {tn(i.key)}
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
