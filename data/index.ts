// Single entry point for the demo's mock data. Everything the app shows starts here.
import type {
  Activity, Bed, Complaint, Expense, GateEvent, Hostel, Invoice, LeaveRequest, Mess, Notice, Resident, Room, Staff, Visitor, WAThread,
} from "./types";
import hostelJson from "./hostel.json";
import roomsJson from "./rooms.json";
import bedsJson from "./beds.json";
import residentsJson from "./residents.json";
import invoicesJson from "./invoices.json";
import expensesJson from "./expenses.json";
import staffJson from "./staff.json";
import complaintsJson from "./complaints.json";
import gateJson from "./gate.json";
import leavesJson from "./leaves.json";
import visitorsJson from "./visitors.json";
import messJson from "./mess.json";
import noticesJson from "./notices.json";
import activityJson from "./activity.json";
import whatsappJson from "./whatsapp.json";

export * from "./types";

export const hostel = hostelJson as unknown as Hostel;
export const rooms = roomsJson as unknown as Room[];
export const staff = staffJson as unknown as Staff[];
export const messMenu = messJson as unknown as Mess;

/** The mutable part of the demo. The store starts from this and "Reset demo data" returns to it. */
export interface Seed {
  beds: Bed[];
  residents: Resident[];
  invoices: Invoice[];
  expenses: Expense[];
  complaints: Complaint[];
  gate: GateEvent[];
  leaves: LeaveRequest[];
  visitors: Visitor[];
  optOuts: Mess["optOuts"];
  notices: Notice[];
  activity: Activity[];
  whatsapp: WAThread[];
  staffAttendance: Record<string, Staff["attendance"]>;
}

export function createSeed(): Seed {
  return structuredClone({
    beds: bedsJson as unknown as Bed[],
    residents: residentsJson as unknown as Resident[],
    invoices: invoicesJson as unknown as Invoice[],
    expenses: expensesJson as unknown as Expense[],
    complaints: complaintsJson as unknown as Complaint[],
    gate: gateJson as unknown as GateEvent[],
    leaves: leavesJson as unknown as LeaveRequest[],
    visitors: visitorsJson as unknown as Visitor[],
    optOuts: (messJson as unknown as Mess).optOuts,
    notices: noticesJson as unknown as Notice[],
    activity: activityJson as unknown as Activity[],
    whatsapp: whatsappJson as unknown as WAThread[],
    staffAttendance: Object.fromEntries((staffJson as unknown as Staff[]).map((s) => [s.id, s.attendance])),
  });
}
