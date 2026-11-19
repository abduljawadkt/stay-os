import type { CapacitorConfig } from "@capacitor/cli";

// The iOS app ships the same static build (`out/`) that Vercel serves.
const config: CapacitorConfig = {
  appId: "app.stayos.demo",
  appName: "StayOS",
  webDir: "out",
  ios: {
    contentInset: "never",
    backgroundColor: "#F7F7F5",
    preferredContentMode: "mobile",
    scheme: "StayOS",
  },
  plugins: {
    StatusBar: { overlaysWebView: true, style: "DEFAULT" },
    // sign-in and data requests go through native HTTP so iOS keeps the Neon Auth session cookie
    CapacitorHttp: { enabled: true },
    CapacitorCookies: { enabled: true },
  },
};

export default config;
