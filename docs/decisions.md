# Decision records

Short records of the choices that shape Jashn. Each states the context, the decision and what it
costs. The full design is in [DESIGN.md](DESIGN.md).

## 1. The plan is computed in the browser by a shared core

**Context.** Budgets, dates and vendor deadlines must be correct, explainable and instant, and
the GitHub Pages deployment has no server.
**Decision.** All planning logic lives in `@jashn/core`, a pure TypeScript package with no
runtime dependencies and no I/O. The browser computes the plan; the server imports the same core
and rebuilds the plan from validated input before prompting.
**Consequences.** The plan works offline and is identical in demo and live mode. The server
never trusts a plan sent by a client. The core must stay small and tree-shakeable
(`sideEffects: false`, per-type profile chunks).

## 2. Gemini writes words, never numbers or dates

**Context.** A language model can invent a price or a deadline that looks authoritative.
**Decision.** Every figure and date comes from the engine. Gemini gets compact JSON facts and
writes ideas, enquiries and answers; its output is schema-constrained, parsed again with zod and
checked by deterministic guards that reject any rupee figure or calendar date the plan does not
state. Ideas carry no dates at all: invitation wording leaves `[date]` as a placeholder.
**Consequences.** A false positive costs a fallback, never a wrong number on screen. Some good
model output is discarded; that is the intended trade.

## 3. Every generative feature has a deterministic fallback

**Context.** Keys can be missing, models overloaded and quotas spent.
**Decision.** Ideas, the assistant and drafts each have an offline implementation in the core.
Any failure (timeout, 429 or 5xx after the chain, schema or guard rejection, spent budget)
serves the fallback with `source: "fallback"`, and the UI labels every result's source.
**Consequences.** The API never returns an error for a generation problem. The offline
assistant answers from the same plan summary Gemini sees, so both stay consistent.

## 4. Changes are proposed as a validated patch and applied by the user

**Context.** "Cut guests by 20" should change the plan, but a model must not edit state.
**Decision.** Gemini receives one function declaration, `update_event`, whose parameters mirror
`PlanPatch` (a compile-time check keeps them in sync). The server validates the call with
`validatePatch`; the browser shows a `diffPlans` preview and applies it only on confirmation.
**Consequences.** The assistant can never make a change the form would reject, and the user
always sees the effect first.

## 5. Model chain: retry only on 429 and 5xx

**Context.** Newer flash models are sometimes overloaded; users are waiting.
**Decision.** Models are tried newest first with a per-call timeout and a whole-chain deadline.
Only a 429 or a 5xx moves on to the next model; a timeout or a 4xx ends the chain, because a
retry would not help within the user's patience.
**Consequences.** Worst-case latency is bounded. A slow model is not retried on an older one.

## 6. Dates are integer day numbers

**Context.** Back-scheduling with `Date` objects invites time-zone and daylight-saving bugs.
**Decision.** The core represents dates as days since 1970-01-01 and converts with civil-calendar
arithmetic. "Today" is the date in India (`indiaDay`, a fixed UTC+05:30 offset) in both the
browser and the server, whatever zone the user or the host is in.
**Consequences.** Scheduling is integer arithmetic, fast and testable; formatting happens only at
the edges.

## 7. Demo content is pre-generated and re-checked on every read

**Context.** The Pages demo should show real Gemini output without exposing a key, but sample
dates move with today.
**Decision.** `npm run pregenerate -w server` makes one Gemini request per sample for its
ideas, drafts and answers, checks every item with the live routes' own schemas and guards, and
writes `demo-genai.json`. The web app serves an entry only when the input
matches a sample exactly and the entry passes the same guards as live output against today's
plan.
**Consequences.** Ideas hold no dates, but a rerun keeps them only while the sample's season is
unchanged and they still pass the schema and diet guard; drafts and answers whose dates have
drifted fall back to the offline versions until the file is regenerated. A run cut short by a
quota leaves gaps that the offline content fills: the shipped file currently holds ideas for
the Lucknow wedding only.

## 8. Stateless server, browser-only persistence

**Context.** No accounts are needed to plan an event, and stored personal data is a liability.
**Decision.** The server keeps nothing but a short-lived response cache. Plans live in the
browser's `localStorage` under a versioned key, read back through validation; share links carry
the input in the URL fragment, which is never sent to a server.
**Consequences.** Nothing to breach across users and no data-retention policy to run. Plans do
not follow a user across devices except through a share link.

## 9. No UI, chart, date or icon libraries

**Context.** The first screen should load fast on a mid-range phone.
**Decision.** Svelte 5 with one hand-written CSS file, SVG bars for the chart (with a table
equivalent), `Intl` for formatting and an inline SVG sprite for icons. A CI check fails the
build when the first screen's gzip size passes its budget.
**Consequences.** More hand-written code in the web package, all of it covered by tests and the
lint budgets.

## 10. One container serves the API and the app

**Context.** A separate origin for the API needs CORS and a second deployment.
**Decision.** With `STATIC_DIR` set, the server hosts the built app from the same origin, sends
the SPA CSP as a header with framing denied, caches hashed assets as immutable and falls back to
`index.html` for page paths. The web build uses `VITE_API_BASE=/` for same-origin calls.
**Consequences.** One image, one origin, no CORS in production. GitHub Pages remains the
demo-mode deployment.
