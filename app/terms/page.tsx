"use client";

import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { brand } from "@/config/brand";

const L = brand.legal;
const sections: LegalSection[] = [
  {
    title: "Who we are and what these terms cover",
    body: [
      `${brand.name} is hostel and PG management software operated by ${L.entity}, ${L.address} ("we", "us"). These terms apply when you create an account, use the web app or the mobile apps, or try the live demo.`,
      "If you sign up on behalf of a hostel or business, you confirm you are allowed to accept these terms for it. That business is the \"customer\". People the customer invites (wardens, residents, parents) use the service under the customer's account.",
    ],
  },
  {
    title: "Your account",
    body: [
      [
        "Give a real name and an email address you control. We may ask you to confirm it with a code.",
        "Keep your password private. You are responsible for what happens under your account.",
        "Tell us straight away if you think someone else has used your account.",
        "You must be at least 18 to create a hostel. Residents under 18 may only use the app through an account the hostel creates, with a parent or guardian linked.",
      ],
    ],
  },
  {
    title: "Free trial, plans and payment",
    body: [
      "New hostels get a 14-day free trial. Nothing is charged automatically when it ends; to keep using the service, choose a plan in Settings.",
      "Plans are priced per hostel per month or per year, plus GST, as shown on the pricing page when you subscribe. Yearly plans are billed in advance.",
      "Until a payment gateway is connected, checkout inside the app runs in test mode and no money is taken. We will tell you before any real charge.",
      "Rent and fees that residents pay go directly to the UPI ID or bank account the hostel sets. We are not a payment service and do not hold residents' money.",
    ],
  },
  {
    title: "Your data",
    body: [
      "The hostel's data (rooms, residents, invoices, complaints and the rest) belongs to the customer. We process it only to run the service, as described in our Privacy policy.",
      "The customer is responsible for having a lawful reason to record residents' and parents' personal data, including identity documents, and for telling them how it is used.",
      "You can export your data while your account is active. After you close an account we delete the hostel's data within 30 days, except where the law requires us to keep records longer.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "Do not use the service to:",
      [
        "break any law, including laws on tenancy, consumer protection, data protection and police verification;",
        "upload someone's personal data or documents without a lawful basis;",
        "send spam or messages people have not agreed to receive, including on WhatsApp;",
        "try to access another hostel's data, probe or overload our systems, or get around security or plan limits;",
        "copy, resell or rebuild the service.",
      ],
      "We may suspend an account that breaks these rules, after telling you when we reasonably can.",
    ],
  },
  {
    title: "The live demo",
    body: [
      "The live demo uses a made-up hostel shared by everyone who tries it. Anything entered there can be seen and reset by other visitors, so do not enter real personal data in the demo.",
    ],
  },
  {
    title: "Third-party services",
    body: [
      "Some features rely on other providers, for example UPI apps and banks, WhatsApp, DigiLocker, email delivery, and our hosting and database providers. Their own terms apply to how they handle your use of them, and we are not responsible for their outages.",
    ],
  },
  {
    title: "Availability and changes",
    body: [
      "We work to keep the service available and your data safe, but we cannot promise it will be uninterrupted or error-free. We may change or improve features; if a change materially reduces what a paid plan includes, we will give notice.",
      "We may update these terms. If the changes matter, we will tell account owners by email or in the app before they take effect.",
    ],
  },
  {
    title: "Liability",
    body: [
      "The service is provided as it is. To the extent the law allows, we are not liable for indirect or consequential losses, lost profits or lost data, and our total liability for any claim is limited to the fees you paid us in the 12 months before the claim.",
      "Nothing in these terms limits liability that cannot be limited under Indian law.",
    ],
  },
  {
    title: "Ending the service",
    body: [
      "You can stop using the service and ask us to close your account at any time. We may end the service for an account that seriously or repeatedly breaks these terms, or if the plan is not paid after the trial.",
    ],
  },
  {
    title: "Law and disputes",
    body: [
      `These terms are governed by the laws of India. Courts in ${L.jurisdiction} have jurisdiction over any dispute, after we have first tried to resolve it with you in good faith.`,
      `Contact: ${L.grievanceEmail}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro={`These terms are the agreement between you and ${L.entity} for using ${brand.name}. They are written to be read, not skimmed past.`}
      sections={sections}
    />
  );
}
