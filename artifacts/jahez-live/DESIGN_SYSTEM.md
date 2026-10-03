> **Superseded palette (2026-09-19).** Gahez Live now carries the Gahez identity
> shared with gahez.space, Agent and Tools: the G lockup, blue `#2563EB` into cyan
> `#22D3EE`, navy text, soft shadows and even radii. The token *names* below are
> unchanged; their values in `src/styles/tokens.css` changed. Where this document
> describes teal, coral, paper, sticker shadows or one sharp corner, read the Gahez
> equivalent. The identity rules live in Gahez Tools, `assets/design/BRAND.md`.

# جاهز Live — Design System

The single source of truth for how this product looks and moves. **Read this
before building or changing any page.** The goal: every new page reuses the
same colors, shapes and animations instead of inventing its own — so the
product feels like one thing, not a stack of one-off designs.

Live reference: run the app and open **`/style-guide`** — every token and
utility class below is rendered there so you can see it, not just read about
it. It updates automatically whenever the token files change.

## Where it lives

| What | File |
|---|---|
| Colors, type scale, spacing, shape, shadow, motion tokens | [`src/styles/tokens.css`](src/styles/tokens.css) |
| Keyframes + animation/interaction utility classes | [`src/styles/animations.css`](src/styles/animations.css) |
| Hand-built component classes (topbar, hero, cards, forms…) | [`src/index.css`](src/index.css) |
| Living, visual reference of everything below | [`src/pages/style-guide.tsx`](src/pages/style-guide.tsx) → `/style-guide` |
| Route manifest (path, nav/footer label, SEO title/description) | [`src/lib/routes.ts`](src/lib/routes.ts) |
| Unconfigured business details (support email, store links, socials) | [`src/lib/site-config.ts`](src/lib/site-config.ts) |
| Shared marketing components (Header, Footer, cards, CTA, FAQ…) | [`src/components/marketing/`](src/components/marketing) |
| Per-route SEO (title/meta/canonical/OG + JSON-LD) | [`src/hooks/use-seo.ts`](src/hooks/use-seo.ts) + [`src/lib/structured-data.ts`](src/lib/structured-data.ts) |

## Adding a new public page

1. Add an entry to `src/lib/routes.ts` (path, nav/footer label if it belongs
   in navigation, SEO title/description).
2. Add the page component under `src/pages/`, call `useSeo(...)` with that
   route's title/description/path at the top, and register it in the
   `<Switch>` in `App.tsx`.
3. Pick a shell: `ContentPage` (Header/Footer/breadcrumbs/title, Tailwind +
   shadcn body) for text-first pages, or hand-build with `Header`/`Footer`
   directly for an expressive marketing page — see the checklist below for
   how to style it either way.
4. Add the route's `path`/`title`/`description`/`h1`/`crumb` (and
   `jsonLd` if the page passes more than a breadcrumb to `useSeo`) to the
   `routes` array in `scripts/generate-seo-html.mjs`. The build writes the
   route's prerendered HTML (meta, JSON-LD, a static heading and links) and
   its `sitemap.xml` entry from that list.
5. Never invent a business detail (email, phone, price, store link, stat).
   If it isn't real yet, read it from `site-config.ts` and hide the UI when
   it's unset — don't hardcode a placeholder into the page.

`index.css` imports both token files first, so every custom class below them
can reference `var(--token-name)`.

## Principles

1. **Never hardcode a new color, shadow or radius.** If the token you need
   doesn't exist yet, add it to `tokens.css` with a comment explaining when
   to use it — don't drop a one-off value into a component class.
2. **Reuse a keyframe/utility before writing a new `@keyframes`.**
   `animations.css` is the only place `@keyframes` should be declared.
3. **Small reusable controls are strict; big bespoke art isn't.** Buttons,
   chips, icon buttons and badges must use the shared radius/shadow tokens
   exactly. A one-off hero illustration (like the landing page's lesson
   window) may scale its own corner radius/shadow to its size — treat the
   token scale as the *reference range* for that case, not a hard rule.
4. **Motion respects `prefers-reduced-motion` automatically.** Every utility
   in `animations.css` is neutralized under that media query already — you
   don't need to add your own guard when you use the utilities as-is. If you
   write a bespoke animation outside these utilities, add it to that guard.
5. **RTL first.** The product is Arabic/RTL (`dir="rtl"`); Space Grotesk /
   LTR direction is reserved for numerals, stats and dev-facing labels.

## Color

Semantic tokens (shadcn convention, HSL triplets — always read through
`hsl(var(--x))` or a Tailwind utility like `bg-primary`):

`background` `foreground` `card` `card-foreground` `popover` `popover-foreground`
`primary` `primary-foreground` `secondary` `secondary-foreground` `muted`
`muted-foreground` `accent` `accent-foreground` `destructive`
`destructive-foreground` `border` `input` `ring` — plus `success`, `warning`,
`info` (with matching `-foreground`) for status messaging that shouldn't
borrow `accent` or `destructive`.

Tailwind utilities (`bg-primary`, `text-muted-foreground`, `border-border`,
…) resolve to these same values via the `@theme inline` block at the top of
`tokens.css` — safe to mix with the hand-built component classes.

Brand "ink & paper" voice — raw hex, **not** part of the semantic system:
`--ink` `--paper` `--coral` `--sun` `--mint`. Use these only for illustrations,
the signal-mark logo, and decorative surfaces that are meant to sit outside
normal light/dark theming (there is currently no dark mode — don't invent
`.dark` values for a component unless you're implementing dark mode for the
whole product).

## Typography

- Arabic/UI text: Cairo (`var(--app-font-sans)` / `var(--app-font-display)`).
- Numerals, mono/technical labels, LTR fragments: Space Grotesk
  (`var(--app-font-mono)`).
- Body and UI text sizes: use Tailwind's default scale (`text-sm`, `text-base`,
  `text-lg`, `text-xl`, …).
- Large fluid headlines: use one of the four display tokens instead of a new
  `clamp()`:
  - `--text-display-xl` — two-column landing hero H1
  - `--text-display-hero` — single-column page hero H1
  - `--text-display-lg` — section headline H2
  - `--text-display-md` — compact section headline H2

  The two shipped pages (landing + discovery) predate this scale and hand-tune
  a few headline sizes per section (e.g. `.teacher-strip h2`,
  `.friction-lead`'s heading) — that's intentional art direction, not a bug.
  New pages should start from the four tokens above rather than adding
  another bespoke `clamp()`.

## Spacing

Tailwind's default spacing scale (`p-4`, `gap-6`, `space-y-8`, …) is the
default for page layout. `tokens.css` also defines `--space-1` … `--space-20`
plus `--space-section` / `--space-section-lg` for hand-rolled component CSS
(the topbar, hero, section paddings) that isn't written with Tailwind
utilities — reach for these only when writing plain CSS, not JSX className.

## Shape — one sharp corner

The brand's recurring shape motif: **one crisp corner against three soft
ones**, instead of a uniform border-radius. Scale, smallest to largest:

| Token | Value | Use for |
|---|---|---|
| `--radius-chip` | `.5rem` uniform | pills, small chips |
| `--radius-control` | `.65rem` uniform | inputs, icon buttons |
| `--radius-signal-sm` | `4px 12px 4px 12px` | small tags |
| `--radius-signal-badge` | `4px 10px 4px 10px` | status badges, small pill buttons |
| `--radius-signal-card` | `4px 18px 18px 18px` | cards, panels |
| `--radius-signal-panel` | `5px 25px 25px 25px` | large surfaces (dialogs, CTA banners) |
| `--radius-signal-mark` | `13px 13px 13px 3px` | the logo mark, avatar-style badges |

Pick whichever corner should read as the shape's "start" in context — the
existing components mix which corner is sharp (top-left vs bottom-left)
depending on layout direction; that's fine, the token controls the *radii
sizes*, not which corner.

## Elevation — sticker shadows

Flat, hard-edged shadows with **no blur** — the product's signature
elevation style, used instead of conventional soft drop shadows everywhere
except floating menus/dropdowns.

```css
box-shadow: var(--shadow-sticker-sm) hsl(var(--accent) / .72);
```

Sizes: `--shadow-sticker-xs` → `-xl`. Pick the color/opacity to match context
(accent for interactive emphasis, `--sun`/`--ink` for illustrations). Use
`--shadow-float` (a real soft shadow) only for menus, dropdowns and popovers
that must float above content without the sticker motif.

## Motion

Durations: `--duration-instant` (100ms) → `--duration-slower` (650ms).
Easings: `--ease-signal` (soft settle, the default for entrances and hovers),
`--ease-spring` (playful overshoot, for pop-ins and follow-button feedback),
`--ease-in-out`.

**Entrances** (apply on mount, or when scrolled into view):
`.fade-up` `.fade-in` `.scale-in` `.slide-up` `.slide-in-right`
`.slide-in-left` `.pop-in`. Stagger siblings with `.delay-1` … `.delay-6`, or
auto-stagger a list: put `.stagger-children` on the parent and
`style={{ '--index': i }}` plus an entrance class on each child.

**Ambient / looping**: `.animate-float` (idle bob for illustrations),
`.animate-pulse-live` ("live now" indicators), `.animate-wiggle` (attention
nudge — use on at most one element per screen), `.animate-shimmer` (loading
skeletons).

**Interaction feedback** (use instead of writing your own
`transform`+`transition`): `.hover-lift`, `.hover-lift-lg` (adds a slight
tilt — the class-card hover style), `.hover-press` (the button-primary
hover style), `.press-shrink` (active-state squeeze for tap targets).

Full list, with live demos and replay buttons: `/style-guide` → section 06.

## Components

Reusable classes already available — check `/style-guide` → section 07
before writing a new one:

- Buttons: `.button-primary`, `.button-secondary`, `.header-login` /
  `.header-signup` (topbar variants)
- Status: `.status-badge` + `.live-dot` / `.premiere-dot`
- Filters: `.filter-pill` (`.active` modifier)
- People: `.teacher-avatar` with an `.avatar-a` … `.avatar-d` color modifier
- Chrome: `.icon-button`, `.avatar` (user avatar), `.mobile-panel`

`src/components/ui/*` is the full shadcn/ui primitive library (Button,
Dialog, Card, Form, …), wired to the same color tokens via the `@theme`
block. It's not used by the current hand-built pages, but is available and
on-brand for new pages that need a form, dialog, dropdown, etc. rather than
a bespoke one.

## Building a new page — checklist

1. Skim `/style-guide` first. Reuse a token or class before adding a value.
2. Colors only from the semantic tokens (or brand tokens for illustration).
3. Headlines from the four display tokens; body text from Tailwind's scale.
4. Corners from the radius scale; elevation from the sticker-shadow scale.
5. Entrances from `animations.css`; no new `@keyframes` in a page file.
6. If you introduce a genuinely new token (a new radius, a new shadow size,
   a new keyframe), add it to `tokens.css` / `animations.css` with a comment
   — not inline in the page — so the next page can reuse it too.
7. Update `/style-guide` if you added a token or utility, so it stays the
   living reference instead of drifting out of date.
