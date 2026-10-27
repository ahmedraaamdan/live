# Gahez Live app: design system

The rules every screen of the app follows. **Live reference: `/design`** in
the running app renders every token and component from the real code, in
light and dark.

The marketing site has its own, older system
(`artifacts/jahez-live/DESIGN_SYSTEM.md`); the two share the brand (Gahez
G, rose Live accent, Cairo, Space Grotesk) but not code.

## Foundations

Built on **Material Design 3**'s structure (colour roles, type roles, shape
scale, elevation, state layers, motion tokens, window size classes) with
**Apple HIG** ergonomics where they read better on phones: large collapsing
titles, bottom sheets, 44 px minimum tap targets, safe areas.

Arabic and RTL from the first line: logical properties (`ms-`, `pe-`,
`start-`), back arrows point right, numbers stay LTR.

## Where it lives

| What | File |
|---|---|
| Tokens: reference palette → system roles (light + dark) → component sizes | `src/styles/tokens.css` |
| Tailwind mapping (the default palette, sizes, radii and shadows are **removed**), utilities, keyframes | `src/styles/app.css` |
| Components | `src/ui/*` (import from `@/ui` only) |
| Living reference | `src/pages/design-system.tsx` → `/design` |

## Colour: roles, not colours

Components read roles; roles flip between light and dark.

| Role | Light | Use |
|---|---|---|
| `primary` | Live rose `#E11D48` | The one main action per screen, the brand moment |
| `secondary` | Gahez blue `#2563EB` | Selection (nav, chips, segmented), links, data |
| `tertiary` | Cyan | Progress, homework, highlights |
| `live` | Rose, both themes | Only "on air": the LIVE badge and pulse |
| `success` / `warning` / `error` | Green / amber / red | Status. Errors always carry an icon, never colour alone (red is close to the brand rose) |
| `surface-container-*` | Five steps of navy-tinted slate | Layering: lowest = cards on the page, highest = inputs |
| `stage` | Near-black | The live room, always dark |

Each has `on-*` (content on it) and `*-container` / `on-*-container` pairs.
**60/30/10:** neutral surfaces dominate, navy text second, the brand colour
for the 10% that should be tapped. Gradients (`bg-gradient-brand`,
`-live`, `-ink`) are for one hero surface per screen at most.

## Type

Cairo for everything Arabic; Space Grotesk (`font-num`, tabular) for prices,
timers, stats and codes. M3 roles, sized up for Arabic:
`display-lg/md/sm`, `headline-lg/md/sm`, `title-lg/md/sm`, `body-lg/md/sm`,
`label-lg/md/sm` → `text-title-md` etc. **At most four per screen.** The
value is the hero, the label supports it (a stat's number is bigger than its
caption).

## Shape, elevation, state, motion

- Radius: `xs 4 · sm 8 · md 12 · lg 16 (cards) · xl 24 (sheets) · 2xl 32 · full`.
- Elevation: `shadow-e1` (resting card) … `shadow-e5` (dialog), soft and
  navy-tinted; `shadow-glow` under the primary CTA only.
- State layer: every interactive surface has the `state-layer` utility
  (M3 overlay: hover 8%, focus/pressed 12%) and usually `press` (a 0.97
  squeeze). Don't hand-roll hover colours.
- Motion: `ease-standard` for most, `ease-decelerate` for entrances,
  `ease-spring` for pop/celebration. `animate-enter`, `animate-pop`,
  `animate-live-pulse`, `skeleton`. All neutralised under reduced motion.

## Layout

- Window classes: compact < 600 (bottom navigation bar), medium 600–839,
  expanded ≥ 840 (navigation rail). Breakpoints `md` and `lg` are these.
- 4/8 px rhythm via Tailwind spacing. Page = `TopBar` + `Page`; the screen's
  main action goes in `ActionBar` (thumb zone on phones, inline on desktop)
  or a `Fab` on list screens.
- Overlays: `Sheet` is a bottom sheet on phones and a centred dialog from
  600 px; snackbars (`toast`) sit above the navigation bar.

## Components (src/ui)

`Button` (filled · tonal · outlined · text · neutral · live · danger),
`IconButton`, `Fab`, `Card` / `LinkCard`, `List` / `ListItem`, `Stat`,
`SectionHeader`, `TextField` / `TextArea` / `Select` (native picker on
phones), `Segmented`, `Chip`, `Switch`, `Badge`, `LiveBadge`, `Banner`,
`EmptyState`, `ProgressBar`, `ProgressRing`, `Skeleton`, `Spinner`,
`Avatar` / `AvatarStack`, `Sheet`, `ActionMenu`, `TopBar`, `Page`,
`ActionBar`, `Logo`.

Rules: one `filled` button per screen; `live` only to go/join live; empty
states always say what to do next and offer the action; every loading
state is a skeleton or spinner, never a blank.

## Emotional moments

The peaks get designed, not just shipped: confetti and a pop when a booking
is confirmed and when a teacher goes live; an "end of class" screen that
celebrates the teacher and asks the student for a rating.

## Adding something

1. Check `/design` first.
2. Need a colour/size that doesn't exist? Add a token in `tokens.css` (both
   themes) and map it in `app.css`, with a comment. Never a hex in a page.
   (The whiteboard's ink and paper colours are the one deliberate exception:
   the board is "paper", outside theming.)
3. Add it to `/design`.
