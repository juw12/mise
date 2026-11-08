# Mise design system

Winner of the /design bracket (direction A, "recipe card"), final 3-0 vs D on council votes.
Borrowed from direction B: the paper order ticket as the in-game step list (judges called it the memorable part).

## Palette

| Token | Hex | Use |
|---|---|---|
| paper | #F4EFE6 | app background |
| surface | #FFFFFF | panels, cards |
| surface-2 | #FBF8F2 | ticket paper, inset areas |
| ink | #1F2420 | primary text (15.6:1 on paper) |
| muted | #565D58 | secondary text (5.9:1 on paper) |
| line | #DCD4C6 | hairlines, borders |
| accent | #B4472B | the one accent: primary buttons, current step, focus ring (white text 5.4:1) |
| accent-soft | #F3DED6 | selected backgrounds |
| sage | #3F6B4E | success / quality "great" (6.2:1 on white) |
| amber | #8A5A12 | warning text (6.0:1 on white) |
| night | #1D211F | overlays, in-game HUD chips |

No purple, violet or indigo anywhere (code gate: hue 250-300 with saturation > 0.2 is rejected).
In-game illustration uses food colours (tomato, scallion, yolk, wood, steel) - never as UI accents.

## Type

- Display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif - titles, recipe names, big numbers.
- Body: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif.
- Ticket: Consolas, "SF Mono", Menlo, monospace - step numbers, timers, prices on the ticket only.
- Numbers: `font-variant-numeric: tabular-nums`.

## Spacing, radius, shadow, motion

- Spacing scale: 4, 8, 12, 16, 24, 32, 48.
- Radius: 10 px controls, 14 px panels, 2 px tickets (paper is square-ish).
- Shadow: one soft shadow `0 1px 2px rgba(31,36,32,.06), 0 8px 24px rgba(31,36,32,.08)`. No glow.
- Motion: 160-240 ms ease-out for UI; respects `prefers-reduced-motion` and the in-game "Reduce motion" setting.

## Voice

Plain, calm, kitchen words. "Slice the scallion", "Order up", "Table 3 is ready to order".
Banned: supercharge, seamless, unlock your, next-level, epic, amazing, exclamation marks in UI, emoji.

## Signature element

The order ticket: a perforated paper slip in monospace that lists the steps of the dish, ticks them off with the
quality you earned, and in the restaurant becomes the ticket rail.

## Banned defaults

- Purple/indigo gradients, gradient text, aurora/glow blobs, glassmorphism.
- Inter as the only face; emoji as icons; sparkles/rocket/zap icons.
- Six identical icon+heading cards; centred-everything layouts.
- Fake testimonials or logos; "Get started" as the only CTA.
- Decorative status dots.
