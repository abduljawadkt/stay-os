# StayOS design system

**Direction: "Quiet ledger."** Calm, precise and warm, like a well-kept account book at a good private bank. Warm paper neutrals, one deep backwater teal, numbers set like a bank statement. The data is the hero; the chrome stays out of the way.

The product name lives in `config/brand.ts` and is never hardcoded.

### What we borrow, and from whom

| Product | What we take (the pattern, not the look) |
|---|---|
| **Linear** | Borders instead of shadows on resting surfaces. 32px controls. ⌘K everywhere. Color only when it means something. |
| **Stripe Dashboard** | Right-aligned tabular numbers, status chips, a table that opens a side drawer, charts with one colored series plus a gray comparison. |
| **Notion** | Warm neutrals, generous whitespace, sentence-case everything. |
| **Airbnb host app** | Friendly mobile cards with 16px radii, a bottom tab bar and big readable numbers. |
| **Revolut** | One hero number on mobile (what you owe) with one primary action under it. |

> These references come from how those products are generally known to work. The UXKIN library wasn't connected, so this direction is **not** based on a fresh side-by-side of real screens.

### Five rules

1. **Color means something.** The UI is neutral by default. Teal means *action* or *occupied*. Green, amber and red mean *state*. Nothing is colored just for decoration.
2. **Numbers are the interface.** Tabular figures, right-aligned, Indian grouping (₹4,52,300), with units small and muted.
3. **Borders, not shadows.** Shadows are only for things floating above the page.
4. **One primary action per view.** Everything else is secondary or quiet.
5. **Motion explains a change** (a payment lands, a bed moves). It never decorates.

---

## 1. Color

All text pairs below were checked: body text is at least 4.5:1, and meaningful UI edges are at least 3:1.

### Neutrals (warm stone)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--canvas` | `#F7F7F5` | `#0E0E0D` | App background behind cards; sidebar |
| `--surface` | `#FFFFFF` | `#161615` | Cards, tables, drawers, inputs |
| `--surface-2` | `#F2F1EE` | `#1E1E1C` | Row hover, segmented-control track, skeleton base |
| `--surface-3` | `#E9E8E4` | `#272725` | Pressed or selected row, skeleton highlight |
| `--border` | `#E6E4DF` | `#2A2A27` | Card edges, dividers, table rules |
| `--border-strong` | `#D6D4CD` | `#3A3935` | Secondary buttons, hovered cards |
| `--border-input` | `#8F8D85` | `#6F6E67` | Inputs, checkboxes, vacant-bed outline (3:1 or better) |
| `--text` | `#191917` | `#EEEDE9` | Primary text and numbers (17.6:1 / 15.5:1) |
| `--text-2` | `#5C5B55` | `#A8A79F` | Labels, secondary text (6.8:1 / 7.5:1) |
| `--text-3` | `#6E6C65` | `#8C8B83` | Meta, placeholders, chart axes (4.65:1 or better / 4.9:1 or better) |
| `--inverse` | `#191917` | `#EEEDE9` | Toasts, tooltips (text uses `--canvas`) |

### Brand: backwater teal

One color, used with intent.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--brand` | `#0C7366` | `#0F8070` | Primary buttons, occupied beds, chart series 1, focus ring (white text 5.7:1 / 4.8:1) |
| `--brand-hover` | `#0A6157` | `#0E8576` | Primary hover |
| `--brand-pressed` | `#084F47` | `#0C7366` | Primary active |
| `--brand-text` | `#0B6A5E` | `#4FC2AE` | Links and brand-colored text on a surface |
| `--brand-tint` | `#E8F4F1` | `#11302B` | Selected states, active filters, AI answer highlight |
| `--brand-tint-text` | `#0A5249` | `#7FD6C5` | Text on the brand tint |

**Why teal:** Kerala's backwaters, and the trust of money handled well. It is clearly not the generic SaaS blue or purple, and it reads calm rather than loud. It is deep enough to carry white text and still distinct from the success green (hue 172° vs 140°). Every state also carries an icon and a label, so color is never the only signal.

### State

| State | Solid (icons, dots) L / D | Tint (chip bg) L / D | Text on tint L / D | Used for |
|---|---|---|---|---|
| Success | `#1B7A3A` / `#3FB765` | `#E7F4EB` / `#12291A` | `#14632E` / `#5FCB7E` | Paid, verified, approved, resolved |
| Warning | `#B05A06` / `#E0962E` | `#FCF1DF` / `#2E2210` | `#8A4605` / `#F0A957` | Due soon, reserved bed, SLA at risk, pending approval |
| Danger | `#C2331F` / `#E5604C` | `#FCEBE8` / `#331712` | `#A3291A` / `#F48170` | Overdue, SLA breached, late entry, rejected |

### Channel color (one exception)

`--whatsapp: #25D366` is used only as a small glyph or dot on "via WhatsApp" badges, and inside the WhatsApp simulation panel (section 6). It never appears in StayOS's own buttons or charts.

### Avatar tints

Avatars use initials only. The tint is picked from the name, deterministically, from six muted pairs (bg/text): teal `#E3F1EE/#0A5249`, amber `#F8EEDC/#7A4A0B`, blue `#E4EEF7/#1F4F7F`, violet `#EEEAF6/#4F3C80`, clay `#F7E9E3/#83391F`, slate `#ECEEF0/#3E4853`. Dark mode uses a 14% tint on `--surface` with the light-mode text color lifted to about 75% lightness.

---

## 2. Typography

| Role | Family | Why |
|---|---|---|
| Sans (UI and numbers) | **Geist** (`next/font/google`) | A neutral Swiss grotesk close in spirit to Söhne (Stripe) and Inter Display (Linear), with properly engineered tabular figures. |
| Malayalam | **Noto Sans Malayalam** | The most legible Malayalam UI face at 12–14px, with a full weight range and complete conjunct coverage. It sits after Geist in the font stack, so Malayalam glyphs fall back to it per character. |
| Mono (IDs) | **Geist Mono** | Invoice numbers, bed codes and UPI refs: `INV-2611-0142`, `B-204-2`. |

Stack: `var(--font-geist), var(--font-ml), ui-sans-serif, system-ui, sans-serif`.

### Scale

The app UI uses 14px body text, like Stripe and Linear, because it is a dense desktop tool staff use all day. The mobile app uses 16px body text.

| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `caption` | 12 / 16 | 500 | 0 | Table headers, chip text, timestamps, axis labels |
| `small` | 13 / 20 | 400–500 | 0 | Table secondary lines, sidebar groups, helper text |
| `body` | 14 / 20 | 400; strong 500–600 | 0 | Default UI text; card titles (600) |
| `body-lg` | 16 / 24 | 400 | 0 | Mobile body, drawer prose, AI answers |
| `title` | 20 / 28 | 600 | −0.01em | Drawer and dialog titles, mobile section titles |
| `page` | 24 / 32 | 600 | −0.015em | Page titles; mobile large titles use 28 / 34 |
| `kpi` | 32 / 40 | 600 | −0.02em | KPI values |
| `hero` | 44 / 48 | 600 | −0.025em | Mobile "amount due" |

- **Weights in use:** 400, 500 and 600 only. No 700 or 800.
- **Numbers:** `font-variant-numeric: tabular-nums` on every number: table cells, KPIs, currency, timers and dates in columns. Numbers in tables are right-aligned.
- **Malayalam (`lang="ml"`):** same sizes with line-height +4px (14 / 24, 16 / 28), no negative tracking, and weight capped at 600. Labels are allowed to wrap to two lines; never truncate Malayalam mid-word.
- **Case:** sentence case everywhere: headings, buttons, table headers. No all-caps headings.

---

## 3. Spacing and layout

- **Base unit 4px**, using the Tailwind default scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Dashboard shell:** sidebar 240px (collapses to 64px; becomes a sheet below `lg`), top bar 56px, page padding 24px (32px at `xl`), content max-width 1440px.
- **Rhythm:** 16px between cards in a grid, 24px between page sections, 32px from page header to first section.
- **Cards:** 20px padding (16px compact). **Table rows:** 44px (compact 36px).
- **Control heights:** 28 (sm), 32 (md, the dashboard default), 36 (lg). Mobile controls are at least 44px, and primary buttons are 48px.
- **Overlays:** drawer 480px (resident profile 560px), WhatsApp panel 380px, Ask StayOS panel 420 × 640px.
- **Mobile app:** 390 × 844 viewport. On desktop it sits in a device frame; on a real phone it runs full-bleed with safe-area insets. Side gutter 16px, 12px between cards.
- **Alignment:** left-aligned layouts. Only empty states and the success screen are centered.

---

## 4. Shape and depth

| Radius | Value | Used on |
|---|---|---|
| `sm` | 6px | Bed tiles, small buttons, tooltips, checkboxes (4px) |
| `md` | 8px | Buttons, inputs, segmented controls, popovers |
| `lg` | 12px | Cards, dialogs, kanban cards, room cards, toasts |
| `xl` | 16px | Floating drawers and panels, mobile cards, mobile primary buttons (12px) |
| `full` | 9999px | Chips, avatars, the tab-bar pill |

| Shadow | Light | Dark | Used on |
|---|---|---|---|
| `shadow-sm` | `0 1px 2px rgb(25 25 23 / .06)` | none (border only) | Buttons, segmented thumb |
| `shadow-lg` | `0 16px 40px -12px rgb(25 25 23 / .22), 0 4px 12px -4px rgb(25 25 23 / .08)` | `0 16px 48px -12px rgb(0 0 0 / .7)` plus an inset `0 0 0 1px rgb(255 255 255 / .06)` | Popovers, dialogs, drawers, toasts, the AI panel, dragged items |

Resting cards have **no shadow**, only a 1px `--border`. The backdrop is `rgb(14 14 13 / .32)` in light mode and `/ .6` in dark mode, with no blur.

---

## 5. Motion

Framer Motion. Calm, short and physical.

| Token | Value | Use |
|---|---|---|
| `fast` | 120ms ease-out | Hover, press, toggles, chip color |
| `base` | 200ms `cubic-bezier(.2,0,0,1)` | Popovers, tooltips, tab underline, row state changes |
| `slow` | 320ms `cubic-bezier(.2,0,0,1)` enter, 200ms exit | Drawers, panels, dialogs (slide 16px plus fade) |
| `spring` | stiffness 420, damping 36 | Drag to reassign a bed, kanban drop, segmented thumb (`layoutId`) |

**Signature moments.** Only these get choreography:

- **Payment lands:** the row tints success for 1.6s (0 → 1 → 0). The chip cross-fades from *Pending* to *Paid* while a check-mark stroke draws in (300ms). The "Collected" KPI counts up to its new total. A toast reads "₹9,500 from Anjali Menon · UPI".
- **Bed reassigned:** the resident's tile flies to the new bed (`layoutId`), and the old bed fades to vacant.
- **Ticket resolved:** the card moves between columns with the spring, and its SLA chip turns success.
- **AI answer:** lines fade in in sequence (40ms stagger), then the data card rises 8px.
- **KPIs** count up once, on first view (700ms). They never re-animate on re-render.

No bounce, no parallax, no looping decoration. The one exception is the 6px "live" dot on the activity feed, which pulses every 2s. `prefers-reduced-motion` turns off every transform and count-up, keeping only opacity fades of 120ms or less.

---

## 6. Components

Built on shadcn/ui primitives and restyled with the tokens above.

**Buttons** (14/500, md 32px, radius 8)
- **Primary:** `--brand` background, white text, `shadow-sm`. Hover `--brand-hover`, active `--brand-pressed`. One per view.
- **Secondary:** `--surface` background, 1px `--border-strong`, `--text`, `shadow-sm`. Hover `--surface-2`.
- **Quiet:** transparent with `--text-2`. Hover `--surface-2` and `--text`.
- **Destructive:** `--danger` background, white text. Used only inside confirmation dialogs.
- **Icon button:** 32×32, quiet style. It always has an `aria-label` and a tooltip.
- **Disabled:** `--surface-2` background, `--text-3` text, no shadow.
- **Loading:** a 14px spinner replaces the leading icon; the label stays and the width doesn't change.
- **Focus (all):** `:focus-visible` shows a 2px `--brand` ring with a 2px `--surface` offset.

**Links:** `--brand-text`. Inline links are underlined on hover (1px, 3px offset). Nav links are never underlined.

**Inputs:** 32px (44px on mobile), `--surface` background, 1px `--border-input`, radius 8, placeholder in `--text-3`. Focus turns the border `--brand` and adds a 3px ring at `--brand` 20%. Errors use a `--danger` border plus a 12px helper line with an icon in `--danger-text`. Labels are 13/500 above the field, never placeholder-only. The search box shows a `⌘K` key hint.

**Switch** (the skip-meal toggle): 36×20 on desktop, 44×26 on mobile, `--brand` when on. **Checkbox:** 16px, radius 4. **Segmented control** (role switcher, floor picker, EN/മ): a `--surface-2` track with 2px padding, and a `--surface` thumb with `shadow-sm` and radius 6 that slides with the spring.

**Card:** `--surface`, 1px `--border`, radius 12, 20px padding. The header row has a 14/600 title, optional 13px `--text-3` meta and a quiet action on the right. Interactive cards switch to `--border-strong` on hover.

**KPI card:** a 13/500 `--text-2` label with a 16px icon, a 32/600 tabular value, and a 12px `--text-3` sub-line ("of ₹21.4L billed"). The delta chip (for example ↑ 2.1% vs Oct) uses success or danger text on its tint. A 32px sparkline is optional. KPI cards are never color-filled.

**Table:** headers are 12/500 `--text-2`, sentence case, with a bottom rule and a sticky header. Rows are 44px with a 14px `--border` rule, `--surface-2` on hover and `--brand-tint` when selected. The first column stacks a name over a 12px meta line. Numbers are right-aligned and tabular. Row actions appear on hover (always visible on touch). The footer reads "1–25 of 260" with pagination.

**Status chip:** 22px tall, 8px horizontal padding, pill shape, 12/500, a tint background with matching text, and a 6px dot or 12px icon. Variants: neutral, brand, success, warning, danger. The **channel badge** is a neutral chip with a `--whatsapp` glyph and the label "WhatsApp".

**Tabs:** underline style, 14/500 `--text-2`. The active tab is `--text`, with a 2px `--brand` underline that slides.

**Sidebar:** `--canvas` background with a right border. Items are 32px, radius 6, 14/500 `--text-2`, with a 16px icon. The active item gets a `--surface` background, 1px `--border`, `--text`, and a `--brand` icon. Group labels are 12/500 `--text-3`. The footer holds a hostel card ("Al Noor Residency · 300 beds") and the user.

**Top bar** (56px): page title on the left; the role switcher (Owner · Warden · Resident · Parent) in the center; on the right, search ⌘K, EN/മ, the WhatsApp panel toggle, the theme toggle, a "Guided demo" secondary button, and the avatar.

**Drawer:** right side, floating with an 8px inset and radius 16, `shadow-lg`. It has a 20/600 header with a close button, a scrollable body, and a sticky footer for actions. **Dialog:** centered, max 480px wide, radius 12. **Toast:** bottom-right, `--inverse` background, 14px text, radius 12, an icon and an optional "Undo" action; it dismisses after 4s. **Tooltip:** `--inverse`, 12px, radius 6, 300ms delay.

**Room card (floor plan):** radius 12 with a header like "B-204 · Triple · ₹6,500". Beds are 40×48 tiles with radius 6:

| Bed status | Look |
|---|---|
| Occupied | `--brand` fill with white initials |
| Vacant | `--surface` with a 1.5px dashed `--border-input`; hover shows a brand outline and "+" |
| Reserved | `--warning` tint with a 1px warning edge and a clock icon |
| Maintenance | `--surface-2` with diagonal hatching and a wrench icon |
| Overlays | Overdue rent adds a 6px `--danger` dot in the top-right corner; a selected bed gets the focus ring |

A legend with live counts sits above the grid. Block tabs (A/B/C) sit next to a floor segmented control (1–4).

**Kanban card:** `--surface`, radius 12, 12px padding. It shows a 14/500 title, a 12px `--text-3` resident and room line, then a footer with a priority dot, an SLA timer chip and an optional WhatsApp badge. The SLA chip is neutral, turns warning at 75% of the SLA, and turns danger with "Breached" once it's over. A card being dragged gets `shadow-lg` and scales to 1.02, with no rotation.

**Mobile app:** 16px body text, 28/34 large titles, cards with radius 16 and 16px padding. Primary buttons are 48px tall, full width, radius 12. The bottom tab bar is 64px plus the safe area, with 5 tabs (22px icon, 12/500 label); the active tab is `--brand`. The hero dues card shows "Due by 5 Dec" (14 `--text-2`), the amount in `hero` type, and the primary "Pay ₹9,500 via UPI". On desktop a mock status bar (9:41) sits inside the device frame.

**WhatsApp simulation panel.** Its palette applies inside the panel only, because it depicts the user's own WhatsApp. It uses the system font stack inside the panel, and has no WhatsApp logo artwork (a generic chat glyph tinted `--whatsapp`). Double ticks are `#53BDEB`, and emoji are allowed inside message text only.

| | Light | Dark |
|---|---|---|
| Chat background | `#EFEAE2` | `#0B141A` |
| Outgoing bubble | `#D9FDD3` | `#005C4B` |
| Incoming bubble | `#FFFFFF` | `#202C33` |
| Header | `#F0F2F5` | `#202C33` |
| Text | `#111B21` | `#E9EDEF` |

**Ask StayOS:** a floating pill in the bottom-right corner (the StayOS mark, "Ask StayOS" and a `⌘J` hint) opens a 420×640 panel with radius 16 and `shadow-lg`. Each answer card holds the echoed question, the answer text, a data block (a mini table or chart), one primary action, and a source line in 12px `--text-3` ("From 260 residents · updated 2 min ago"). It has suggestion chips in English and Malayalam, and a mic button that shows a 3-bar level meter while listening. No purple, and no sparkle icons.

---

## 7. Data visualization (Recharts)

- **Trend:** a 2px `--brand` line with an area fill from `--brand` at 10% down to 0%. The previous period is a 1.5px dashed `--text-3` line.
- **Bars:** top radius 4. The current period is `--brand` and the comparison is `--border-strong`.
- **Donut** (expenses): inner radius 70%, 2px `--surface` gaps between segments, and the total in the center (`kpi` type).
- **Grid:** horizontal lines only, in `--border`. **Axes:** 12px `--text-3`, tabular, with no axis line. Currency is abbreviated (₹10L).
- **Tooltip:** popover style (`--surface`, border, `shadow-lg`), with values right-aligned.
- **Legends** sit inline next to the chart. Color is always paired with a label.

Expense categories (light / dark):

| Category | Light | Dark |
|---|---|---|
| Food and groceries | `#0C7366` | `#2FA894` |
| Electricity | `#A8720F` | `#E0A93A` |
| Water | `#3577B8` | `#5C9DDB` |
| Salaries | `#7A5BB5` | `#A28BDB` |
| Maintenance | `#C2593A` | `#E07A5A` |
| Internet | `#7C8794` | `#98A2AE` |

---

## 8. States (every data view has all four)

- **Loading:** skeletons shaped like the final layout, `--surface-2` with a slow shimmer sweep (1.4s; static under reduced motion). They appear only after 150ms, so fast loads don't flash. The demo simulates 400–700ms of latency the first time each screen opens. Spinners appear only inside buttons.
- **Empty:** centered in its container. A 40px `--surface-2` tile (radius 12) holds a 20px `--text-2` icon, followed by a 14/600 title, one 13px `--text-2` line, and one action. The copy is specific: *"No overdue rent. Everyone has paid for November."*
- **Error:** an inline banner in the affected card, with a `--danger` tint, an icon and plain words (*"Couldn't load invoices. Check your connection."*), plus a quiet "Try again" button. Form errors are per field. No raw error codes. The demo menu has a "Simulate offline" switch so these can be shown.
- **Success:** a toast plus an inline confirmation. Destructive actions offer Undo for 4s.

---

## 9. Icons and imagery

- **Icons:** lucide-react only, with a 1.75 stroke: 16px in dense UI, 20px in nav and mobile, 24px in empty states. An icon is never alone without a visible label or a tooltip. No emoji in the UI chrome.
- **No stock photos and no illustrations.** People are shown as initials avatars. Documents (Aadhaar summary, the police verification form, invoices, receipts) are rendered as real document previews in HTML/CSS. Complaint "photos" are drawn as simple SVG scenes, not placeholder images.
- **Mark:** a 24px rounded square (radius 6) in `--brand` holding a white door-and-keyhole glyph. The wordmark is Geist 600 at −0.02em. Both read from `config/brand.ts`.

---

## 10. Content and localization

- **Real i18n:** `next-intl` message catalogs (`messages/en.json`, `messages/ml.json`). No string literals in components. The EN/മ toggle is in the top bar on every screen and in the mobile app header, and it sets `<html lang>`.
- **Currency:** `Intl.NumberFormat('en-IN')`, giving ₹4,52,300. Compact values read ₹4.5L and ₹1.2Cr. No paise unless they matter.
- **Dates:** "19 Nov 2026", "Today, 9:42 PM", and relative times in feeds ("4 min ago"). In Malayalam, use `ml-IN` month names with Western digits.
- **Formats:** phone numbers as "+91 98470 12345". IDs in mono: `INV-2611-0142`, bed `B-204-2`, UPI ref `UTR 4321 8890 1123`.
- **Voice:** plain and specific, numbers first. Write "₹1,84,500 pending from 23 residents", not "Some payments are pending". Buttons are verbs: "Raise November invoices", "Send 23 reminders".
- **Terms:** resident (never tenant or inmate), rent, mess fee, gate pass, warden.

---

## 11. Accessibility

- Contrast is verified for every text pair above (4.5:1 for body text, 3:1 for large text and UI edges).
- A visible `:focus-visible` ring on every interactive element, with a logical tab order.
- **Keyboard:** ⌘K search, ⌘J Ask StayOS, Esc closes overlays, and arrow keys move through tabs, segmented controls, the bed grid and kanban columns. Drag-to-reassign and kanban moves also have a keyboard "Move to…" menu.
- Color is never the only signal: bed tiles have icons and `aria-label`s ("B-204 bed 2, occupied by Anjali Menon, rent overdue"), and chips carry text.
- Hit targets are at least 24px on desktop and 44px on mobile.
- `prefers-reduced-motion` is respected, and `lang` switches to `ml` for Malayalam.

---

## 12. Don'ts

Gradients on buttons, headers or text · glassmorphism or backdrop blur · purple "AI" sparkle styling · color-filled KPI cards · emoji as icons · centered page layouts · more than one primary button per view · shadows on resting cards · all-caps headings · pure `#000` or `#fff` backgrounds in dark mode · weights above 600.

---

## 13. Tokens (paste into `app/globals.css`, Tailwind v4 + shadcn)

```css
:root {
  --canvas:#F7F7F5; --surface:#FFFFFF; --surface-2:#F2F1EE; --surface-3:#E9E8E4;
  --border:#E6E4DF; --border-strong:#D6D4CD; --border-input:#8F8D85;
  --text:#191917; --text-2:#5C5B55; --text-3:#6E6C65; --inverse:#191917;
  --brand:#0C7366; --brand-hover:#0A6157; --brand-pressed:#084F47;
  --brand-text:#0B6A5E; --brand-tint:#E8F4F1; --brand-tint-text:#0A5249;
  --success:#1B7A3A; --success-tint:#E7F4EB; --success-text:#14632E;
  --warning:#B05A06; --warning-tint:#FCF1DF; --warning-text:#8A4605;
  --danger:#C2331F;  --danger-tint:#FCEBE8;  --danger-text:#A3291A;
  --whatsapp:#25D366;
  --chart-1:#0C7366; --chart-2:#A8720F; --chart-3:#3577B8; --chart-4:#7A5BB5; --chart-5:#C2593A; --chart-6:#7C8794;
  --radius-sm:6px; --radius-md:8px; --radius-lg:12px; --radius-xl:16px;
  --shadow-sm:0 1px 2px rgb(25 25 23 / .06);
  --shadow-lg:0 16px 40px -12px rgb(25 25 23 / .22), 0 4px 12px -4px rgb(25 25 23 / .08);
  --ease:cubic-bezier(.2,0,0,1);
  /* shadcn mapping */
  --background:var(--canvas); --foreground:var(--text);
  --card:var(--surface); --card-foreground:var(--text);
  --popover:var(--surface); --popover-foreground:var(--text);
  --primary:var(--brand); --primary-foreground:#FFFFFF;
  --secondary:var(--surface-2); --secondary-foreground:var(--text);
  --muted:var(--surface-2); --muted-foreground:var(--text-2);
  --accent:var(--surface-2); --accent-foreground:var(--text);
  --destructive:var(--danger); --input:var(--border-input); --ring:var(--brand);
  --radius:var(--radius-md);
}
.dark {
  --canvas:#0E0E0D; --surface:#161615; --surface-2:#1E1E1C; --surface-3:#272725;
  --border:#2A2A27; --border-strong:#3A3935; --border-input:#6F6E67;
  --text:#EEEDE9; --text-2:#A8A79F; --text-3:#8C8B83; --inverse:#EEEDE9;
  --brand:#0F8070; --brand-hover:#0E8576; --brand-pressed:#0C7366;
  --brand-text:#4FC2AE; --brand-tint:#11302B; --brand-tint-text:#7FD6C5;
  --success:#3FB765; --success-tint:#12291A; --success-text:#5FCB7E;
  --warning:#E0962E; --warning-tint:#2E2210; --warning-text:#F0A957;
  --danger:#E5604C;  --danger-tint:#331712;  --danger-text:#F48170;
  --chart-1:#2FA894; --chart-2:#E0A93A; --chart-3:#5C9DDB; --chart-4:#A28BDB; --chart-5:#E07A5A; --chart-6:#98A2AE;
  --shadow-sm:none;
  --shadow-lg:0 16px 48px -12px rgb(0 0 0 / .7), inset 0 0 0 1px rgb(255 255 255 / .06);
}
```
