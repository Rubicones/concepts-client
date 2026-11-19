# Keyboard shortcuts — usage note

**Who.** People who review often: the brand manager going through three directions with a colleague, the marketer checking every format before downloading. They live on the keyboard once they know it's there.

**What they need.** To find out what the keys are without leaving the page, and to see first the keys that matter on the page they're on.

- `?` opens the sheet anywhere, except while typing. The account menu has "Keyboard shortcuts" for people who don't guess `?` (and on phones).
- The sections for the current page come first and are marked "this page"; the rest follow, quieter, so the sheet also teaches what exists elsewhere.
- Every shortcut works only where it makes sense and never while a text field has focus. `Esc` always steps back one layer.
- Tooltips on the controls show their key (`C` on Comment, `F` on Fullscreen), so the sheet is a summary, not the only place to learn.

# Motion — audit notes (Milestone 7)

- Durations stay in 120–420 ms; springs come only from `lib/motion.ts`; bare Tailwind transitions default to 160 ms on the prototype's curve. `test/motion-audit.test.ts` keeps this true.
- Reduced motion: Motion's `reducedMotion="user"` drops transforms; CSS keeps only colour and opacity transitions and stops loops. Pins, sheets and the card-to-focus reveal become fades.
