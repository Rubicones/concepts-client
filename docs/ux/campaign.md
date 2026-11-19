# Usage note · Campaign page

**Who, when.** The client checking on a campaign, usually from an email or the home card.

**First thing to see.** Where it stands: the status pill and the rail Brief → Directions → Final (done steps navy, the current one orange). Internal stages never show; everything between "accepted" and "directions sent" is "In progress".

**Body by status.**
- Request sent / In progress: a calm moving gradient with one line of what happens next (no percentages, no ETAs). After a rebuild it says new directions are on their way.
- Ready for your review: the directions review (see `directions-review.md`).
- In progress after approval: "You chose …" as a still card, plus the waiting state.
- Ready: the final viewer with downloads (see `final-viewer.md`, `downloads.md`).
- Cancelled: a quiet banner.
- Always: the brief as sent, read like a document; and a History panel from client_events in the client's words.

**Primary action.** Depends on the status; when nothing is needed, there is deliberately no button.

**What can go wrong.** Unknown or foreign campaign id → not found (never reveals other accounts). Slow data → skeleton in the page's shape. Just sent → a success banner ("Request sent. We'll take it from here.").
