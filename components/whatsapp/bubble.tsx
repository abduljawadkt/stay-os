"use client";

import { CheckCheck, ExternalLink, Reply, FileText } from "lucide-react";
import type { WAMessage } from "@/data";
import { renderTemplate } from "@/lib/wa-templates";
import { fmtTime } from "@/lib/format";
import { ComplaintPhoto } from "@/components/common/complaint-photo";
import { cn } from "@/lib/utils";

/** One WhatsApp message, styled like the real app (scoped palette from .wa-scope). */
export function Bubble({ m, lang, onButton, showTail = true }: { m: WAMessage; lang: "en" | "ml"; onButton?: (action: string | undefined, label: string) => void; showTail?: boolean }) {
  const out = m.from === "hostel";
  const r = m.kind === "template" && m.template ? renderTemplate(m.template, m.data ?? {}, lang) : null;
  const text = r ? r.body : m.text ?? "";
  const time = fmtTime(m.at, "en").toLowerCase();
  return (
    <div className={cn("flex w-full", out ? "justify-end" : "justify-start")}>
      <div className="max-w-[85%]">
        <div
          className={cn(
            "relative rounded-lg px-2 pt-1.5 pb-1 text-[14.2px] leading-[19px] text-[var(--wa-text)] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]",
            out ? "bg-[var(--wa-out)]" : "bg-[var(--wa-in)]",
            showTail && (out ? "rounded-tr-none" : "rounded-tl-none")
          )}
        >
          {showTail && (
            <svg viewBox="0 0 8 13" width="8" height="13" aria-hidden className={cn("absolute top-0", out ? "-right-2" : "-left-2 -scale-x-100")}>
              <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" fill={out ? "var(--wa-out)" : "var(--wa-in)"} />
            </svg>
          )}
          {m.kind === "image" && m.image && (
            <div className="mb-1 overflow-hidden rounded-md">
              {m.image.startsWith("data:") ? <img src={m.image} alt="" className="max-h-56 w-full object-cover" /> : <ComplaintPhoto kind={m.image} className="h-44 w-64" />}
            </div>
          )}
          {r?.header && <p className="mb-1 text-[14.5px] font-semibold">{r.header}</p>}
          <p className="whitespace-pre-line break-words">
            {renderLinks(text)}
            <span className="invisible inline-block w-16" aria-hidden />
          </p>
          {r?.footer && <p className="mt-1 text-[12.5px] text-[var(--wa-meta)]">{r.footer}</p>}
          <span className="absolute right-2 bottom-1 flex items-center gap-0.5 text-[11px] text-[var(--wa-meta)]">
            {time}
            {out && <CheckCheck className={cn("size-4", m.status === "read" ? "text-[var(--wa-tick)]" : "text-[var(--wa-meta)]")} aria-label={m.status === "read" ? "Read" : "Delivered"} />}
          </span>
        </div>
        {r?.buttons && (
          <div className="mt-0.5 grid gap-0.5">
            {r.buttons.map((b) => {
              const used = m.answered !== undefined;
              return (
                <button
                  key={b.label}
                  type="button"
                  disabled={b.kind === "reply" && used}
                  onClick={() => onButton?.(b.action, b.label)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--wa-in)] text-[14px] font-medium text-[var(--wa-link)] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)] transition-opacity",
                    out && "bg-[var(--wa-out)]",
                    b.kind === "reply" && used && (m.answered === b.action ? "opacity-100" : "opacity-50"),
                    "hover:brightness-[0.98] disabled:cursor-default"
                  )}
                >
                  {b.kind === "url" ? (b.action === "receipt" || b.action === "invoice" ? <FileText className="size-4" aria-hidden /> : <ExternalLink className="size-4" aria-hidden />) : <Reply className="size-4" aria-hidden />}
                  {b.label}
                  {b.kind === "reply" && used && m.answered === b.action && " ✓"}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function renderLinks(text: string) {
  const parts = text.split(/(pay\.\S+|https?:\/\/\S+)/g);
  return parts.map((p, i) => (/^(pay\.|https?:)/.test(p) ? <span key={i} className="text-[var(--wa-link)] underline-offset-2 hover:underline">{p}</span> : p));
}
