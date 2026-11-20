"use client";

import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { brand } from "@/config/brand";

const L = brand.legal;
const sections: LegalSection[] = [
  {
    title: "Who is responsible for your data",
    body: [
      `For account holders (owners and staff who sign up), ${L.entity}, ${L.address}, decides how your account data is used.`,
      `For residents and parents, the hostel decides what to record and why; ${brand.name} processes that data on the hostel's behalf. Questions about a hostel's records are best sent to the hostel first; we will help them answer.`,
      "We follow India's Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.",
    ],
  },
  {
    title: "What we collect",
    body: [
      [
        "Account details: name, email address, password (stored only as a one-way hash), and your role in each hostel.",
        "Hostel records entered by the hostel: rooms and beds, residents' names, phone numbers, dates of birth, home town, college or employer, parent or guardian contact, check-in and check-out dates.",
        "Identity checks: the result of an Aadhaar/DigiLocker verification and the last four digits of the Aadhaar number. We do not store full Aadhaar numbers or copies of the card.",
        "Rent and payments: invoices, amounts, payment status and the UPI or bank reference. We never see card numbers, UPI PINs or bank passwords.",
        "Day-to-day records: meal skips, complaints and photos attached to them, leave requests, gate entries and exits, visitors, and messages sent through the app.",
        "Technical data needed to keep you signed in and the service secure, such as session tokens and basic request logs.",
      ],
    ],
  },
  {
    title: "How we use it",
    body: [
      [
        "To run the service for the hostel: billing, reminders, room allocation, mess headcounts, complaints, gate passes and reports.",
        "To keep accounts secure: signing you in, confirming email addresses, resetting passwords and preventing misuse.",
        "To tell account owners about their plan, important changes and security issues.",
      ],
      "We do not sell personal data, show advertising, or use residents' data to train AI models.",
    ],
  },
  {
    title: "Who can see it",
    body: [
      [
        "Inside a hostel, access follows roles. Owners see everything. Wardens see operations but not profit and loss or billing. Residents see their own invoices, room and requests. Parents see their own child's.",
        "One hostel can never see another hostel's data. This is enforced in the database itself, not only in the app.",
        "Service providers that host and run the service for us, under contract: our database and sign-in provider (Neon, with servers in Singapore), our web host (Vercel), and email delivery. When features are switched on, also WhatsApp, payment gateways and DigiLocker.",
        "Authorities, when the law requires it, for example police verification of tenants that the hostel itself submits.",
      ],
    ],
  },
  {
    title: "Where it is stored and how it is protected",
    body: [
      "Data is stored in a managed PostgreSQL database in the AWS Singapore region and is encrypted in transit and at rest. Passwords are hashed. Every request is checked against the person's role in the hostel by row-level security in the database.",
    ],
  },
  {
    title: "How long we keep it",
    body: [
      "We keep hostel data while the hostel's account is active. A hostel can delete residents' records it no longer needs. When an account is closed we delete its data within 30 days, except records the law requires us or the hostel to keep (for example tax invoices), which are kept only for that period.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "Under the DPDP Act you can ask to see the personal data held about you, correct or complete it, have it erased when it is no longer needed, withdraw consent where processing relies on it, and nominate someone to act for you. Residents and parents can ask their hostel or write to us.",
      `Write to our grievance contact at ${L.grievanceEmail}. We reply within 7 days and resolve requests within 30 days. If you are not satisfied, you can complain to the Data Protection Board of India.`,
    ],
  },
  {
    title: "Children",
    body: [
      "Residents under 18 can only be added by the hostel, with a parent or guardian linked who can see and approve their requests. We do not use children's data for tracking or advertising.",
    ],
  },
  {
    title: "Cookies and similar storage",
    body: [
      "We use only what is needed to run the app: a secure sign-in cookie, and storage on your device for your language, theme and the hostel you last opened. There are no advertising or cross-site tracking cookies.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "If we change how we use personal data in a way that matters, we will tell account owners before the change takes effect and update the date at the top of this page.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={`How ${brand.name} collects, uses and protects personal data for hostel owners, staff, residents and parents.`}
      sections={sections}
    />
  );
}
