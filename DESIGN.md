# Design System Specification: The Neural Canvas

## 1. Overview & Creative North Star
The vision for this design system is **"The Neural Canvas."** 

In an era of generic, boxy AI dashboards, this system moves toward a high-end editorial aesthetic. We are not just building a tool; we are building a command center for artificial intelligence. The "Neural Canvas" focuses on **Tonal Depth** and **Asymmetric Balance**. 

Rather than relying on the rigid, "boxed-in" layout of standard SaaS templates, we use expansive negative space, varying surface elevations, and sophisticated typography to create a sense of infinite digital space. We treat data as art—utilizing OpenAI blue, Claude purple, and Gemini orange as luminous light sources within a dark void.

## 2. Colors & Surface Architecture
Our palette is built on deep, obsidian neutrals designed to make the high-contrast typography and AI-specific accents vibrate with energy.

### The Foundation
- **Surface (Background):** `#0e0e0e` (Base depth)
- **Main Content Area:** `#111111` (via `surface_container_low`)
- **Sidebar:** `#0f0f0f` (via `surface_dim`)

### The "No-Line" Rule
Standard UI relies on 1px solid borders to separate sections. **This design system prohibits this.** Boundaries must be defined through background color shifts. 
- A card should not have a border; it should sit as a `surface_container_lowest` block on a `surface_container_low` background. 
- Use the **Spacing Scale** (e.g., `spacing.8` or `1.75rem`) to create "gutters" of negative space that act as invisible dividers.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, semi-polished materials.
1. **Level 0 (The Void):** `surface` (#0e0e0e) - Use for the furthest background.
2. **Level 1 (The Stage):** `surface_container_low` (#131313) - Use for the main workspace.
3. **Level 2 (The Component):** `surface_container` (#191a1a) - Use for cards and interactive containers.
4. **Level 3 (The Focus):** `surface_container_highest` (#252626) - Use for active states or floating popovers.

### Glass & Gradient Soul
To ensure the UI feels premium:
- **Floating Elements:** Use `surface_variant` with 60% opacity and a `20px` backdrop-blur.
- **Brand Accents:** Use subtle radial gradients (e.g., `primary` to `primary_container`) for main CTAs. This prevents the "flat" look and adds a sense of light emitting from the screen.

## 3. Typography
We utilize **Inter** not as a standard font, but as an editorial tool.

- **Display Scales (`display-lg` to `sm`):** Reserved for core AI metrics (e.g., Tokens/Sec or Latency). Use `font-weight: 600` and `letter-spacing: -0.04em`.
- **Headline & Title:** Use these for section headers. Always pair a `headline-sm` with a `label-md` in `on_surface_variant` to provide context.
- **Body & Labels:** Use `body-md` for general text. For labels, utilize `label-sm` with `letter-spacing: 0.05em` and uppercase transforms for a "technical" hardware-interface feel.

**Editorial Hierarchy:** Use extreme scale differences. A `display-lg` metric placed next to a `label-sm` caption creates an authoritative, modern hierarchy that smaller jumps in size cannot achieve.

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** and **Ambient Light**, never through heavy dropshadows.

- **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container_low` section. The subtle shift in hex value creates a "lift" that feels integrated into the OS.
- **Ambient Shadows:** For floating modals, use a very large blur (32px+) with a 4% opacity shadow tinted with `primary`. This mimics the way a screen glows in a dark room.
- **The "Ghost Border" Fallback:** If a container requires a border for accessibility, use the `outline_variant` token at **15% opacity**. It should be felt, not seen.
- **Interactive Depth:** On hover, a card should transition from `surface_container` to `surface_bright`. This "lighting up" effect is more intuitive for AI tools than a physical shadow lift.

## 5. Components

### Buttons
- **Primary:** Background: `primary_container`; Text: `on_primary_container`. Use `roundedness.md`.
- **Secondary (Ghost):** No background. `outline_variant` at 20% opacity for the border.
- **State Change:** On hover, use a subtle 1px inner-glow (box-shadow: inset) using `primary_fixed`.

### Status Badges (The "Pulse" Badge)
Instead of a solid box, use a `label-sm` text with a small `4px` circular dot to the left. 
- **OpenAI:** Dot color `primary`.
- **Claude:** Dot color `secondary`.
- **Gemini:** Dot color `tertiary`.

### Input Fields
Avoid the "input box." Use a `surface_container_low` background with only a bottom-border (1px) of `outline_variant`. When focused, the bottom border animates to `primary` and the background shifts to `surface_container_high`.

### AI Cards & Lists
- **Cards:** Forbid divider lines. Use `spacing.5` (1.1rem) to separate internal card elements. 
- **Lists:** Use `surface_container_low` for even rows and `surface` for odd rows to create rhythm without lines.

### Modern Addition: The "Model Trace" Component
For visualizing AI logic, use a thin vertical line (2px) of `primary_dim` that connects different `surface_container` blocks, creating a "circuit board" flow.

## 6. Do's and Don'ts

### Do:
- **Use Asymmetry:** Place your primary metric in the top-left at `display-lg` and leave the top-right empty or for a single "ghost" action.
- **Embrace the Dark:** Allow large areas of `#0e0e0e` to exist. It focuses the user's eye on the active data.
- **Intentional Blur:** Use backdrop blurs on sidebars to allow the main content colors to peak through.

### Don't:
- **Don't use 100% white (#ffffff) for body text.** Use `on_surface` (#e7e5e4) to reduce eye strain and feel more "zinc-like."
- **Don't use standard shadows.** If you can see the shadow, it’s too dark.
- **Don't use "Default" borders.** A 1px solid Slate-500 border is the quickest way to make this system look like a generic template. Use tonal shifts instead.

---

## Implementation Reference

### CSS Variables (`web/src/index.css`)

| Token | Dark | Light |
|-------|------|-------|
| `--color-surface` | `#0e0e0e` | `#f9f9f9` |
| `--color-surface-low` | `#131313` | `#f4f4f4` |
| `--color-surface-card` | `#191a1a` | `#ffffff` |
| `--color-surface-high` | `#1f2020` | `#eeeeed` |
| `--color-surface-highest` | `#252626` | `#e2e2e1` |
| `--color-foreground` | `#e7e5e4` | `#141414` |
| `--color-muted-foreground` | `#acabaa` | `#6b6b6b` |
| `--color-border` | `#262626` | `#e0e0e0` |
| `--color-primary` | `hsl(162,65%,60%)` | `hsl(162,65%,35%)` |
| `--color-secondary` | `hsl(270,100%,75%)` | `hsl(270,60%,55%)` |
| `--color-sidebar` | `#0f0f0f` | `#f4f4f4` |
| `--color-openai` | `hsl(162,65%,60%)` | `hsl(162,65%,35%)` |
| `--color-anthropic` | `hsl(270,100%,75%)` | `hsl(270,60%,55%)` |
| `--color-gemini` | `hsl(25,100%,70%)` | `hsl(25,90%,45%)` |

### Highcharts Config Pattern

```js
chart: { backgroundColor: 'transparent', style: { fontFamily: 'Inter, system-ui, sans-serif' } }
xAxis: { lineColor: '#252626', tickColor: '#252626', labels: { style: { color: '#acabaa', fontSize: '11px' } } }
yAxis: { gridLineColor: '#191a1a', title: { text: undefined }, labels: { style: { color: '#acabaa', fontSize: '11px' } } }
tooltip: { backgroundColor: '#191a1a', borderColor: '#252626', borderRadius: 8, style: { color: '#e7e5e4' } }
```

Provider series colors: OpenAI `#5bdcb0`, Anthropic `#c180ff`, Gemini `#ff9f96`

### File Locations

| Purpose | Path |
|---------|------|
| CSS variables | `web/src/index.css` |
| Theme provider | `web/src/components/ThemeProvider.tsx` |
| Utility functions | `web/src/lib/utils.ts` (formatNumber, formatCost, formatLatency, timeAgo, providerColor) |
| API client | `web/src/lib/api.ts` |
| Layout shell | `web/src/components/Layout.tsx` |
| Sidebar nav | `web/src/components/Sidebar.tsx` |
| Dashboard page | `web/src/pages/Dashboard.tsx` |
| Services page | `web/src/pages/Services.tsx` |
| Logs page | `web/src/pages/Logs.tsx` |
| Settings page | `web/src/pages/Settings.tsx` |