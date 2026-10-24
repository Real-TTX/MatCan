# DesignThix – logo and icons

## Concept

The mark is a **price tag / label with a punched hole** (design, labels) whose face carries **curly braces `{ }`** (placeholders such as
`{{Name}}`). The tag is flat apart from one diagonal gradient; the braces are dark navy so they stay legible on the turquoise end of the gradient.
The word mark is **DesignThix** in a geometric sans (Poppins SemiBold, SIL OFL 1.1) drawn as **outlined paths** (no font needed, identical
everywhere): "Design" in navy, "Thix" in the gradient.

## Colours

| Use | Value |
|---|---|
| Gradient start (turquoise) | `#18d4c0` |
| Gradient middle (light blue) | `#22b8e0` |
| Gradient end (blue) | `#2f86f6` |
| Ink (brace, "Design" on light) | `#0f1b2d` |
| "Design" on dark | `#f2f7fb` |
| App accent (UI, not logo) | `#1fb3d6` |

The gradient runs top left → bottom right in the mark and left → right in "Thix". Gradients are identity only: nowhere else in the UI.

## Levels of detail and files

All SVGs live in `src/DesignThix/wwwroot/`, are hand-checked, have an exact `viewBox`, no external references, no scripts, no `<style>` and
ids prefixed `dtlogo-` (unique per file, so several logos can be inlined on one page).

| Level | File | Size / viewBox | Use |
|---|---|---|---|
| Full logo (light background) | `logo.svg` | 586 × 120 | sign-in, setup, error pages, README, og-image |
| Full logo (dark background) | `logo-dark.svg` | 586 × 120 | same, on dark surfaces ("Design" is light) |
| Mark only | `logo-mark.svg` | 96 × 120 | avatars, menu header, small spaces; works on light and dark |
| Word mark only | `logo-wordmark.svg`, `logo-wordmark-dark.svg` | 464 × 88 | places that already show the mark |
| Favicon | `favicon.svg` | 64 × 64 | browser tab (`<link rel="icon" type="image/svg+xml">`): silhouette, heavier braces, bigger hole, readable at 16 px |
| Maskable icon | `img/icon-maskable.svg` | 512 × 512 | full-bleed gradient with a white tag, tag inside the 80 % safe zone (circle of 410 px) |

Rasters in `src/DesignThix/wwwroot/img/` (rendered, committed):

| File | Source | Use |
|---|---|---|
| `favicon-32.png` | `favicon.svg` | fallback favicon (`<link rel="icon" sizes="32x32">`), transparent |
| `apple-touch-icon.png` (180) | `icon-maskable.svg` | iOS home screen; opaque, iOS rounds the corners |
| `icon-192.png`, `icon-512.png` | `icon-maskable.svg` | manifest icons, purpose `any`: rounded tile, transparent corners |
| `icon-maskable-192.png`, `icon-maskable-512.png` | `icon-maskable.svg` | manifest icons, purpose `maskable`: full bleed |
| `og-image.png` (1200 × 630) | `logo.svg` + claim | social preview: "Etiketten & Designs – offline, mit Platzhaltern" |

Light/dark: `logo-mark.svg` and `favicon.svg` are fixed-colour and work on both. For the full logo and the word mark use the `-dark` file on dark
surfaces (a `<picture>` with `prefers-color-scheme` or the theme class of the page). The files use explicit colours on purpose, so they also
render correctly as `<img>`, in PWA install dialogs and in link previews.

## Regenerating the PNGs

```
cd tests/e2e && npm install && cd ../..                                  # once
NODE_PATH=tests/e2e/node_modules node tools/icons.js                     # Git Bash
$env:NODE_PATH="tests/e2e/node_modules"; node tools/icons.js             # PowerShell
```

`tools/icons.js` renders the SVGs with Playwright in the installed Microsoft Edge (`channel: 'msedge'`, fallback: bundled Chromium) and writes
the PNGs above. Re-run it after every change to `favicon.svg`, `logo.svg` or `img/icon-maskable.svg`.

## Editing the SVGs

- Mark geometry (box 96 × 120): tag path, hole (`evenodd`), braces as one stroked path (stroke 7, 11 in the favicon, 8 in the maskable icon).
  The favicon is the same tag scaled into a 64 box with a larger hole and heavier braces.
- Word mark: Poppins SemiBold at 86 px, tracking -1.5 %, kerning on, converted to outlines (opentype.js, `font.getPath`). To change the text or
  weight redo the conversion; do not replace the paths by `<text>`.
- Check every change at real size and at 16/32 px enlarged ×8, on a light and a dark background.
