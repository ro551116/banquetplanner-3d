# UI Design System

Banquet 3D is a professional planning tool: bright, calm, dense where editing needs it. The 3D scene is the content; chrome recedes.

Tokens live in `tailwind.config.js` and `index.css` (Tailwind 3.4 build step; no CDN).

## Typography

One font stack for every screen (`font-sans`): system UI + PingFang TC / Noto Sans TC / Microsoft JhengHei. No web-font imports.

| Class | Size | Use |
|---|---|---|
| `text-2xs` | 11px | Keycaps (`.ui-kbd`) and dense diagram legends only |
| `text-xs` | 12px | Field labels, meta, captions, status bar |
| `text-sm` | 14px | Body, buttons, inputs, list items, toolbar labels |
| `text-base` | 16px | Panel and dialog titles (`font-semibold`) |
| `text-2xl` | 24px | Page titles (`font-semibold`) |

- Never below 12px for information. No `text-[9px]`/`text-[10px]`/`text-[11px]`.
- No `uppercase`/letter-spaced labels. UI copy is Traditional Chinese; English only for proper nouns (LED, Truss, BOM, JSON).
- Weights: 400 body, 500 labels/buttons, 600 titles. Numbers use `tabular-nums`.
- Labels are quieter than values: label `text-xs text-slate-500`, value `text-sm text-slate-900`.

## Color

- Neutrals: slate only. Text `slate-900` primary, `slate-600` secondary, `slate-500` meta. `slate-400` only for disabled/placeholder. Never `slate-300` text.
- Surfaces: app `slate-100`, panels/toolbars `white`, subtle fill `slate-50`, hover `slate-100`, pressed toggle `slate-200`.
- Borders: `slate-200`. Separate sections with spacing, not divider lines.
- Accent: `blue-600` (hover `blue-700`). Solid blue is reserved for the primary call to action of a region. Selected segment = white chip with `text-blue-700`.
- Semantic: emerald = saved/success, amber = pending/unsaved, red = error/destructive. Do not use them decoratively.
- Presentation (View) chrome is dark: `slate-900` surfaces, `slate-100` text, `slate-800` hover/track.

## Shape and depth

- Radius: `rounded-lg` (8px) controls; `rounded-xl` (12px) cards, panels, dialogs, sheets; `rounded-full` only for status dots and count badges.
- Shadows: `shadow-sm` controls/cards, `shadow-lg` overlays floating on the canvas, `shadow-xl` dialogs and sheets. No custom inset shadows.
- Spacing scale: 4/8/12/16/24 (`1`,`2`,`3`,`4`,`6`). Panels `p-4`; sections `space-y-6`; label→field `space-y-1.5`; field grids `gap-3`.

## Components (`index.css`)

| Class | Use |
|---|---|
| `.ui-label` / `.ui-input` | Form labels and inputs (36px; 44px on touch via `coarse:`) |
| `.ui-btn-primary` / `-secondary` / `-ghost` / `-danger` | Buttons |
| `.ui-icon-btn` | 32px icon button (40px on touch); `aria-pressed="true"` renders the pressed state |
| `.ui-segmented` + `.ui-segment` | Segmented controls; selected via `aria-pressed`/`aria-selected` |
| `.ui-section-title`, `.ui-card`, `.ui-kbd`, `.ui-sheet-handle` | Section headings, cards, keycaps (hidden on touch), bottom-sheet handle |

React primitives: `components/ui/NumberField.tsx` (`NumberField`, `TextField`) — draft-and-commit fields; they never write partial input (empty, `-`) into scene data and skip no-op commits. Object names/icons/groups: `components/objectTypeMeta.tsx`.

## Interaction and responsiveness

- Custom variants: `coarse:` (touch), `fine:`, `can-hover:`. Actions must not be hover-only: reveal on `can-hover:` hover, always visible on touch, visible on `focus-visible`.
- Touch targets ≥ 40px on `coarse`. Keyboard hints never shown on touch.
- Mobile panels are bottom sheets (`rounded-t-2xl`, handle, ≤ 70dvh) so the scene stays visible.
- Icon-only buttons need `aria-label`; dialogs need `role="dialog"`, `aria-modal`, `aria-labelledby`, Esc to close.
- Motion: `animate-fade-in`, `animate-slide-up`, `animate-sheet-up`, `animate-scale-in`; `prefers-reduced-motion` disables them globally.
