"use client";
// Thin wrappers over Capacitor plugins. On the web they quietly do nothing.
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();

export async function haptic(kind: "light" | "success" | "warning" = "light") {
  if (!isNative()) return;
  const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
  if (kind === "light") await Haptics.impact({ style: ImpactStyle.Light });
  else await Haptics.notification({ type: kind === "success" ? NotificationType.Success : NotificationType.Warning });
}

export async function syncStatusBar(dark: boolean) {
  if (!isNative()) return;
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
}
