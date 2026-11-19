# Directions review — usage note

**Who and where.** A decision-maker at a laptop, often with a colleague or two around a big screen; sometimes alone on a phone between meetings. They look at three directions, compare, point at details, and decide. The decision is the most consequential click in the product, and they must never fear making it by accident.

## What they do, in order

1. **Arrive** from the email or the "Ready for your review" card. They see three directions side by side, large, live. No reading needed to understand the screen: three pictures, three names, one line each.
2. **Compare.** Hover a storyboard to see its scenes. Click one to open it big. In the focus view `←/→` (or a swipe on a phone) moves between the three, `1/2/3` jumps. The artboard keeps its place; only the creative changes, so the eye compares.
3. **Point.** "Comment" (`C`) turns the cursor into a pin. A click drops a numbered pin exactly there and opens a small box: type, `Enter` saves, `Shift+Enter` new line, `Esc` cancels. Pins stay glued to the picture when the window resizes (they are stored as 0–1 of the artboard). A pin can be dragged to adjust, or moved with the arrow keys when focused. Hovering a pin lights its comment in the panel, and the reverse.
4. **Say something general.** The box at the bottom of the panel is for the direction as a whole ("warmer, more like 2").
5. **Decide.** Each direction has "Choose this direction". A sheet shows what will happen: the direction as a still, every comment that goes with it grouped by direction, one sentence on what comes next, and "Approve (N comments)". Back is always one click. Or "None of these — rebuild", which says how many rebuilds are left, asks for a short reason (chips to get started), and sends the comments too.
6. **See it land.** A short success state, then the campaign moves on. Approval is final; the page shows the chosen direction from then on.

## Why it is built this way

- **Drafts save instantly**, so nobody loses a thought to a closed tab, and colleagues can add theirs from another machine. A counter on each card ("3 comments") makes clear they will be sent with the decision.
- **Comments on any direction are kept**, because "the colours of 2 with the headline of 1" is a normal thing to say.
- **The pin overlay sits exactly over the scaled artboard** and only in comment mode: the iframe cannot report clicks (it is sandboxed on the player origin), and outside comment mode the creative stays untouched.
- **Rebuild limit up front.** When none are left the button is disabled with an explanation, and a banner says so before they start, so the last round is not a surprise.
- **Server is the judge.** The rebuild count, approval irreversibility and "drafts only on an open round" are enforced by the state machine and a database trigger, not the browser. Two colleagues deciding at once: one wins, the other gets "Someone just updated this" with a refresh.
- **Earlier rounds** stay viewable read-only, with what was said, so the conversation has a memory.

## Phones

One direction per screen, swipe between them. Comments open in a bottom sheet; the decision bar stays at the bottom within thumb reach. Comment mode works with a tap.

## Keyboard

`←/→` directions · `1–3` jump · `C` comment mode · `Esc` closes the box, then comment mode, then the view · pins are buttons: `Enter` opens the comment, arrows nudge (`Shift` = bigger steps).

## Motion

Card → focus opens from the card's own rectangle (a reveal, no distortion). Pins spring in on placement. Reduced motion: fades only.
