# Toggle Concepts · Client dashboard

The client side of Toggle Concepts: brand questionnaire, campaign briefs, directions review with pinned comments, final viewer and downloads. Next.js (App Router, Cache Components), TypeScript strict, Tailwind v4, Motion, Radix. It shares the Supabase + R2 store with Forma Studio and treats Forma's data as read-only.

> Status: **complete through Milestone 7.** Questionnaire, home, brief, directions review, final viewer and downloads, polished (motion audit, `?` keyboard sheet, error pages). The contract with Forma is in [`docs/contract.md`](docs/contract.md); the usage notes behind every screen are in [`docs/ux/`](docs/ux).

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in (see Environment)
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run build       # next build
```

## Environment

| Variable | What |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | The Forma Supabase project. Service role, server only. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | The Forma R2 bucket (default `forma`). |
| `NEXT_PUBLIC_PLAYER_ORIGIN` | The separate origin that serves creatives, e.g. `https://play.<domain>`. |
| `DASHBOARD_TEST_MODE` | `1` turns on test mode (below). Leave unset in production. |

The server validates these at boot (`instrumentation.ts` → `lib/env.ts`) and stops with a list of what is missing. `/styleguide` needs only `DASHBOARD_TEST_MODE`.

## Database

The schema lives in Forma's migrations, the single source of truth:
`forma/supabase/migrations/20261120000001_client_dashboard.sql`. Apply it from the Forma repo:

```bash
cd ../../forma && npx supabase db push --remote
```

It adds only new tables (`client_*`, `brand_questionnaires`, `questionnaire_notes`, `campaign_requests`, `deliveries`, `delivery_comments`, `delivery_exports`) two transition functions and a guard trigger on comments. RLS is on with no policies, as in Forma.

## Uploads (R2 CORS, once)

Client files go from the browser straight to R2 with presigned PUT URLs (Vercel request bodies are too small for 2 GB). The bucket must allow the dashboard's origins:

```bash
node --env-file=.env.local scripts/r2-cors.mjs http://localhost:3000 https://app.<domain>
```

This replaces the bucket's CORS rules (Forma uploads from its server and needs none). The same rule (GET) lets the download panel stream export files into the ZIP.

## Review and downloads

- **Directions review** (`components/review/`): comments are drafts on the open round (`delivery_comments`, `state='draft'`), saved instantly; the decision goes through the state machine, whose database function marks the round answered and the drafts sent in one transaction. A trigger (`delivery_comments_guard`) refuses draft writes on a closed round.
- **Downloads** (`components/final/`): files come from `delivery_exports` of the latest final. The browser gets short-lived presigned GET URLs and builds the ZIP itself with `client-zip`, straight to disk where the browser supports it. Names: `<Brand>/<Campaign>/<format>/<Brand>_<Campaign>_<format>_<lang>_<length>s.<ext>` (`campaign/final.ts`). Until rows exist the panel says the files are being prepared.

## Brand questionnaire

`/questionnaire/<step>` — a faithful port of the approved prototype. The schema and logic live in `questionnaire/schema.ts` and `questionnaire/logic.ts` (every question id is the contract with Forma; `logic.test.ts` reproduces the prototype's behaviour). Answers autosave as key-level patches (`questionnaire/patch.ts`), merged on the server with compare-and-set, and are kept in localStorage until the server confirms. NDA and terms texts are versioned in `legal/*.md`; each signature stores the document version and a hash of the exact text.

## How it is put together

- `lib/env.ts` — Zod-validated configuration.
- `lib/supabase.ts`, `lib/r2.ts` — server-only clients (service role, presigned URLs). Keys never reach the browser.
- `lib/viewer.ts` — `getViewer()`, the single identity seam. Today: the test-mode cookie. Later: magic-link sessions, same return shape.
- `lib/state-machine.ts` — every status change. Pure planners (unit-tested) + one Postgres function per object that does compare-and-set on `version`, side effects and the `client_events` row in one transaction.
- `lib/client-status.ts` — the only status words a client sees.
- `components/ui` — primitives. `components/shell` — top bar, page header, test banner, keyboard sheet.
- `components/review`, `components/final`, `components/player` — the directions review, downloads, the creative frame and viewers.
- `campaign/` — pure campaign logic (snapshots, comment numbering, export naming and selection), shared by server, UI and tests.
- `docs/ux/*.md` — usage notes that justify every screen's layout.

## The player origin

Creatives are HTML written by a model, so they never run on the dashboard's origin. The same app answers two hosts, and `proxy.ts` splits them:

| Host | Serves |
|---|---|
| app (`localhost:3000`, `app.<domain>`) | everything except `/p/*` and `/lib/*` |
| player (`play.localhost:3000`, `play.<domain>`) | only `/p/*` and `/lib/*` |

- `/p/<project>/<file>` streams `projects/<project>/<file>` from R2 with Forma's exact preview headers (CSP `sandbox allow-scripts; default-src 'none'; …`, `nosniff`, `no-referrer`), `Range` support (206) for video seeking, immutable caching except HTML. Like Forma, a miss outside `assets/` retries `assets/<rest>`.
- `/lib/gsap.js`, `/lib/lottie.js`, `/lib/three/…` are copied from `node_modules` into `public/lib` by `scripts/copy-player-libs.mjs` (runs before `dev` and `build`; gitignored). Versions are pinned to Forma's `package.json`, and a test fails if they drift.
- Locally, set `NEXT_PUBLIC_PLAYER_ORIGIN=http://play.localhost:3000`: browsers resolve `*.localhost` to your machine, so no hosts-file edit is needed.

## Test mode

`DASHBOARD_TEST_MODE=1` adds:
- a thin "Test mode" strip and the `/styleguide` route;
- the **brand switcher** in the top bar (⌘K): every client account with its questionnaire status, and every Forma brand no account links to;
- the **results gallery** for Forma brands (`/gallery/<brandId>`): every campaign shown as the client would see it — variants with previews as directions, the active variant's final in the final viewer (all formats in sync, or one format large).

- **"New brand"** in the switcher, and the **studio simulator** (bottom-right) on the questionnaire and campaign pages: approve or ask questions; accept a campaign; send three directions or the final from a Forma campaign (the server rebuilds the snapshot from Forma); **seed sample exports** from `fixtures/exports/` (tiny placeholder MP4/PNG per format, listed in `manifest.json`; add your own files there).

There is no sign-in; everything is visible.

## Keyboard

`?` shows every shortcut, the current page's first (also in the account menu). Review: `←/→`, `1–3`, `C` comment mode, `Esc` steps back. Final viewer: `Space`/`K`, `←/→` one frame, `Shift+←/→` and `J/L` one second, `Home`, `F` fullscreen.

## Checks

```bash
npm run typecheck && npx eslint . && npm test && npx next build
```

Tests cover the questionnaire logic, both state machines, brief validation, the snapshot builders, export naming and selection, the Forma constants (set `FORMA_DIR` if Forma isn't at `../../forma`), the player origin (fake R2) and a motion audit.

## Deploy (Vercel)

One Vercel project, root directory = this app, **two domains** on it: the app and the player. The player must be a different host from the app.

- With your own domain: `app.<domain>` and `play.<domain>`.
- On vercel.app only: add a second free domain to the same project (Settings → Domains), e.g. `concepts-client.vercel.app` (app) and `concepts-client-play.vercel.app` (player). vercel.app is a public suffix, so the two are separate sites, which isolates creatives even better.

Then:
1. Set `NEXT_PUBLIC_PLAYER_ORIGIN=https://<player domain>` for Production (and Preview), plus the variables above. Never the local `http://play.localhost:3000`: the browser would ask visitors to "access devices on your local network" and every preview fails (the app detects this and says so in the console).
2. **Redeploy**: `NEXT_PUBLIC_*` values are baked in at build time, so changing them needs a new build.
3. Check: `https://<player domain>/` answers 404 (it serves only `/p/*` and `/lib/*`).
4. Allow the app origin on the R2 bucket (uploads and the download ZIP): `node --env-file=.env scripts/r2-cors.mjs http://localhost:3000 https://<app domain>`.
