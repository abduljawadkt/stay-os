import { hostel } from "@/data";
import { brand } from "@/config/brand";

export function upiUri(amount: number, note: string) {
  return `upi://pay?pa=${hostel.upiId}&pn=${encodeURIComponent(hostel.name)}&am=${amount}.00&cu=INR&tn=${encodeURIComponent(note)}`;
}
/** Short, shareable payment link (what goes into the WhatsApp message). */
export function payLink(invoiceId: string) {
  let h = 0;
  for (const c of invoiceId) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return `${brand.payDomain}/${h.toString(36).toUpperCase().slice(0, 6)}`;
}
