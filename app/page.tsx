"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Check, CircleCheck, MessageCircle } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { LocaleToggle } from "@/components/shell/locale-toggle";
import { Button } from "@/components/ui/button";
import { boot, useSession } from "@/lib/session";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * The app's front door. Phones get a full-screen welcome like a native app; desktops get the same welcome
 * beside a phone. Signed-in people go straight into their hostel. The marketing page lives at /features.
 */
export default function Welcome() {
  const router = useRouter();
  const auth = useSession((s) => s.auth);
  const memberships = useSession((s) => s.memberships);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    boot();
    const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
    if (native) router.replace("/start/");
  }, [router]);
  useEffect(() => {
    if (auth === "signed_in" && memberships) {
      setLeaving(true);
      router.replace("/start/");
    }
  }, [auth, memberships, router]);

  return (
    <>
      <LaunchSplash hold={auth === "loading" || leaving} />
      <WelcomeScreen />
    </>
  );
}

/** A native-style launch screen: the mark on the app background, for a moment on first open. */
function LaunchSplash({ hold }: { hold: boolean }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    let seen = false;
    try {
      seen = !!sessionStorage.getItem("stayos-launched");
      sessionStorage.setItem("stayos-launched", "1");
    } catch {}
    const id = setTimeout(() => setShown(false), seen ? 0 : 650);
    return () => clearTimeout(id);
  }, []);
  const visible = shown || hold;
  return (
    <div
      aria-hidden
      className={cn("fixed inset-0 z-50 grid place-items-center bg-canvas transition-opacity duration-300", visible ? "opacity-100" : "pointer-events-none opacity-0")}
    >
      <div className="flex flex-col items-center gap-3">
        <LogoMark size={64} />
        <span className="text-lg font-semibold tracking-[-0.02em] text-fg">{brand.name}</span>
      </div>
    </div>
  );
}

const SLIDES = ["rent", "rooms", "family"] as const;

/** The swipeable intro. Each layout gets its own instance, so its dots follow its own swipes. */
function Slides() {
  const t = useTranslations("account.welcome");
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const track = useRef<HTMLDivElement>(null);

  // follow the swipe; advance on its own until the person touches it
  const onScroll = () => {
    const el = track.current;
    if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (i: number) => {
    const el = track.current;
    if (el && el.clientWidth) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  useEffect(() => {
    if (touched) return;
    const id = setInterval(() => goTo((index + 1) % SLIDES.length), 4200);
    return () => clearInterval(id);
  }, [index, touched]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={track}
        onScroll={onScroll}
        onPointerDown={() => setTouched(true)}
        onTouchStart={() => setTouched(true)}
        className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        aria-roledescription="carousel"
      >
        {SLIDES.map((k, i) => (
          <section key={k} aria-roledescription="slide" aria-label={`${i + 1} / ${SLIDES.length}`} className="flex w-full shrink-0 snap-center flex-col px-6">
            <div className="flex min-h-0 flex-1 items-center justify-center py-4">
              <SlideVisual kind={k} />
            </div>
            <h2 className="text-center text-[26px] leading-8 font-bold tracking-[-0.02em] text-fg">{t(`${k}.title`)}</h2>
            <p className="mx-auto mt-2 max-w-xs text-center text-[15px] leading-6 text-fg-2">{t(`${k}.body`)}</p>
          </section>
        ))}
      </div>
      <div className="mt-5 flex justify-center gap-2" role="tablist" aria-label={t("slides")}>
        {SLIDES.map((k, i) => (
          <button
            key={k}
            role="tab"
            aria-selected={index === i}
            aria-label={t(`${k}.title`)}
            onClick={() => { setTouched(true); goTo(i); }}
            className={cn("h-2 rounded-full transition-all duration-300", index === i ? "w-6 bg-brand" : "w-2 bg-line-strong")}
          />
        ))}
      </div>
    </div>
  );
}

function WelcomeScreen() {
  const t = useTranslations("account.welcome");
  const slides = <Slides />;

  const actions = (
    <div className="space-y-2.5">
      <Button asChild variant="primary" size="xl" className="h-[54px] w-full rounded-2xl text-[17px]">
        <Link href="/demo/">{t("demo")}</Link>
      </Button>
      <Button asChild variant="secondary" size="xl" className="h-[54px] w-full rounded-2xl text-[17px]">
        <Link href="/login/">{t("signIn")}</Link>
      </Button>
      <p className="pt-1.5 text-center text-sm text-fg-2">
        {t("newHere")} <Link href="/signup/" className="font-semibold text-brand-text">{t("trial")}</Link>
      </p>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* phones and tablets: the app's welcome screen */}
      <main className="flex h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom))] lg:hidden">
        <header className="flex h-14 shrink-0 items-center justify-between px-5">
          <Logo />
          <LocaleToggle />
        </header>
        {slides}
        <div className="mx-auto w-full max-w-md shrink-0 px-5 pt-6">{actions}</div>
      </main>

      {/* desktop: the same welcome next to a phone */}
      <main className="mx-auto hidden min-h-dvh max-w-6xl grid-cols-[minmax(0,1fr)_400px] items-center gap-16 px-10 py-10 lg:grid">
        <div className="max-w-md">
          <div className="flex items-center justify-between">
            <Logo />
            <LocaleToggle />
          </div>
          <h1 className="mt-14 text-[44px] leading-[52px] font-semibold tracking-[-0.025em] text-fg">{t("title")}</h1>
          <p className="mt-4 text-lg leading-8 text-fg-2">{t("body", { brand: brand.name })}</p>
          <div className="mt-8 max-w-sm">{actions}</div>
          <div className="mt-10 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
            <div className="rounded-lg bg-white p-1.5"><QRCodeSVG value={`https://${brand.domain}/`} size={84} level="M" /></div>
            <div>
              <p className="text-sm font-semibold text-fg">{t("phoneTitle")}</p>
              <p className="mt-0.5 text-small text-fg-2">{t("phoneBody")}</p>
            </div>
          </div>
          <Link href="/features/" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand-text hover:underline">{t("learnMore")} <ArrowRight className="size-4" aria-hidden /></Link>
        </div>
        <div className="mx-auto flex h-[760px] w-[380px] flex-col overflow-hidden rounded-[52px] border-[10px] border-[#0b0b0a] bg-canvas pt-12 pb-8 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.35)] dark:border-[#1d1d1b]">
          {slides}
        </div>
      </main>
    </div>
  );
}

/** Small, still pictures of the product for each welcome slide. */
function SlideVisual({ kind }: { kind: (typeof SLIDES)[number] }) {
  const t = useTranslations("account.welcome");
  if (kind === "rent") {
    return (
      <div aria-hidden className="w-full max-w-[300px] select-none">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-small text-fg-2">{t("rent.card")}</p>
          <p className="mt-1 text-[32px] leading-10 font-bold tracking-[-0.02em] text-fg tnum">₹21,21,000</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full w-[88%] rounded-full bg-brand" /></div>
          <p className="mt-2 text-small text-fg-3 tnum">88.5%</p>
        </div>
        <div className="-mt-4 ml-6 flex items-start gap-2.5 rounded-2xl bg-inverse px-4 py-3 text-inverse-fg shadow-lg">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-tint" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("rent.toast")}</p>
            <p className="text-small text-inverse-fg/70">UPI · INV-2611-0208</p>
          </div>
        </div>
      </div>
    );
  }
  if (kind === "rooms") {
    const rooms: (0 | 1 | 2)[][] = [[1], [1, 1], [1, 0], [1, 1, 2], [1, 1, 1], [0, 1, 1]];
    return (
      <div aria-hidden className="grid w-full max-w-[300px] select-none grid-cols-2 gap-2.5">
        {rooms.map((beds, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-small font-semibold text-fg">A-10{i + 1}</span>
              <span className="text-[11px] text-fg-3">{["₹9K", "₹7K", "₹7K", "₹6K", "₹6K", "₹6K"][i]}</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {beds.map((b, j) => (
                <span key={j} className={cn("h-9 w-7 rounded-md", b === 1 ? "bg-brand" : b === 2 ? "border-2 border-warning bg-warning-tint" : "border-2 border-dashed border-line-input")} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden className="w-full max-w-[300px] select-none space-y-3">
      <div className="rounded-2xl bg-[#EFEAE2] p-3 dark:bg-[#1B211F]">
        <div className="rounded-xl bg-white p-3 text-[14px] leading-5 text-[#111B21] shadow-sm dark:bg-[#202C33] dark:text-[#E9EDEF]">
          <p className="flex items-center gap-1 text-xs font-semibold text-[#0C7366] dark:text-[#4FC2AE]"><MessageCircle className="size-3.5" /> Al Noor Residency</p>
          <p className="mt-1">{t("family.message")}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-black/10 pt-2 text-center text-[13px] font-medium text-[#0A7CFF] dark:border-white/10 dark:text-[#53BDEB]">
            <span>{t("family.approve")}</span>
            <span>{t("family.reject")}</span>
          </div>
        </div>
      </div>
      <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-success-tint px-3 py-1.5 text-sm font-medium text-success-fg">
        <Check className="size-4" aria-hidden /> {t("family.done")}
      </p>
    </div>
  );
}
