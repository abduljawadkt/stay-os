"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, FileText, Minus, Plus, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/lib/hooks";
import { hostel, type Resident } from "@/data";
import { brand } from "@/config/brand";
import { initials } from "@/lib/format";
import { roomById, curfewLabel } from "@/lib/selectors";
import { useIsSample } from "@/lib/session";

export type DocKind = "police" | "aadhaar" | "agreement" | "id";

/** A PDF-viewer look around an A4 page rendered in HTML. Download and print use the browser's print-to-PDF. */
export function DocumentViewer({ open, onOpenChange, resident, kind }: { open: boolean; onOpenChange: (o: boolean) => void; resident: Resident; kind: DocKind }) {
  const t = useTranslations("docs");
  const [zoom, setZoom] = useState(0.8);
  const file = `${t(`file.${kind}`)}_${resident.name.replace(/[^A-Za-z]+/g, "_")}.pdf`;
  const print = () => {
    document.title = file.replace(/\.pdf$/, "");
    window.print();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88vh,900px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[860px]" showCloseButton>
        <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 pr-12">
          <FileText className="size-4 text-fg-3" aria-hidden />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm font-medium tracking-normal">{file}</DialogTitle>
            <DialogDescription className="text-xs text-fg-3">{t("meta")}</DialogDescription>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <Button variant="quiet" size="icon-sm" aria-label={t("zoomOut")} onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}><Minus /></Button>
            <span className="w-11 text-center text-xs text-fg-2 tnum">{Math.round(zoom * 100)}%</span>
            <Button variant="quiet" size="icon-sm" aria-label={t("zoomIn")} onClick={() => setZoom((z) => Math.min(1.3, z + 0.1))}><Plus /></Button>
          </div>
          <Button variant="quiet" size="sm" onClick={print}><Printer /> <span className="hidden sm:inline">{t("print")}</span></Button>
          <Button variant="primary" size="sm" onClick={print}><Download /> {t("download")}</Button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-auto bg-surface-3 p-6">
          <div className="mx-auto origin-top" style={{ width: 794 * zoom }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: 794 }}>
              <div className="print-area bg-white text-[#1a1a1a] shadow-lg" style={{ width: 794, minHeight: 1123, padding: 56, fontFamily: "var(--font-geist), var(--font-ml), sans-serif" }}>
                {kind === "police" && <PoliceForm r={resident} />}
                {kind === "aadhaar" && <AadhaarSummary r={resident} />}
                {kind === "agreement" && <Agreement r={resident} />}
                {kind === "id" && <IdCard r={resident} />}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const fatherOf = (r: Resident) => (r.parent.relation === "Father" ? r.parent.name : `${r.parent.name} (${r.parent.relation.toLowerCase()})`);

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-[#d9d6cf] py-2">
      <p className="text-[10px] tracking-wide text-[#6b6a64] uppercase">{label}</p>
      <p className={mono ? "font-mono text-[13px]" : "text-[13px]"}>{value || "—"}</p>
    </div>
  );
}

/** How the identity was checked, in the words a police form needs. */
function identityLine(r: Resident, date: (d: string) => string) {
  if (r.kyc.status !== "verified") return "Pending";
  return `${r.kyc.method === "digilocker" ? "DigiLocker" : "Original Aadhaar card seen"}, ${date(r.kyc.verifiedOn ?? r.checkInDate)}`;
}

function PoliceForm({ r }: { r: Resident }) {
  const f = useFormat();
  // sample hostels have a made-up station; a real hostel's form leaves it to be written in
  const sample = useIsSample();
  const digilocker = r.kyc.status === "verified" && r.kyc.method === "digilocker";
  const room = roomById[r.bedId.split("-").slice(0, 2).join("-")];
  return (
    <div className="text-[13px] leading-relaxed">
      <div className="flex items-start justify-between border-b-2 border-[#1a1a1a] pb-3">
        <div>
          <p className="text-[11px] tracking-wide text-[#6b6a64] uppercase">Form · Tenant / paying guest verification</p>
          <h2 className="mt-1 text-[20px] font-semibold">Application for police verification of resident</h2>
          <p className="mt-1 text-[12px] text-[#4a4944]">To: The Station House Officer, {sample ? "Nadakkavu Police Station, Kozhikode City" : "______________________ Police Station"}</p>
        </div>
        <div className="grid h-[118px] w-[96px] place-items-center border border-[#bdbab2] bg-[#f4f3f0] text-center text-[11px] text-[#6b6a64]">
          <div>
            <p className="text-[26px] font-semibold text-[#3c3b37]">{initials(r.name)}</p>
            <p className="mt-1 px-1">{digilocker ? "Photo from DigiLocker" : "Paste photo"}</p>
          </div>
        </div>
      </div>
      <h3 className="mt-5 text-[12px] font-semibold tracking-wide uppercase">1. Owner / operator</h3>
      <div className="grid grid-cols-2 gap-x-8">
        <Field label="Name of establishment" value={hostel.name} />
        <Field label="Owner" value={hostel.owner.name} />
        <Field label="Address" value={hostel.address} />
        <Field label="Phone" value={hostel.owner.phone} />
      </div>
      <h3 className="mt-5 text-[12px] font-semibold tracking-wide uppercase">2. Resident</h3>
      <div className="grid grid-cols-2 gap-x-8">
        <Field label="Full name" value={r.name} />
        <Field label="Father's / guardian's name" value={fatherOf(r)} />
        <Field label="Date of birth" value={r.dob ? f.date(r.dob) : ""} />
        <Field label="Gender" value={r.gender === "F" ? "Female" : "Male"} />
        <Field label="Permanent address" value={sample ? `${r.hometown}, Kerala` : r.hometown} />
        <Field label="Mobile" value={r.phone} />
        <Field label="Aadhaar (masked)" value={r.kyc.aadhaarLast4 ? `XXXX XXXX ${r.kyc.aadhaarLast4}` : ""} mono />
        <Field label="Identity verified" value={identityLine(r, f.date)} />
        <Field label="Occupation" value={r.institution} />
        <Field label="Blood group" value={r.bloodGroup} />
      </div>
      <h3 className="mt-5 text-[12px] font-semibold tracking-wide uppercase">3. Stay details</h3>
      <div className="grid grid-cols-2 gap-x-8">
        <Field label="Room / bed" value={`${r.bedId} (${room.type === "six" ? "6-bed" : room.type} room)`} mono />
        <Field label="Date of occupancy" value={f.date(r.checkInDate)} />
        <Field label="Emergency contact" value={`${r.parent.name}, ${r.parent.phone}`} />
        <Field label="Purpose of stay" value={r.occupation === "student" ? "Studies" : "Employment"} />
      </div>
      <h3 className="mt-5 text-[12px] font-semibold tracking-wide uppercase">4. Declaration</h3>
      <p className="mt-2 text-[12px] text-[#3c3b37]">
        I confirm that the details above are true to the best of my knowledge
        {r.kyc.status !== "verified" ? "." : digilocker
          ? " and that the identity of the resident was verified with the original Aadhaar record through DigiLocker before occupancy."
          : " and that I have seen the resident's original Aadhaar card."}
      </p>
      <div className="mt-14 grid grid-cols-2 gap-16 text-[12px]">
        <div className="border-t border-[#1a1a1a] pt-1.5">Signature of owner / warden</div>
        <div className="border-t border-[#1a1a1a] pt-1.5">Signature of resident</div>
      </div>
      <p className="mt-16 border-t border-[#d9d6cf] pt-2 text-[10px] text-[#8a8880]">Prepared with {brand.name} on {f.date(Date.now())} for submission at the police station. Reference {r.id}.</p>
    </div>
  );
}

function AadhaarSummary({ r }: { r: Resident }) {
  const f = useFormat();
  return (
    <div>
      <p className="text-[11px] tracking-wide text-[#6b6a64] uppercase">DigiLocker · issued document summary</p>
      <h2 className="mt-1 text-[20px] font-semibold">Aadhaar verification record</h2>
      <div className="mt-6 flex gap-6 rounded-md border border-[#d9d6cf] p-5">
        <div className="grid h-[118px] w-[96px] place-items-center bg-[#f4f3f0] text-[26px] font-semibold text-[#3c3b37]">{initials(r.name)}</div>
        <div className="grid flex-1 grid-cols-2 gap-x-8">
          <Field label="Name" value={r.name} />
          <Field label="Date of birth" value={r.dob ? f.date(r.dob) : ""} />
          <Field label="Gender" value={r.gender === "F" ? "Female" : "Male"} />
          <Field label="Aadhaar" value={`XXXX XXXX ${r.kyc.aadhaarLast4}`} mono />
          <Field label="Address" value={`${r.hometown}, Kerala`} />
          <Field label="Verified on" value={f.date(r.kyc.verifiedOn ?? r.checkInDate)} />
        </div>
      </div>
      <p className="mt-6 text-[12px] text-[#3c3b37]">Fetched with the resident&apos;s consent through DigiLocker. Only the last four digits of the Aadhaar number are stored, as required by UIDAI guidelines.</p>
    </div>
  );
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

function Agreement({ r }: { r: Resident }) {
  const f = useFormat();
  // sample hostels show an e-signed copy and the demo's mess rebate; a real one prints a copy to sign
  const sample = useIsSample();
  const room = roomById[r.bedId.split("-").slice(0, 2).join("-")];
  return (
    <div className="text-[13px] leading-relaxed">
      <h2 className="text-center text-[18px] font-semibold">Residence agreement</h2>
      <p className="mt-6">This agreement is made on {f.date(r.checkInDate)} between <b>{hostel.name}</b>, {hostel.address} (&ldquo;the hostel&rdquo;), and <b>{r.name}</b> (&ldquo;the resident&rdquo;).</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5">
        <li>The resident is allotted bed {r.bedId} in a {room.type === "six" ? "6-bed" : room.type} room at {f.inr(room.rent)} per month{r.messPlan ? `, with mess at ${f.inr(hostel.messFee)} per month` : ""}.</li>
        <li>Rent is due by the {ordinal(hostel.dueDay)} of every month. Invoices and UPI payment links are sent in the StayOS app.</li>
        <li>A refundable deposit of {f.inr(hostel.deposit)} is held and returned within 15 days of check-out, less any dues.</li>
        <li>Mess meals can be skipped in the app before the cut-off time.{sample ? " A rebate of ₹70 a day applies when away three or more days in a row." : ""}</li>
        <li>The gate closes at {curfewLabel(r.bedId.split("-")[0])}. Late entry needs a gate pass approved by the parent or guardian.</li>
        <li>Either side may end this agreement with 30 days&apos; notice.</li>
      </ol>
      <div className="mt-16 grid grid-cols-2 gap-16 text-[12px]">
        <div className="border-t border-[#1a1a1a] pt-1.5">For {hostel.name}</div>
        <div className="border-t border-[#1a1a1a] pt-1.5">{r.name}{sample ? ` · e-signed ${f.date(r.checkInDate)}` : ""}</div>
      </div>
    </div>
  );
}

function IdCard({ r }: { r: Resident }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-[#6b6a64] uppercase">Uploaded by resident · photo of ID card</p>
      <div className="mt-6 w-[420px] overflow-hidden rounded-xl border border-[#d9d6cf]">
        <div className="bg-[#2f3b4c] px-5 py-3 text-[13px] font-semibold text-white">{r.institution.split(" · ")[1] ?? r.institution}</div>
        <div className="flex gap-4 p-5">
          <div className="grid h-[110px] w-[88px] place-items-center bg-[#f4f3f0] text-[24px] font-semibold text-[#3c3b37]">{initials(r.name)}</div>
          <div className="text-[13px]">
            <p className="text-[16px] font-semibold">{r.name}</p>
            <p className="mt-1 text-[#4a4944]">{r.institution.split(" · ")[0]}</p>
            <p className="mt-3 font-mono text-[12px]">ID {r.id.replace("R-", "24")}{r.kyc.aadhaarLast4}</p>
            <p className="text-[12px] text-[#4a4944]">Blood group {r.bloodGroup}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
