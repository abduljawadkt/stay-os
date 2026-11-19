// Fixed demo story. The demo clock starts here and moves forward in real time.
export const demo = {
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
    gender: "F" as const,
    phone: "+91 97441 26593",
    dob: "2002-08-21",
    bloodGroup: "O+",
    hometown: "Payyanur, Kannur",
    occupation: "professional" as const,
    institution: "Software Engineer · UL Technology Solutions, UL Cyberpark",
    parent: { name: "Krishnan Nambiar", relation: "Father" as const, phone: "+91 94473 80215" },
    aadhaarLast4: "7316",
    address: "Kizhakke Veedu, Vellur, Payyanur, Kannur 670307",
    suggestedBed: "C-305-2",
  },
} as const;
