# Usage note · Brand questionnaire

## Who, when, from where
A brand's marketing lead or founder (or an agency producer, once for the agency and once per client). They fill it in once, over one or several sittings, often with their site, deck or brand book open in another tab, sometimes handing parts to colleagues. Mostly desktop; phones must work for checking and finishing.

## What they need to see first
Where they are, how much is left, and that nothing they type gets lost. The prototype's look and flow are approved: we ported it, we did not redesign it.

## Primary action per screen
- **Welcome:** pick who's filling it in and how, then "Let's start".
- **Section:** answer, then **Next** (bottom right, where the eye ends).
- **NDA & terms:** **Read and sign** (one window: NDA, then terms).
- **Check & send:** **Send**. When something is missing, the button is disabled *and* the line under it says exactly what ("To send: 3 answers to finish, and the NDA and terms to sign. Take me there").
- **Questions for you:** answer the flagged questions, then **Send answers**.

## Secondary
Back; the sidebar (any section, any order); "Add more detail" (optional questions); "Send a part to a colleague" (copies a deep link to a section); "Copy my answers"; AI assistant export/import; brief upload for agency clients. Team notes (RU) are test-mode only.

## States
| Status (client label) | What the client can do |
|---|---|
| Draft | Everything. Autosaves ~600 ms after the last keystroke; "Saving… → Saved" in the top bar. |
| In review | Read only. The same pages, answers shown as text and chosen chips — a finished document. A banner says when it was sent. |
| Questions for you | Only the flagged answers open, each with our question inline (orange) and a reply field. Everything else stays read-only. The sidebar shows an orange count per section. |
| Approved | Read only, with "Open your dashboard". |

## What can go wrong
| Risk | Prevention / recovery |
|---|---|
| Losing typing (closed tab, network) | Every edit is applied at once and kept in localStorage until the server confirms; re-applied on the next visit. Leaving with unsaved changes asks first. |
| Two tabs or two colleagues | Saves are key-level patches merged on the server with compare-and-set; a race is retried server-side, so neither loses their answers. |
| Saving fails | "Couldn't save · retrying" with backoff; "Offline · saved on this device" when offline. |
| Sending incomplete | Impossible: the server re-checks completeness and both signatures from the stored answers. |
| Accidental send | A calm confirmation states the consequence: answers lock while we review. |
| Picking too many | The extra pick is refused with the prototype's "Up to 3 — tap one to swap" toast (and a shake on mood tiles). |
| Big or failed uploads | 2 GB cap explained up front; per-file progress, cancel, retry; the server checks the file arrived whole before it counts. |
| Editing outside what we asked | The server refuses changes to locked answers while questions are open. |

## How often
Once, plus a short round of follow-ups. So: clarity and reassurance over speed tricks; keyboard works everywhere (Enter picks the first match in country/language search; chips are buttons; pairs are radio groups).
