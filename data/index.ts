// The signed-in hostel's reference data. It is loaded from the database (lib/sync.ts) before any
// screen renders, then shared as plain objects so screens can read it without prop drilling.
// The JSON files next to this one are the sample hostel that `npm run db:setup` loads into Neon.
import type {
  Activity, Bed, Complaint, Expense, GateEvent, Hostel, Invoice, LeaveRequest, Mess, Notice, Resident, Room, Staff, Visitor, WAThread,
} from "./types";

export * from "./types";

const EMPTY_MESS: Mess = {
  menu: [],
  plateCost: { breakfast: 0, lunch: 0, snacks: 0, dinner: 0 },
  rebatePerDay: 0,
  rebateMinDays: 3,
  cutoffs: { breakfast: "21:00", lunch: "09:00", snacks: "13:00", dinner: "15:00" },
  servingTimes: { breakfast: "07:30–09:00", lunch: "12:30–14:00", snacks: "16:30–17:30", dinner: "19:30–21:00" },
  specials: [],
  optOuts: [],
};

export const hostel: Hostel = {
  id: "", name: "", city: "", address: "", phone: "", whatsapp: "", upiId: "", bank: "",
  owner: { name: "", phone: "" }, wardenId: "", blocks: [],
  rentByType: { single: 0, double: 0, triple: 0, six: 0 }, messFee: 0, deposit: 0, dueDay: 7,
  now: "", today: "", months: [],
};
export const rooms: Room[] = [];
export const staff: Staff[] = [];
export const messMenu: Mess = structuredClone(EMPTY_MESS);

/** Replace the shared reference data with another hostel's. */
export function setReferenceData(next: { hostel: Hostel; rooms: Room[]; staff: Staff[]; mess: Partial<Mess> }) {
  Object.assign(hostel, next.hostel);
  rooms.splice(0, rooms.length, ...next.rooms);
  staff.splice(0, staff.length, ...next.staff);
  Object.assign(messMenu, structuredClone(EMPTY_MESS), next.mess, { optOuts: [] });
}

/** The part of a hostel that changes while people use it. Lives in the store and syncs to the database. */
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

export function emptySeed(): Seed {
  return { beds: [], residents: [], invoices: [], expenses: [], complaints: [], gate: [], leaves: [], visitors: [], optOuts: [], notices: [], activity: [], whatsapp: [], staffAttendance: {} };
}
