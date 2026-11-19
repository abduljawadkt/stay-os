"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, FileText, Fingerprint, Loader2, MapPin, ShieldCheck, BedDouble } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUI } from "@/components/shell/ui-store";
import { useDemo } from "@/lib/store";
import { useFormat } from "@/lib/hooks";
import { roomById, daysInMonth } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";
import { demo } from "@/config/demo";
import { hostel } from "@/data";
import { cn } from "@/lib/utils";

type Step = 0 | 1 | 2 | 3 | 4;
const KYC_STEPS = ["connect", "otp", "consent", "fetch"] as const;

export function CheckInDialog() {
  const t = useTranslations("checkin");
  const tr = useTranslations("roomType");
  const f = useFormat();
  const router = useRouter();
  const { open, bedId } = useUI((s) => s.checkIn);
  const close = useUI((s) => s.closeCheckIn);
  const beds = useDemo((s) => s.beds);
  const residents = useDemo((s) => s.residents);
  const checkIn = useDemo((s) => s.checkIn);
  const tourActive = useDemo((s) => s.tourActive);

  const preset = demo.checkIn;
  const [step, setStep] = useState<Step>(0);
  type Form = { name: string; phone: string; institution: string; occupation: "student" | "professional"; parentName: string; parentPhone: string; gender: "M" | "F" };
  const [form, setForm] = useState<Form>({ name: preset.name, phone: preset.phone, institution: preset.institution, occupation: preset.occupation as "student" | "professional", parentName: preset.parent.name, parentPhone: preset.parent.phone, gender: preset.gender as "M" | "F" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kyc, setKyc] = useState<number>(-1); // -1 idle, 0..3 running, 4 done
  const [bed, setBed] = useState<string>("");
  const [mess, setMess] = useState(true);
  const [welcome, setWelcome] = useState(true);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep(0); setKyc(-1); setErrors({}); setCreatedId(null);
    const preBed = bedId ? beds.find((b) => b.id === bedId) : null;
    setForm({ name: preBed?.reservation?.name ?? preset.name, phone: preBed?.reservation?.phone ?? preset.phone, institution: preset.institution, occupation: preset.occupation, parentName: preset.parent.name, parentPhone: preset.parent.phone, gender: preBed ? (preBed.block === "C" ? "F" : "M") : preset.gender });
    setBed(bedId ?? "");
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bedId]);

  const options = useMemo(() => {
    const list = beds.filter((b) => (b.status === "vacant" || b.id === bedId) && (b.block === "C") === (form.gender === "F"));
    const score = (id: string) => (id === bedId ? -2 : id === preset.suggestedBed ? -1 : 0);
    return list.sort((a, b) => score(a.id) - score(b.id) || a.id.localeCompare(b.id)).slice(0, 6);
  }, [beds, form.gender, bedId, preset.suggestedBed]);
  useEffect(() => {
    if (step === 2 && !bed && options[0]) setBed(options[0].id);
  }, [step, bed, options]);

  const runKyc = () => {
    setKyc(0);
    KYC_STEPS.forEach((_, i) => timers.current.push(setTimeout(() => setKyc(i + 1), 750 * (i + 1))));
  };
  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 3) e.name = t("errors.name");
    if (!/^\+91 ?\d{5} ?\d{5}$/.test(form.phone.trim())) e.phone = t("errors.phone");
    if (!/^\+91 ?\d{5} ?\d{5}$/.test(form.parentPhone.trim())) e.parentPhone = t("errors.phone");
    if (!form.institution.trim()) e.institution = t("errors.required");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const room = bed ? roomById[bed.split("-").slice(0, 2).join("-")] : null;
  const today = todayISO();
  const dim = daysInMonth(today.slice(0, 7));
  const days = dim - Number(today.slice(8)) + 1;
  const proRent = room ? Math.round((room.rent * days) / dim / 10) * 10 : 0;
  const proMess = mess ? Math.round((hostel.messFee * days) / dim / 10) * 10 : 0;

  const complete = () => {
    if (!bed) return;
    const id = checkIn({
      name: form.name.trim(), gender: form.gender, phone: form.phone.trim(), dob: preset.dob, bloodGroup: preset.bloodGroup, hometown: preset.hometown, occupation: form.occupation,
      institution: form.institution.trim(), parent: { name: form.parentName.trim(), relation: "Father", phone: form.parentPhone.trim() }, aadhaarLast4: preset.aadhaarLast4,
      bedId: bed, messPlan: mess, sendWelcome: welcome,
    });
    setCreatedId(id);
    setStep(4);
  };

  const steps = [t("steps.details"), t("steps.kyc"), t("steps.bed"), t("steps.confirm")];
  const created = createdId ? residents.find((r) => r.id === createdId) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[620px]" data-tour="checkin-dialog" onInteractOutside={(e) => tourActive && e.preventDefault()}>
        <div className="border-b border-line px-6 pt-5 pb-4">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="mt-1 text-small text-fg-2">{t("subtitle")}</DialogDescription>
          {step < 4 && (
            <ol className="mt-4 flex items-center gap-2" aria-label={t("progress")}>
              {steps.map((s, i) => (
                <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold tnum transition-colors", i < step ? "bg-brand text-white" : i === step ? "bg-brand-tint text-brand-tint-fg ring-1 ring-brand" : "bg-surface-2 text-fg-3")}>
                    {i < step ? <Check className="size-3" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn("truncate text-xs font-medium", i <= step ? "text-fg" : "text-fg-3")}>{s}</span>
                  {i < steps.length - 1 && <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden />}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="max-h-[min(62vh,560px)] overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Badge variant="brand" className="sm:col-span-2">{t("prefilled")}</Badge>
                  <Field id="ci-name" label={t("fields.name")} error={errors.name} className="sm:col-span-2">
                    <Input id="ci-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} autoComplete="off" />
                  </Field>
                  <Field id="ci-phone" label={t("fields.phone")} error={errors.phone}>
                    <Input id="ci-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={!!errors.phone} inputMode="tel" className="tnum" />
                  </Field>
                  <Field id="ci-occ" label={t("fields.occupation")}>
                    <Select value={form.occupation} onValueChange={(v) => setForm({ ...form, occupation: v as "student" | "professional" })}>
                      <SelectTrigger id="ci-occ" className="w-full"><SelectValue>{form.occupation === "student" ? t("fields.student") : t("fields.professional")}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">{t("fields.student")}</SelectItem>
                        <SelectItem value="professional">{t("fields.professional")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field id="ci-inst" label={form.occupation === "student" ? t("fields.college") : t("fields.company")} error={errors.institution} className="sm:col-span-2">
                    <Input id="ci-inst" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} aria-invalid={!!errors.institution} />
                  </Field>
                  <Field id="ci-pname" label={t("fields.parentName")}>
                    <Input id="ci-pname" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
                  </Field>
                  <Field id="ci-pphone" label={t("fields.parentPhone")} error={errors.parentPhone}>
                    <Input id="ci-pphone" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} aria-invalid={!!errors.parentPhone} inputMode="tel" className="tnum" />
                  </Field>
                </div>
              )}

              {step === 1 && (
                <div data-tour="digilocker">
                  <div className="rounded-lg border border-line p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand-tint-fg"><Fingerprint className="size-5" aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-fg">{t("kyc.title")}</p>
                        <p className="mt-0.5 text-small text-fg-2">{t("kyc.body", { phone: form.phone })}</p>
                      </div>
                      {kyc === -1 && <Button variant="primary" onClick={runKyc}>{t("kyc.start")}</Button>}
                      {kyc === 4 && <Badge variant="success"><ShieldCheck aria-hidden /> {t("kyc.verified")}</Badge>}
                    </div>
                    {kyc >= 0 && (
                      <ol className="mt-4 space-y-2.5 border-t border-line pt-4" aria-live="polite">
                        {KYC_STEPS.map((k, i) => (
                          <li key={k} className={cn("flex items-center gap-2.5 text-sm transition-colors", kyc > i ? "text-fg" : kyc === i ? "text-fg" : "text-fg-3")}>
                            {kyc > i ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : kyc === i ? <Loader2 className="size-4 animate-spin text-brand" aria-hidden /> : <span className="size-4 rounded-full border border-line-strong" aria-hidden />}
                            {t(`kyc.${k}`, { last4: preset.aadhaarLast4 })}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <AnimatePresence>
                    {kyc === 4 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex gap-4 rounded-lg border border-success/40 bg-success-tint/50 p-4">
                        <div className="grid h-[88px] w-[72px] shrink-0 place-items-center rounded-md bg-surface text-lg font-semibold text-fg-2 ring-1 ring-line">
                          {form.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </div>
                        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 text-small">
                          <div className="col-span-2"><dt className="text-xs text-fg-3">{t("kyc.name")}</dt><dd className="font-medium text-fg">{form.name}</dd></div>
                          <div><dt className="text-xs text-fg-3">{t("kyc.dob")}</dt><dd className="text-fg tnum">{f.date(preset.dob)}</dd></div>
                          <div><dt className="text-xs text-fg-3">{t("kyc.aadhaar")}</dt><dd className="font-mono text-fg">XXXX XXXX {preset.aadhaarLast4}</dd></div>
                          <div className="col-span-2"><dt className="text-xs text-fg-3">{t("kyc.address")}</dt><dd className="flex items-start gap-1 text-fg"><MapPin className="mt-0.5 size-3 shrink-0 text-fg-3" aria-hidden />{preset.address}</dd></div>
                        </dl>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {kyc === 4 && <p className="mt-3 text-xs text-fg-3">{t("kyc.note")}</p>}
                </div>
              )}

              {step === 2 && (
                <fieldset data-tour="bed-pick">
                  <legend className="mb-3 text-small text-fg-2">{t("bed.legend", { block: form.gender === "F" ? "C" : "A, B" })}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.map((b, i) => {
                      const rm = roomById[b.roomId];
                      const mates = residents.filter((r) => r.status !== "checked_out" && r.bedId.startsWith(`${b.roomId}-`));
                      const checked = bed === b.id;
                      return (
                        <label key={b.id} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors", checked ? "border-brand bg-brand-tint/50 ring-1 ring-brand" : "border-line hover:border-line-strong")}>
                          <input type="radio" name="bed" value={b.id} checked={checked} onChange={() => setBed(b.id)} className="mt-1 accent-[var(--brand)]" />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 text-sm font-medium text-fg"><span className="font-mono">{b.id}</span>{i === 0 && <Badge variant="brand">{t("bed.best")}</Badge>}</p>
                            <p className="mt-0.5 text-xs text-fg-2">{tr(rm.type)} · {f.inr(rm.rent)} · {t("bed.mates", { count: mates.length })}</p>
                            {mates.length > 0 && <p className="mt-1 truncate text-xs text-fg-3">{mates.map((m) => m.institution.split(" · ")[1] ?? m.institution).slice(0, 2).join(", ")}</p>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {step === 3 && room && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-line">
                    <div className="flex items-center gap-3 border-b border-line p-4">
                      <BedDouble className="size-5 text-fg-3" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg">{form.name} → <span className="font-mono">{bed}</span></p>
                        <p className="text-xs text-fg-2">{tr(room.type)} · {t("confirm.from", { date: f.date(today) })}</p>
                      </div>
                    </div>
                    <dl className="divide-y divide-line text-sm">
                      <Line label={t("confirm.rent", { days, dim })} value={f.inr(proRent)} />
                      {mess && <Line label={t("confirm.mess", { days, dim })} value={f.inr(proMess)} />}
                      <Line label={t("confirm.deposit")} value={f.inr(hostel.deposit)} />
                      <Line label={t("confirm.total")} value={f.inr(proRent + proMess + hostel.deposit)} strong />
                      <Line label={t("confirm.monthly")} value={f.inr(room.rent + (mess ? hostel.messFee : 0))} muted />
                    </dl>
                  </div>
                  <div className="space-y-3">
                    <ToggleRow id="ci-mess" label={t("confirm.messPlan")} hint={t("confirm.messHint", { fee: f.inr(hostel.messFee) })} checked={mess} onChange={setMess} />
                    <ToggleRow id="ci-wa" label={t("confirm.welcome")} hint={t("confirm.welcomeHint")} checked={welcome} onChange={setWelcome} />
                  </div>
                  <p className="flex items-start gap-2 rounded-md bg-surface-2 p-3 text-small text-fg-2"><FileText className="mt-0.5 size-4 shrink-0" aria-hidden />{t("confirm.police")}</p>
                </div>
              )}

              {step === 4 && created && (
                <div className="flex flex-col items-center py-6 text-center">
                  <motion.svg viewBox="0 0 52 52" className="size-14" initial="hidden" animate="shown" aria-hidden>
                    <motion.circle cx="26" cy="26" r="24" fill="var(--success-tint)" variants={{ hidden: { scale: 0.6, opacity: 0 }, shown: { scale: 1, opacity: 1 } }} transition={{ duration: 0.3 }} />
                    <motion.path d="M15 27 l7 7 l15 -16" fill="none" stroke="var(--success)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" variants={{ hidden: { pathLength: 0 }, shown: { pathLength: 1 } }} transition={{ duration: 0.35, delay: 0.2 }} />
                  </motion.svg>
                  <p className="mt-4 text-title font-semibold text-fg">{t("done.title", { name: created.name.split(" ")[0], bed: created.bedId })}</p>
                  <p className="mt-1 max-w-sm text-small text-fg-2">{welcome ? t("done.bodyWa") : t("done.body")}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-2/60 px-6 py-4">
          {step === 4 ? (
            <>
              <Button variant="quiet" onClick={() => { close(); router.push(`/dashboard/residents/profile/?id=${createdId}&tab=police`); }}>{t("done.police")}</Button>
              <Button variant="primary" onClick={() => { const b = created?.bedId ?? ""; close(); router.push(`/dashboard/rooms/?block=${b[0]}&floor=${b[2]}&room=${b.split("-").slice(0, 2).join("-")}`); }}>{t("done.floor")}</Button>
            </>
          ) : (
            <>
              <Button variant="quiet" onClick={() => (step === 0 ? close() : setStep((step - 1) as Step))}>{step === 0 ? t("cancel") : t("back")}</Button>
              {step === 0 && <Button variant="primary" onClick={() => validate() && setStep(1)}>{t("next")}</Button>}
              {step === 1 && (
                <div className="flex gap-2">
                  {kyc < 4 && <Button variant="quiet" onClick={() => setStep(2)}>{t("kyc.later")}</Button>}
                  <Button variant="primary" disabled={kyc !== 4} onClick={() => setStep(2)} data-tour="checkin-next">{t("next")}</Button>
                </div>
              )}
              {step === 2 && <Button variant="primary" disabled={!bed} onClick={() => setStep(3)}>{t("next")}</Button>}
              {step === 3 && <Button variant="primary" onClick={complete} data-tour="checkin-complete">{t("complete")}</Button>}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, error, className, children }: { id: string; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-small font-medium text-fg">{label}</Label>
      {children}
      {error && <p className="text-xs text-danger-fg" role="alert">{error}</p>}
    </div>
  );
}
function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className={cn(muted ? "text-fg-3" : "text-fg-2", strong && "font-medium text-fg")}>{label}</dt>
      <dd className={cn("tnum", strong ? "font-semibold text-fg" : muted ? "text-fg-3" : "text-fg")}>{value}</dd>
    </div>
  );
}
function ToggleRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium text-fg">{label}</Label>
        <p className="text-xs text-fg-3">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
