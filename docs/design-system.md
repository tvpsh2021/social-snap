# Social Snap Design System

## Design Philosophy

Social Snap is a utility tool used while browsing social media. The UI should feel native to a dark browsing environment — unobtrusive, precise, and fast. It should not feel like a generic browser extension.

The visual direction is "midnight workspace": deep blue-indigo backgrounds, soft lavender text, minimal chrome. Think of a dark sky with muted starlight — the media thumbnails are the hero, everything else steps back.

---

## Color Palette

All colors are drawn from a single palette for cohesion. Never introduce colors outside this system.

| Token                  | Value     | Name           | Usage                                      |
|------------------------|-----------|----------------|--------------------------------------------|
| `--color-bg`           | `#090f1e` | Near Black     | Page / popup background                    |
| `--color-surf-0`       | `#0e1729` | Dark Blue      | Popup shell background                     |
| `--color-surf-1`       | `#192a51` | Space Indigo   | Cards, grid items, button backgrounds      |
| `--color-surf-2`       | `#1f3264` | Deep Indigo    | Elevated surfaces, hover states            |
| `--color-border`       | `rgba(170,161,200,0.09)` | –  | Default borders                            |
| `--color-border-hi`    | `rgba(213,198,224,0.18)` | –  | Hover / active borders                     |
| `--color-text-primary` | `#f5e6e8` | Lavender Blush | Primary text, icons on dark surfaces       |
| `--color-text-secondary`| `#d5c6e0`| Thistle        | Secondary text, labels                     |
| `--color-text-muted`   | `#aaa1c8` | Lilac          | Muted text, badges, accent elements        |
| `--color-text-faint`   | `#967aa1` | Dusty Mauve    | Placeholder text, disabled states          |

**Rules:**
- Never use `#1877f2` (Facebook blue) or any saturated brand color as an accent.
- The accent color is Lilac (`#aaa1c8`) — used for interactive highlights, count pills, video badges.
- Error states use a desaturated red tinted toward the palette: `#d47070`.
- Success states use a muted teal: `#70c4a0`.

---

## Typography

| Role           | Font     | Weight | Size  | Letter-spacing |
|----------------|----------|--------|-------|----------------|
| App name       | Outfit   | 700    | 14px  | -0.3px         |
| Body / UI text | DM Sans  | 400–600| 12–13px| 0 to -0.1px   |
| Badges / labels| DM Sans  | 700    | 8–11px | 0.8–1.2px     |

**Rules:**
- Use Outfit only for the app name "Social Snap". Nowhere else.
- DM Sans for all other UI text.
- Avoid Inter, Roboto, and system fonts.
- Keep line heights tight (`1.4–1.6`). This is a compact utility UI, not a reading surface.

---

## Spacing & Layout

- Popup width: **400px** fixed.
- Outer padding: **10–14px**.
- Grid gap: **5px** (thumbnails are the hero — minimize visual noise between them).
- Button gap: **5px**.
- Section separators: `1px solid var(--color-border)`.

---

## Components

### Popup Shell
- `border-radius: 16px`
- `border: 1px solid var(--color-border)`
- Top-edge shimmer: a 1px gradient line (`rgba(170,161,200,0.35)`) across the top to give depth.
- No hard drop shadow colors — use deep rgba blacks only.

### Media Grid
- 3 columns, `aspect-ratio: 1`, `border-radius: 9px`.
- Hover: image scales up (`1.08`) inside the clip; dark overlay fades in; download circle pops in with a spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
- Selected state: Lilac border (`rgba(170,161,200,0.75)`) + subtle indigo overlay.
- Video badge: frosted, small, top-left corner. Text: "VIDEO" in Lilac.
- Grid items animate in on load with a staggered `itemReveal` animation (scale + translateY, 50ms delay per item).

### Buttons
- `border-radius: 10px`, `padding: 11px 16px`, `font-size: 13px`.
- **Primary (Download All):** Space Indigo surface (`--color-surf-1`) + Thistle text + Lilac border. Hover lifts to `--color-surf-2`.
- **Secondary (Images / Videos):** Semi-transparent Space Indigo + Dusty Mauve text. Videos button uses Lilac text with a Lilac-tinted border.
- Disabled: `opacity: 0.3`, `cursor: not-allowed`. Never change background color for disabled — just reduce opacity.
- Active press: `transform: scale(0.975)`.

### Count Pill (header)
- Default: Dusty Mauve text on Space Indigo.
- Active (has items): Lilac text, Lilac-tinted background and border.

### States

| State    | Description                                                 |
|----------|-------------------------------------------------------------|
| Loading  | Skeleton grid (shimmer) + spinning ring + muted label       |
| Error    | Centered icon + title + body text. Icon uses desaturated red. |
| Success  | Centered icon + title + body text. Icon pops in with spring animation. |

---

## Iconography

The app icon uses a **viewfinder + download arrow** motif:
- 4 L-shaped corners = camera viewfinder (framing / capturing)
- Central downward arrow = download action (shaft + arrowhead only, no shelf line)
- Background: Space Indigo → deep plum gradient (`#192a51` → `#2d1c4e`)
- Corners drawn in Lilac (`#aaa1c8`)
- Arrow drawn in Lavender Blush (`#f5e6e8`) — brightest element = primary action

At 16px the corner arms are omitted (too small to render cleanly); only the arrow is shown.

Icon generator: `design/icon-generator.html`

---

## Design Reference

Live UI demo (all states): `design/ui-demo.html`

---

## What to Avoid

- Saturated accent colors (blue, green, bright purple gradients)
- White backgrounds or light mode
- Generic hover effects like border-color flashes or box-shadow blobs
- Scale transforms larger than `1.08` on thumbnails (breaks the grid rhythm)
- Adding colors outside the palette for new states or features — extend the token list instead
