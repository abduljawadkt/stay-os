// The story the demo tells. For a hostel loaded with sample data these point at the people in it;
// lib/sync.ts adjusts them for each hostel when it loads (current month, the resident shown in the apps).
export interface CheckInPreset {
  name: string;
  gender: "M" | "F";
  phone: string;
  dob: string;
  bloodGroup: string;
  hometown: string;
  occupation: "student" | "professional";
  institution: string;
  parent: { name: string; relation: "Father" | "Mother" | "Guardian"; phone: string };
  aadhaarLast4: string;
  address: string;
  suggestedBed: string;
}

export const demo = {
  /** Where the clock starts for sample-data hostels. */
  now: "2026-11-27T10:24:00+05:30",
  currentMonth: "2026-11",
  nextMonth: "2026-12",
  /** Resident shown in the Resident app, and whose parent appears in the Parent app. */
  residentId: "R-1042",
  /** Resident who raises the WhatsApp complaint in the guided demo. */
  complainantId: "R-1107",
  /** Prefilled new resident for the check-in flow. */
  checkIn: {
    name: "Aiswarya Krishnan",
    gender: "F",
    phone: "+91 97441 26593",
    dob: "2002-08-21",
    bloodGroup: "O+",
    hometown: "Payyanur, Kannur",
    occupation: "professional",
    institution: "Software Engineer · UL Technology Solutions, UL Cyberpark",
    parent: { name: "Krishnan Nambiar", relation: "Father", phone: "+91 94473 80215" },
    aadhaarLast4: "7316",
    address: "Kizhakke Veedu, Vellur, Payyanur, Kannur 670307",
    suggestedBed: "C-305-2",
  } as CheckInPreset,
};
