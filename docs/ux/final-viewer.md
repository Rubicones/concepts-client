# Usage note · Final viewer (and CreativeFrame)

## Who, when, from where
A marketer (or the owner, in the gallery) checking a delivered final: every format and language right, showing it to colleagues, then downloading. Desktop first; phones must play and switch comfortably.

## What they need to see first
Everything at once, playing — then any one format up close.

## Primary action
**Play / pause** the whole set (Space). One transport controls every format on the wall.

## Modes
- **All formats (wall):** formats side by side at one calm height, in sync. Language and length chips apply to all. Clicking a format opens it in focus.
- **One format (focus):** the format large (contain, never cropped), format chips drawn to ratio, transport with frame-accurate scrubbing, timecode, fullscreen. The other formats stay as small thumbnails (paused) so switching is instant.
- Switching mode is a layout animation of the same frames — never a reload. Switching language or length reloads frames *behind* the visible ones at the current time (`?t=`, `paused`), then swaps.

## Secondary
Language, length, format chips; fullscreen. Download comes in Milestone 6 (it will sit at the right of the controls row).

## Sync
Every command goes to every frame (`forma:play` / `forma:pause` / `forma:seek`). The first format is the clock; others are corrected when they drift by more than 0.12 s (checked at most every 0.6 s, from their `forma:time` replies). A frame that loads late joins at the clock's time.

## What can go wrong
| Risk | Prevention / recovery |
|---|---|
| White flash while loading | Keyframe poster under each frame; the frame cross-fades in on its first `forma:time`. |
| Layout shift | Every frame box reserves its format's aspect ratio before anything loads. |
| A creative never answers (missing file, script error) | After 15 s the tile says "This preview is unavailable"; the poster stays. |
| Frames off-screen eating CPU | They pause, and resume when back. |
| Poster (static) finals | No transport; a line explains they are single frames. |
| Keyboard focus inside the creative | Iframes are out of the tab order; the creative is not interactive. |

## How often
Rarely but carefully. Keyboard: Space/K play-pause, ←/→ one frame (Shift: 1 s), J/L ∓1 s, Home start, F fullscreen.

## On the campaign page (Milestone 6)

- The viewer runs full width once the final is delivered; "Download" sits at the end of the controls row (full width on phones) and opens the download panel (see `downloads.md`) without leaving the viewer.
- Fullscreen (`F`, focus mode) takes the stage **and** the transport, so play, scrub and time stay at hand on the big screen.

## Owner review fixes

- **Languages switch instantly.** Every format has a frame per language, loaded after the visible ones and parked, paused and hidden (not painted), at the current time; switching swaps which one shows. Up to 12 frames (≈ the browser's WebGL budget); past that, spares are kept for the format in focus only. Length still reloads (another timeline) at the current time.
- **Rendering cost.** Each creative renders at the pixel density it is actually shown at (the player origin passes it in as `devicePixelRatio`, which WebGL, canvas and Lottie size their buffers by) and at most 60 fps. Opening a format large re-renders it sharper behind the current frame; a playing frame shown much smaller re-renders lighter after 1.5 s. Both keep the time.
- **Loading never freezes the page.** All creatives go through one queue: two start at a time, what you look at first, spares next, thumbnails last; the keyframe or a skeleton covers the wait. Pages you leave unload their creatives.
- **Format switches without loading.** In "One format" every format is pre-rendered (paused, sharp enough for focus) so a switch is a seek + play of a frame that's already there. Hovering a wall tile or "One format" for a quarter second warms that format before the click. Any reload (sharper render, length) loads behind the frame on screen, catches up to the same moment, and only then takes its place, with the old one underneath for a moment: no poster, no black frame.
