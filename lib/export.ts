// Real file downloads for the demo's "Export" buttons. CSV opens directly in Excel.
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  // iPhone and iPad: a file download from the home-screen app opens a viewer with no way back, so hand the
  // file to the share sheet instead (Save to Files, WhatsApp, Mail…)
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (ios && typeof File !== "undefined") {
    const file = new File([csv], filename, { type: "text/csv" });
    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: filename }).catch(() => undefined);
      return;
    }
  }
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
