"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";

// Web opens the owner dashboard; the iOS app opens its own start screen.
export default function Index() {
  const router = useRouter();
  useEffect(() => {
    const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
    router.replace(native ? "/start/" : "/dashboard/");
  }, [router]);
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <LogoMark size={40} />
    </div>
  );
}
