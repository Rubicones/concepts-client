# Usage note · Results gallery and brand switcher (test mode)

## Who, when, from where
- **Who:** the owner and the studio team, before Forma moderation exists.
- **When:** to browse what Forma has produced, show work to someone, or drive the client flow while testing.
- **From where:** desktop, often on a big screen with someone watching. Entry is the brand switcher (⌘K).

## What they need to see first
- **Switcher:** who can be opened, and where each one stands (questionnaire status for accounts). Accounts first (they are the product), Forma brands after.
- **Brand gallery:** every campaign at a glance — what it looks like (keyframe), what it is (kind, formats, languages), how far it got (final ready / N directions / archived), when it last moved.
- **Campaign:** the directions as the client would see them, then the final.

## Primary action
- Switcher: **pick** (Enter or click). It sets the viewer cookie and opens the right place: an account opens its dashboard, a Forma brand opens its gallery.
- Brand gallery: **open a campaign** (the whole card is the target).
- Campaign: **look closer** — click a direction (focus view) or a format on the wall (focus mode).

## Secondary
- Back link to the brand; language and length switchers; fullscreen (F); scene strip in the direction focus view.
- Hidden on purpose: Forma's pipeline (scenario, styles, revisions, costs, art-director notes). Titles drop the internal "Native: / World: / Bold:" prefixes and "Style N" labels.

## What can go wrong
| Risk | Prevention / recovery |
|---|---|
| Migration not applied | The switcher still lists Forma brands and explains in one line which file to apply. |
| R2 / Supabase misconfigured | Switcher notice; gallery pages show a calm error with "Try again" (re-fetches). |
| Slow store | Pages stream behind skeletons with the exact card and section shapes; brand and campaign data are cached for minutes. |
| Missing creative file | The tile keeps the keyframe, then says "This preview is unavailable"; the player route logs the missing key. |
| Many frames on one page | Frames load only near the viewport and pause off-screen. Campaign cards use the keyframe image, not a live frame. |
| Brand with no campaigns / campaign with no final | Warm empty states that say what will appear. |
| Accidental clicks | Nothing here is irreversible; everything is read-only. |

## How often
Often, in bursts. So: ⌘K from anywhere, arrow keys + Enter in the list, ←/→ and 1–9 between directions, Space / J / K / L / F in the final viewer.
