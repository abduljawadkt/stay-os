// Rename the product here. Nothing else in the codebase hardcodes the name.
export const brand = {
  name: "StayOS",
  tagline: "Hostel operations, on autopilot",
  domain: "stayos.space",
  payDomain: "pay.stayos.space",
  supportEmail: "support@stayos.space",
  appId: "app.stayos.demo",
  /** Shown on the Terms and Privacy pages. Replace with the registered business name and address. */
  legal: {
    entity: "StayOS",
    address: "Kozhikode, Kerala, India",
    grievanceEmail: "privacy@stayos.space",
    jurisdiction: "Kozhikode, Kerala",
    updated: "20 November 2026",
  },
} as const;
