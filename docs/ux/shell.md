# Usage note · Shell (top bar, page header, test banner)

## Who, when, from where
- **Who:** a brand's marketing lead or founder, or an agency producer switching between client brands.
- **When:** rarely and briefly — once for the questionnaire (often over several sittings), then to start a campaign, to review directions within a day or two, to download finals.
- **From where:** mostly an email link ("Ready for your review") or a bookmark. Desktop first (1280–1600); phones for reviewing and downloading.

## What they need to see first
Where they are and whether anything needs them. The shell itself must stay quiet so the page's one primary action wins.

## The primary action
The shell has none of its own. It hosts the page's context:
- **Logo** → home. Always the way back.
- **Brand name** — which brand they're looking at (agencies juggle several; in test mode, which account is being viewed).
- **Save status** — only on screens that autosave (questionnaire). "Saving… → Saved", as in the prototype; hidden on phones to keep the bar clean (the page shows it inline there).
- **Account menu** — who is signed in; sign-out arrives with auth (§11).

## Secondary / hidden
- Brand switcher (agencies; test mode lists every account and Forma brand) opens with ⌘K. `?` opens the keyboard sheet (see `shortcuts.md`).
- Test mode strip on top, dark and thin: "Test mode — no sign-in; everything is visible", plus a link to the styleguide. It must never be mistaken for production, and must never compete with orange "needs you" accents (the dot is orange because it is a warning about the environment).

## What can go wrong
| Risk | Prevention / recovery |
|---|---|
| Viewer lookup is slow | The bar prerenders; brand and avatar stream in behind Suspense with a matching skeleton circle. No layout shift: the avatar slot has a fixed 40 px box. |
| Supabase/R2 misconfigured | Boot fails with a readable list of missing variables (instrumentation). If the viewer lookup fails at runtime, the bar degrades to anonymous and logs server-side — never a blank page. |
| Long brand names | Truncated with ellipsis; full name in the account menu. |
| Keyboard users | "Skip to content" link is the first tab stop; every control has a visible focus ring. |
| Phone widths | Bar height stays 64 px; the save status hides; brand truncates before the account button ever wraps. |
| Translucent bar unsupported | Falls back to solid white. |

## How often
Every visit, but never the focus. Speed matters more than flourish: no entrance animation on the bar itself; only the save status cross-fades (160 ms).

## Page header
Kicker (small caps, muted) → title (28/40 px, tight tracking) → one-line lead. Actions sit at the right end on desktop (where the eye lands after reading), below the lead on phones. Content width 1440 max, 24 px gutters (16 px on phones).
