// WhatsApp Business message templates. Residents get English; parents get Malayalam (their preference in the demo data).
import type { WATemplate } from "@/data";
import { hostel } from "@/data";
import { inr, fmtTime, fmtWeekday } from "./format";
import { payLink } from "./upi";

export interface Rendered {
  header?: string;
  body: string;
  footer?: string;
  buttons?: { label: string; kind: "url" | "reply"; action?: "pay" | "approve" | "reject" | "receipt" | "invoice" | "app" }[];
}
type Data = Record<string, string | number | undefined>;

const when = (v: string | number | undefined, lang: "en" | "ml") => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(v)) return String(v ?? "");
  return `${fmtWeekday(v, lang)}, ${fmtTime(v, lang)}`;
};
const amt = (v: string | number | undefined) => inr(Number(v ?? 0));
const FOOTER = `${hostel.name} · Calicut`;

export function renderTemplate(tpl: WATemplate, d: Data, lang: "en" | "ml"): Rendered {
  const ml = lang === "ml";
  switch (tpl) {
    case "invoice":
      return {
        header: ml ? `ബില്ല് · ${d.month}` : `Invoice · ${d.month}`,
        body: ml
          ? `നമസ്കാരം ${d.name}, ${d.month}-ലെ ബില്ല് തയ്യാറാണ്.\n\nതുക: ${amt(d.amount)}\nഅവസാന തീയതി: ${d.due}\nബില്ല്: ${d.invoiceId}\n\nഏത് UPI ആപ്പ് വഴിയും ഉടൻ അടയ്ക്കാം 👇`
          : `Hi ${d.name}, your ${d.month} invoice is ready.\n\nAmount: ${amt(d.amount)}\nDue by: ${d.due}\nInvoice: ${d.invoiceId}\n\nPay in seconds with any UPI app 👇\n${payLink(String(d.invoiceId))}`,
        footer: FOOTER,
        buttons: [{ label: ml ? `${amt(d.amount)} അടയ്ക്കുക` : `Pay ${amt(d.amount)}`, kind: "url", action: "pay" }, { label: ml ? "ബില്ല് കാണുക" : "View invoice", kind: "url", action: "invoice" }],
      };
    case "reminder_due":
      return {
        body: ml
          ? `നമസ്കാരം ${d.name}, ${amt(d.amount)} (${d.invoiceId}) അടയ്ക്കേണ്ട ദിവസമാണ് ഇന്ന്. ഒരു മിനിറ്റിൽ UPI വഴി അടയ്ക്കാം.`
          : `Hi ${d.name}, a gentle reminder that ${amt(d.amount)} (${d.invoiceId}) is due today. Tap below to pay by UPI in under a minute.\n${payLink(String(d.invoiceId))}`,
        footer: FOOTER,
        buttons: [{ label: ml ? `${amt(d.amount)} അടയ്ക്കുക` : `Pay ${amt(d.amount)}`, kind: "url", action: "pay" }],
      };
    case "reminder_overdue":
      return {
        body: ml
          ? `നമസ്കാരം ${d.name}, ${amt(d.amount)} വാടക ${d.days} ദിവസമായി കുടിശ്ശികയാണ്. ഇന്ന് തന്നെ അടയ്ക്കാൻ ശ്രമിക്കുക. ഇതിനകം അടച്ചെങ്കിൽ PAID എന്ന് മറുപടി നൽകുക.`
          : `Hi ${d.name}, your rent of ${amt(d.amount)} is overdue by ${d.days} days. Please pay today. Already paid? Reply PAID and we'll check.\n${payLink(String(d.invoiceId))}`,
        footer: FOOTER,
        buttons: [{ label: ml ? `${amt(d.amount)} അടയ്ക്കുക` : `Pay ${amt(d.amount)}`, kind: "url", action: "pay" }, { label: ml ? "വാർഡനുമായി സംസാരിക്കുക" : "Talk to the warden", kind: "reply" }],
      };
    case "receipt":
      return {
        header: ml ? "പണം ലഭിച്ചു ✅" : "Payment received ✅",
        body: ml
          ? `${d.child ? `${d.child}-ന്റെ ` : ""}${d.month} മാസത്തെ ${amt(d.amount)} ലഭിച്ചു (${d.invoiceId}).\nUPI റഫറൻസ്: ${d.utr}\n\nനന്ദി!`
          : `Received ${amt(d.amount)} for ${d.month} (${d.invoiceId}).\nUPI ref: ${d.utr}\n\nThank you! Your receipt is below.`,
        footer: FOOTER,
        buttons: [{ label: ml ? "രസീത് ഡൗൺലോഡ്" : "Download receipt", kind: "url", action: "receipt" }],
      };
    case "complaint_ack":
      return {
        body: ml
          ? `പരാതി ${d.id} രേഖപ്പെടുത്തി ✅\nവിഭാഗം: ${d.category}\nമുറി: ${d.room}\n${d.sla}-നുള്ളിൽ പരിഹരിക്കും. വിവരങ്ങൾ ഇവിടെ ലഭിക്കും.`
          : `Complaint ${d.id} registered ✅\nCategory: ${d.category}\nRoom: ${d.room}\nWe'll fix it within ${d.sla}. You'll get updates right here.`,
        footer: FOOTER,
      };
    case "complaint_update":
      return { body: ml ? `${d.id}: ${d.by} “${d.title}” ശരിയാക്കാൻ വരുന്നു 🔧` : `Update on ${d.id}: ${d.by} is on the way to fix “${d.title}” 🔧`, footer: FOOTER };
    case "complaint_resolved":
      return {
        body: ml ? `${d.id} പരിഹരിച്ചു ✅ (${d.by}).\nഞങ്ങളുടെ സേവനം എങ്ങനെയുണ്ടായിരുന്നു? 1–5 എന്ന് മറുപടി നൽകുക.` : `${d.id} is resolved ✅ (${d.by}).\nHow did we do? Reply with 1 to 5.`,
        footer: FOOTER,
      };
    case "leave_request":
      return {
        header: ml ? "ലീവ് അപേക്ഷ" : "Leave request",
        body: ml
          ? `${d.child} ലീവിന് അപേക്ഷിച്ചിട്ടുണ്ട്.\n\nപുറപ്പെടുന്നത്: ${when(d.from, "ml")}\nതിരികെ: ${when(d.to, "ml")}\nപോകുന്നത്: ${d.destination}\nകാരണം: ${d.reason}\n\nഅംഗീകരിക്കാൻ 1, നിരസിക്കാൻ 2 എന്ന് മറുപടി നൽകുക.`
          : `${d.child} has asked for leave.\n\nLeaving: ${when(d.from, "en")}\nBack: ${when(d.to, "en")}\nGoing to: ${d.destination}\nReason: ${d.reason}\n\nReply 1 to approve or 2 to reject.`,
        footer: FOOTER,
        buttons: [{ label: ml ? "അംഗീകരിക്കുക" : "Approve", kind: "reply", action: "approve" }, { label: ml ? "നിരസിക്കുക" : "Reject", kind: "reply", action: "reject" }],
      };
    case "leave_decision": {
      const ok = d.decision === "approved";
      if (d.resident)
        return { body: ok ? "Your parent approved your leave ✅ Your gate pass QR is ready in the app. Show it at the gate." : "Your parent did not approve this leave request. Talk to them or the warden if plans change.", footer: FOOTER };
      return { body: ml ? (ok ? "നന്ദി. ലീവ് അംഗീകരിച്ചു ✅ വാർഡനെ അറിയിച്ചിട്ടുണ്ട്. പുറപ്പെടുമ്പോഴും തിരികെ എത്തുമ്പോഴും സന്ദേശം ലഭിക്കും." : "നന്ദി. ലീവ് നിരസിച്ചു. വാർഡനെ അറിയിച്ചിട്ടുണ്ട്.") : ok ? "Thank you. The leave is approved ✅ The warden is informed. You'll get a message when they leave and when they're back." : "Thank you. The leave is rejected. The warden is informed.", footer: FOOTER };
    }
    case "gate_in":
      return { body: ml ? `${d.child} ${d.time}-ന് ഹോസ്റ്റലിൽ തിരികെ എത്തി ✅` : `${d.child} entered the hostel at ${d.time} ✅`, footer: FOOTER };
    case "gate_out":
      return { body: ml ? `${d.child} ${d.time}-ന് ഹോസ്റ്റലിൽ നിന്ന് പുറത്ത് പോയി.` : `${d.child} left the hostel at ${d.time}.`, footer: FOOTER };
    case "late_entry":
      return { body: ml ? `${d.child} ഇന്നലെ ${d.time}-നാണ് എത്തിയത്, ${d.curfew} കർഫ്യൂവിന് ശേഷം.` : `${d.child} came in at ${d.time}, after the ${d.curfew} curfew.`, footer: FOOTER };
    case "weekly_summary":
      return {
        header: ml ? "ആഴ്ചയിലെ വിവരം" : "This week",
        body: ml
          ? `${d.child}-ന്റെ ഈ ആഴ്ച:\n✅ 7-ൽ ${d.present} രാത്രി ഹോസ്റ്റലിൽ\n🕙 വൈകിയുള്ള പ്രവേശനം: ${d.late}\n🍛 ${d.meals} ഭക്ഷണം കഴിച്ചു`
          : `This week for ${d.child}:\n✅ ${d.present} of 7 nights at the hostel\n🕙 Late entries: ${d.late}\n🍛 ${d.meals} meals taken`,
        footer: FOOTER,
      };
    case "optout_ack":
      return { body: ml ? `ശരി ✅ ${d.date}-ലെ ${d.meal} ഒഴിവാക്കി. അടുക്കളയിലെ എണ്ണം പുതുക്കി.` : `Done ✅ ${String(d.meal).replace(/^./, (c) => c.toUpperCase())} on ${d.date} is skipped. The kitchen headcount is updated.`, footer: FOOTER };
    case "welcome":
      if (d.parent)
        return {
          header: ml ? "സ്വാഗതം 🏡" : "Welcome 🏡",
          body: ml
            ? `${d.name} ${hostel.name}-ൽ ചെക്ക്-ഇൻ ചെയ്തു (കിടക്ക ${d.bed}).\n\nഫീസ്, വരവ്/പോക്ക്, ലീവ് അപേക്ഷകൾ എല്ലാം ഈ നമ്പറിൽ വാട്സ്ആപ്പിൽ ലഭിക്കും.`
            : `${d.name} has checked in to ${hostel.name} (bed ${d.bed}).\n\nFees, in/out alerts and leave approvals will all come to you here on WhatsApp.`,
          footer: FOOTER,
        };
      return {
        header: "Welcome to Al Noor Residency 🏡",
        body: `Hi ${d.name}! Your bed is ${d.bed}.\n\nFirst invoice: ${amt(d.amount)} (${d.invoiceId})\nWi-Fi: AlNoor-${String(d.bed)[0]} · password on your room card\nGate closes at ${String(d.bed).startsWith("C") ? "9:30 PM" : "10 PM"}\n\nSave this number. Rent, mess, complaints and gate passes all work right here on WhatsApp.`,
        footer: FOOTER,
        buttons: [{ label: `Pay ${amt(d.amount)}`, kind: "url", action: "pay" }, { label: "Open the app", kind: "url", action: "app" }],
      };
  }
}
