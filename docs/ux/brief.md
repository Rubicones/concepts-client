# Usage note · New campaign brief

**Who, when.** A client who knows what they want to promote, filling a short form in about two minutes — often their second or third campaign, so defaults matter.

**First thing to see.** That most of it is already done. Everything possible is prefilled from the questionnaire: starred products, "What do you want to promote next?", the main goal, offer, button text, kind (video vs static), formats, lengths and ad languages. "Up to you" answers become our defaults (formats 1:1, 4:5, 9:16, 16:9; 10 s).

**Steps.** 1 What we're promoting · 2 What we'll make · 3 Check & send. On desktop a summary is pinned on the right, with "N things left" and the version count (formats × languages × lengths — every version included).

**Primary action.** Next, then "Send request" (large) on step 3, which also says what happens next ("We'll send you three directions to choose from").

**Controls.** Kind as three large cards with tiny calm animations; formats as chips drawn to scale; lengths 6–15 s (with "Shorter videos have fewer scenes" for multi-scene); languages as a search-pick with Forma's codes. Optional references: links and files (uploaded to R2 like questionnaire files), plus a note.

**What can go wrong.**
- Missing or invalid fields → Next jumps to the first problem and explains it under the field; setup rules and messages are Forma's own (validateSetup), so what we accept, Forma accepts.
- Double click or retry → the brief carries a request id; the server returns the campaign it already created.
- Leaving mid-way → the browser asks first.
- Sending fails → the brief stays filled in, and a toast says what happened.

**How often.** A few times a month at most: clarity over speed, but nothing makes them retype what we already know.
