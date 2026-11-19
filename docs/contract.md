# Contract: client dashboard ⇄ Forma

What the dashboard reads from Forma, what it writes, and what Forma (and its studio UI, later) may rely on. Keep this file and `forma/supabase/migrations/20261120000001_client_dashboard.sql` in step; anything not listed here is internal to one side.

**Access.** Server side only, with the service role (RLS on, no policies, as in Forma). The browser never talks to Supabase. R2 is reached by presigned URLs (uploads, downloads) or through the player origin (creatives).

---

## 1. What the dashboard reads from Forma (read-only)

| Source | What | Used for |
|---|---|---|
| R2 `brands/versions/<id>/<n>.json` | Brand manifests; latest = highest `n`. `name`, `files`, notes meta. | Test mode: brand switcher, brand names. |
| `entries` `type='campaign'` | `doc.setup`, `doc.variants`, `doc.activeVariant`, `doc.brandId`, `doc.name`. Rows with `status='merged'` are skipped. Variants are read as `hydrateCampaign` in `campaigns.mjs` does. | Results gallery (test mode); building snapshots in the simulator. |
| `entries` `type='preview'` | `doc.output = {path, format, lang, scenes}`. Static, primary format and language. Multi-scene = storyboard, one frame per `?scene=<id>`. | Direction previews. |
| `entries` `type='creative'`, `doc.output.stage='final'` | `doc.output = {path, kind, formats, langs, lengths}`. | Final viewer. |
| `entries` `type='style'` | `output.styles[i] = {name, idea, direction, svg}`; a variant points to it with `styles.entryId` + `chosenIndex`. | Direction titles, ideas, keyframes. |
| R2 `projects/<project>/<file>` | Creative HTML and assets. | Served on the player origin only (§6). |

Constants copied from Forma and checked by `lib/forma-constants.test.ts`: `formats` (`motion.mjs`), `durations` 6/8/10/12/15, `languages` (`shared/languages.mjs`). Brief validation mirrors Forma's messages (`lib/brief.ts`).

---

## 2. Tables the dashboard owns

All are created by the migration above. Forma's `forma_schema` stays at 1 (new tables only).

| Table | Written by | Notes |
|---|---|---|
| `client_accounts` | dashboard | `kind` brand / agency; `test=true` for accounts made in test mode. |
| `client_brands` | dashboard on questionnaire approval | One per brand account; one per agency client with `questionnaire_scope` = the prototype's client id (`c1`, `c2`…). Unique on `(account_id, coalesce(questionnaire_scope,''))`. **`forma_brand_id`: set by the studio** when it creates the brand in Forma. |
| `brand_questionnaires` | dashboard | `state` = the prototype's state minus UI-only keys: `{role, mode, a, flags, clients, legal}`. Answer keys in `a` are question ids, scoped for agency clients as `c1:<id>`. **Question ids are the contract** (`questionnaire/schema.ts`). `unlocked` = scoped ids editable while `changes_requested`. |
| `questionnaire_notes` | studio (questions), dashboard (replies) | `question_ids` = scoped ids the note is about. A **client reply** has `author_role='client'` and `question_ids = ['reply:<studio note id>', …the studio note's ids]`. Re-sending the questionnaire resolves open studio notes (`resolved_at`). |
| `client_files` | dashboard | `scope`: `brand`, an agency client id (`c1`…), or **`refs`** (references attached to a campaign brief; allowed once the questionnaire is approved, `category='References'`). `r2_key` under `clients/<accountId>/files/<fileId>/<safe-name>`. Status `uploading` → `ready` after a size check. Zips welcome; Forma unpacks them. |
| `campaign_requests` | dashboard (create, client decisions), studio (accept, send, cancel) | `setup = {kind, formats, languages, lengths}`; `brief` = §3. **`forma_campaign_id`: set by the studio** on accept. `rebuilds_used` ≤ 2. `approved_item_id` = the chosen variant id. `version` for compare-and-set. |
| `deliveries` | studio (send), dashboard (client response) | Immutable `items` snapshot (§4). `round` per stage. `status` `sent` → `responded` (client answered) or `superseded` (a newer round replaced it). `response = {decision:'approve'|'rebuild', itemId?, reason?, at}`. |
| `delivery_comments` | dashboard | Client comments on a directions round (§5). |
| `delivery_exports` | **Forma's export job** (later); test mode seeds samples | §7. |
| `client_events` | both, via the transition functions | Timeline and (later) emails. §8. |

`updated_at` is kept by triggers on accounts, questionnaires, campaigns and comments.

---

## 3. Campaign brief (`campaign_requests.brief`)

```jsonc
{ "requestId": "<uuid>",            // idempotency key of the submit; one campaign per requestId
  "product": "", "promote": "…",    // promote required
  "goal": "…", "offer": "", "offerText": "",   // offerText required unless "No offer" / "Up to you"
  "cta": "…",
  "links": [{ "a": "https://…", "b": "what it is" }],
  "fileIds": ["<client_files.id with scope 'refs'>"],
  "note": "" }
```
"Up to you" (`UP_TO_YOU`) means the studio decides. Prefill comes from the approved questionnaire (`questionnaire/prefill.ts`).

---

## 4. Delivery snapshots (`deliveries.items`)

```jsonc
// stage 'directions' — exactly 3 different variants
{ "directions": [
  { "id": "<variant id>", "title": "Morning Light", "idea": "One line the client understands",
    "previewEntryId": "…", "path": "/p/<project>/<rev>.html",
    "format": "9x16", "lang": "en", "scenes": ["s1","s2","s3"],   // [] for poster / single
    "keyframeSvg": "<svg…>",
    "studioNote": "optional note from us" } ] }

// stage 'final'
{ "final": { "id": "<variant id>", "title": "Morning Light", "entryId": "…", "path": "/p/<project>/<rev>.html",
             "kind": "multi", "formats": ["9x16","1x1"], "langs": ["en","de"], "lengths": [10, 15] } }
```
- Titles and ideas are written for the client: Forma's "Native: / World: / Bold:" prefixes and technical notes never go in (`clientTitle`).
- `path` must be `/p/<uuid>/<file>`; anything else is refused when building.
- `keyframeSvg` is shown only as an `<img>` data URI (inert), never as inline HTML.
- Builders: `campaign/review.ts` (`buildDirectionsSnapshot`), `campaign/final.ts` (`buildFinalSnapshot`). Studio code should produce the same shape.

---

## 5. Comments (`delivery_comments`)

- On a **directions** delivery only. `item_id` = variant id. `scene`, `format`, `lang` = what the client was looking at.
- `x`, `y` in 0–1 of the artboard (pins); both null = a comment on the direction as a whole.
- `number`: per `(delivery, item)`, starting at 1, **never reused** (deleting pin 2 leaves 1 and 3). The dashboard displays 1…n.
- `state`: `draft` while the client works (editable, deletable) → `sent` when the client decides (the transition function flips them in the same transaction) → **`resolved` by the studio** later, optionally with `resolved_note`.
- Trigger `delivery_comments_guard`: drafts only on a `sent` directions delivery (row-locked against the decision); sent comments can't be edited or reverted, only resolved; cascades are allowed.
- Comments on any of the three directions travel with the decision ("take the colours of 2").

---

## 6. Creative player origin

Separate host: `play.<domain>` (locally `play.localhost:3000`). Serves only `/p/*` (R2 `projects/…`) and `/lib/*` (Forma's runtime libraries, copied from `forma/public/lib`). The app host refuses `/p/*`; the player host refuses app routes. Headers are Forma's: `Content-Security-Policy: sandbox allow-scripts; default-src 'none'; …`, `Range` → 206, CORS `*` for assets.

**Protocol (unchanged from Forma's player):**
- Load `${PLAYER_ORIGIN}${path}?f=<format>&l=<lang>&d=<length>[&scene=<id>][&t=<s>][&paused]`.
- Post `{type:'forma:hello'|'forma:play'|'forma:pause'|'forma:seek', t}`.
- Listen for `{type:'forma:time', t, duration, playing, static}`; `static:true` = poster or storyboard, no transport.

---

## 7. Exports (`delivery_exports`)

```
delivery_id, format, lang, length (0 for stills), file_type ('mp4'|'png'|'jpg'|'gif'|'webm'),
r2_key, size, width, height, status ('pending'|'ready'|'failed')
primary key (delivery_id, format, lang, length, file_type)
```
- **Forma's export job writes these** for the latest final delivery; files under `deliveries/<deliveryId>/exports/<file>`. Write `pending` rows first if useful: the panel counts them as "being prepared"; only `ready` rows can be downloaded. `size` lets the panel show totals and progress.
- Several rows may point at the same `r2_key`.
- The dashboard downloads with presigned GETs (60 min) and names files `<Brand>/<Campaign>/<format>/<Brand>_<Campaign>_<format>_<lang>_<length>s.<ext>` (stills without length). File names in R2 don't matter to the client.
- Test mode seeds samples from `fixtures/exports/manifest.json`.

---

## 8. Statuses, transitions and events

Client-visible statuses and their wording are in `lib/client-status.ts`; internal names never reach the client.

**Questionnaire:** `draft` → `submitted` (client) → `changes_requested` (studio, with notes and `unlocked`) → `submitted` (client) → `approved` (studio; creates `client_brands`).
**Campaign:** `submitted` → `in_progress` (studio accept) → `review_directions` (studio sends 3 directions) → `in_production` (client approves one) or back to `in_progress` (client asks for a rebuild, max 2) → `delivered` (studio sends the final). The studio can cancel anything not yet delivered.

Every status change goes through `lib/state-machine.ts` (pure planner) and one Postgres function — `client_questionnaire_transition`, `client_campaign_transition` — that does compare-and-set on `version` **and** the from-status, applies side effects (brands, deliveries, comments, rebuild count) and inserts the event, in one transaction. Execute is revoked from `public`, `anon`, `authenticated`. **The studio UI should call these functions too** (actor `studio`), not update rows directly.

| Event `type` | Payload |
|---|---|
| `questionnaire.submitted` / `questionnaire.resubmitted` | `{}` |
| `questionnaire.changes_requested` | `{questions}` |
| `questionnaire.approved` | `{brands}` |
| `campaign.submitted` | `{kind}` |
| `campaign.accepted` | `{}` |
| `directions.sent` | `{deliveryId, round}` |
| `direction.approved` | `{itemId}` |
| `directions.rebuild_requested` | `{round}` |
| `final.delivered` | `{deliveryId, round}` |
| `campaign.cancelled` | `{}` |

---

## 9. What Forma will do later (keep this stable)

- Studio moderation UI: accept, send directions (pick 3 variants, optional `studioNote`), send the final, answer questionnaires, resolve comments — all through the transition functions and the snapshot shapes above.
- Create the brand in Forma from an approved questionnaire and set `client_brands.forma_brand_id`.
- Render exports into `delivery_exports`.
- Emails from `client_events`.
