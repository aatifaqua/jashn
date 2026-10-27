# Jashn

**Plan a wedding, birthday or community event in one sitting: a realistic budget split, a dated
timeline, a vendor checklist, a day-of run sheet and personalised ideas, with an assistant that
answers questions and proposes changes you preview before applying.**

Live demo: **https://aatifaqua.github.io/jashn/** (demo mode, no server needed).

> Costs and dates are planning estimates for India, not vendor quotes. Check details with your
> vendors and local authorities.

_Jashn_ (जश्न) is Hindi and Urdu for "celebration".

---

## Chosen vertical

**Celebration & Event Planner.** The brief: _"a GenAI-powered planning assistant that helps users
organize weddings, birthdays, and community events with budgets, timelines, vendor checklists,
and personalized ideas."_

Jashn serves three people: a family organiser with a multi-function wedding (100 to 600 guests,
eight to twelve vendors), a parent planning a birthday a few weeks out, and a volunteer running a
festival mela or fundraiser where permits, safety and walk-in numbers matter. Each of them needs
the same answers: is my budget enough, what do I book first, what is already late, what do I ask
each vendor, what happens on the day, and fresh ideas that respect my diet, faith, access needs
and money.

## Requirement → feature → file

| Requirement                                   | Feature                                                                                                                                               | Where                                                                                                                                                                                                                                                    |
| :-------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weddings                                      | Five functions (haldi, mehndi, sangeet, ceremony, reception) on consecutive days, per-function budget slices, three styles                            | [profiles/wedding.ts](packages/core/src/profiles/wedding.ts), [wedding-tasks.ts](packages/core/src/profiles/wedding-tasks.ts), [wedding-vendors.ts](packages/core/src/profiles/wedding-vendors.ts), [context.ts](packages/core/src/context.ts)           |
| Birthdays                                     | Kids, milestone and adult styles, cake, return gifts and entertainer tasks, a party run sheet                                                         | [profiles/birthday.ts](packages/core/src/profiles/birthday.ts), [birthday-catalogue.ts](packages/core/src/profiles/birthday-catalogue.ts)                                                                                                                |
| Community events                              | Festival, fundraiser, meetup and clean-up drive; walk-in factors, volunteers, permits marked "check local rules", sanitation and safety               | [profiles/community.ts](packages/core/src/profiles/community.ts), [community-catalogue.ts](packages/core/src/profiles/community-catalogue.ts), [attendance.ts](packages/core/src/attendance.ts)                                                          |
| Budgets                                       | Weighted split rounded to ₹100 that sums exactly, feasibility verdict against a cost floor, ranked trims, SVG chart with a full table                 | [budget.ts](packages/core/src/budget.ts), [feasibility.ts](packages/core/src/feasibility.ts), [trims.ts](packages/core/src/trims.ts), [BudgetChart.svelte](web/src/components/BudgetChart.svelte), [TrimList.svelte](web/src/components/TrimList.svelte) |
| Timelines                                     | Back-scheduled tasks with dependencies, late and at-risk flags, phases, compression for short notice, `.ics` calendar export                          | [timeline.ts](packages/core/src/timeline.ts), [ics.ts](packages/core/src/ics.ts), [TaskList.svelte](web/src/components/TaskList.svelte), [calendar.ts](web/src/lib/calendar.ts)                                                                          |
| Vendor checklists                             | Vendors derived from type, functions and needs; book-by dates, deposits and balances, questions per vendor, status, enquiry drafts                    | [vendors.ts](packages/core/src/vendors.ts), [VendorCard.svelte](web/src/components/VendorCard.svelte), [routes/draft.ts](server/src/routes/draft.ts)                                                                                                     |
| Personalised ideas                            | Theme, palette, decor, menu that respects every declared diet, activities, a guest touch and invitation wording, in English or Hindi                  | [routes/ideas.ts](server/src/routes/ideas.ts), [fallback/ideas.ts](packages/core/src/fallback/ideas.ts), [IdeasPanel.svelte](web/src/components/IdeasPanel.svelte)                                                                                       |
| GenAI-powered assistant                       | Gemini writes ideas, vendor enquiries and answers from a compact plan summary; schema-constrained, re-validated and guarded                           | [ai/gemini.ts](server/src/ai/gemini.ts), [ai/prompts.ts](server/src/ai/prompts.ts), [ai/schemas.ts](server/src/ai/schemas.ts), [guards.ts](packages/core/src/guards.ts)                                                                                  |
| Smart, dynamic assistant                      | Answers questions and turns requests ("cut guests by 20", "make it indoor") into a validated change shown as a before/after preview                   | [routes/assist.ts](server/src/routes/assist.ts), [ai/tools.ts](server/src/ai/tools.ts), [Assistant.svelte](web/src/components/Assistant.svelte), [preview.ts](web/src/lib/preview.ts), [plan.ts](packages/core/src/plan.ts) (`diffPlans`)                |
| Logical decision making based on user context | Context (season, weekday, lead time, crowd size, setting) fires rules that change tasks, budget shares, vendors and the run sheet, each with a reason | [context.ts](packages/core/src/context.ts), [rules.ts](packages/core/src/rules.ts), [rules-needs.ts](packages/core/src/rules-needs.ts), [Why.svelte](web/src/components/Why.svelte)                                                                      |
| Practical real-world usability                | Works offline in the browser, saves up to ten plans, share link in the URL fragment, print stylesheet, calendar export, copyable checklist            | [plans.svelte.ts](web/src/lib/plans.svelte.ts), [storage.ts](web/src/lib/storage.ts), [share.ts](packages/core/src/share.ts), [ShareBar.svelte](web/src/components/ShareBar.svelte), [app.css](web/src/app.css)                                          |

## How the solution works

```
form ──normaliseInput──▶ EventInput ──buildPlan(today)──▶ Plan ──▶ tabs (in the browser)
                              │                              │
                              └──▶ POST /api/ideas | assist | draft   (input only)
                                       server: zod → validateInput → buildPlan → prompt
                                       → Gemini (schema-constrained) → zod → guards
                                       → { …, source: "gemini" | "fallback" }
```

1. **Describe the event** in three short fieldsets, or pick a sample (Lucknow wedding, 7th
   birthday, Diwali mela). A live summary shows days to go, expected guests and the budget
   verdict as you type.
2. **The plan is computed in the browser** by `@jashn/core`: no network, instant, and identical
   in demo and live mode. It opens on an overview with the verdict and the top three actions,
   each with a "Why?" disclosure.
3. **Tabs:** Budget (chart, table, trims), Timeline (phases, checkboxes, calendar export),
   Vendors (status, questions, payments, enquiry draft), Day of (run sheet) and Ideas.
4. **The assistant** sits beside every tab. A question gets an answer grounded in the plan; a
   change request gets a preview (guests 350 → 330, verdict tight → comfortable) and is applied
   only when you press Apply.
5. **Take it away:** print the plan, export tasks to a calendar, copy the checklist or copy a
   share link. Plans and progress stay in this browser.

## Approach and logic

**Deterministic core first, language model second.** Every number, date and recommendation comes
from pure, tested code that explains itself; Gemini adds only the words code cannot write well.
The engine runs in a fixed order: derive the context once, fire the rules once, then budget and
feasibility, timeline, vendors, payments, run sheet, top actions and notices
([plan.ts](packages/core/src/plan.ts)).

**Contextual rules** ([rules.ts](packages/core/src/rules.ts),
[rules-needs.ts](packages/core/src/rules-needs.ts)). Each rule names the input that fired it, and
the UI shows that reason next to the item it changed.

| Rule                      | When                                 | Effect                                                                                         |
| :------------------------ | :----------------------------------- | :--------------------------------------------------------------------------------------------- |
| peak-season               | wedding, Nov–Feb                     | venue, caterer and photographer lead times ×1.25; notice that prices run higher                |
| monsoon-outdoor           | Jun–Sep and outdoor or mixed         | rain cover or backup hall task; infrastructure share +4 points                                 |
| summer-outdoor            | Apr–Jun, outdoor, start before 17:00 | shade and water station task; hydration slot on the run sheet                                  |
| weekday                   | Mon–Thu                              | notice that venues are often cheaper on weekdays                                               |
| short-notice              | days to go below the type's minimum  | compressed timeline; top action "Lock the venue today"                                         |
| step-free                 | need declared                        | ramp, lift and accessible-toilet questions; seating task; accessibility helper at the entrance |
| jain / vegetarian / halal | need declared                        | caterer questions; dietary guard on every generated menu                                       |
| alcohol-free              | need declared                        | bar line and bartender removed; mocktail notice                                                |
| halal-no-bar              | halal declared (not alcohol-free)    | the same bar removal and notice, since alcohol is not halal                                    |
| kid-friendly              | need declared                        | kids' corner task; entertainment +2 points                                                     |
| eco-friendly              | need declared                        | e-invites (invitations −80 %, moved to decor); no single-use plastic; waste segregation        |
| budget-strict             | need declared                        | contingency 15 % instead of 10 %; trims shown even when comfortable                            |
| large-crowd               | ≥ 200 expected                       | first-aid station; ambulance on standby from 1,000                                             |
| public-gathering          | community, outdoor or ≥ 500          | police, municipal, loudspeaker and fire-safety permissions, marked "check local rules"         |
| venue-booked              | box ticked                           | venue task done; venue lead-time pressure removed                                              |

**Worked example: the Lucknow wedding sample** (planned on 27 Oct 2026 for Saturday 27 Feb 2027).

- 350 invited × 0.85 wedding turnout = **298 expected guests**.
- Budget ₹16,00,000 ÷ 298 = **₹5,369 per guest**. The tier-2 floor is ₹2,000 per guest × (1 +
  0.35 × 3 extra functions) = **₹4,100**. That is above the floor but below 1.5 × floor
  (₹6,150), so the verdict is **tight**, and the trims are ranked by saving: lunch instead of
  dinner (₹78,300), invite 305 instead of 350 (₹66,500), mehndi and sangeet on one day
  (₹60,800), a weekday date (₹25,000), e-invites (₹22,200).
- The split starts from the wedding weights (venue 18, catering 30, decor 10 …, out of 90 with 10
  held as contingency), adds the traditional style's decor +2, multiplies the two chosen
  priorities (catering, photography) by 1.25 and renormalises. Lines are rounded to ₹100 with the
  largest-remainder method, so catering ₹5,21,700 + … + contingency ₹1,60,000 equals ₹16,00,000
  exactly.
- February is peak season, so venue, caterer and photographer lead times stretch by 1.25. With
  123 days to go, five tasks are already late; they are spread one working day apart from today
  instead of all landing on one date, and the top actions become "Agree the budget and guest
  estimate", "Book the venue" and "Confirm the officiant and the muhurat".
- Step-free and vegetarian needs add venue access questions, an accessibility helper on the run
  sheet and vegetarian questions for the caterer; generated menus are checked for meat, fish and
  egg words in English, Hinglish and Devanagari.

## Where Gemini is used

| Feature                       | Endpoint      | What Gemini does                                                                                         | When it is unavailable                                                        |
| :---------------------------- | :------------ | :------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| Personalised ideas            | `/api/ideas`  | Theme, palette, decor, menu, activities, guest touch and invitation wording (English or Hindi)           | Catalogue ideas filtered by type, style, season and needs                     |
| Assistant answers and changes | `/api/assist` | Answers from the plan summary; turns a change request into an `update_event` function call (a PlanPatch) | Offline intent parser that answers from the same summary and proposes patches |
| Vendor enquiry drafts         | `/api/draft`  | A polite enquiry stating the event facts and asking that vendor's questions                              | Template enquiry with the same facts and questions                            |

**How it is kept honest.** Requests carry only the validated input; the server rebuilds the plan
itself. Prompts give compact JSON facts, fence the user's note as data, and state the rules:
respect faith, diet and access needs, never invent prices or dates. Output is constrained by a
JSON schema, parsed again with zod, then checked by deterministic guards
([guards.ts](packages/core/src/guards.ts), [date-mentions.ts](packages/core/src/date-mentions.ts)):
no dietary conflicts, no links, length caps, and no rupee figure or calendar date the plan does
not contain. A proposed change must pass the same validation as the form, and the user confirms
it.

**How it degrades.** Models are tried newest flash first, with a per-call timeout and a
whole-chain deadline, moving on only after a 429 or 5xx. Any failure (no key, timeout, quota,
schema or guard) serves the deterministic fallback instead of an error, and every result carries
`source: "gemini" | "fallback"`, which the UI labels. The GitHub Pages demo has no server: it
serves the Gemini output pre-generated so far
([demo-genai.json](web/src/lib/demo-genai.json), written by
[pregenerate.ts](server/scripts/pregenerate.ts); today ideas for the Lucknow wedding in English)
and the labelled offline fallbacks for everything else. Because
the sample dates move with today, the same guards drop any pre-generated draft or answer whose
dates no longer match the plan, and ideas never state a date.

## Assumptions

- Users are in India; budgets are whole rupees and city tiers (metro, tier-2, town) capture the
  main cost difference.
- Cost floors, budget weights, turnout and lead times are editorial planning estimates kept in
  one place per event type ([profiles/](packages/core/src/profiles)), labelled as estimates in
  the UI, the API and the prompts.
- Dates are calendar dates with no time zone. "Today" is the date in India in both the browser
  and the server, so they agree on what is late or in the past. The run sheet uses local
  wall-clock times.
- One event per plan, up to ten plans per browser. No accounts, bookings, payments or guest
  lists; drafts are copied and sent by the user.
- Permit needs vary by city, so Jashn lists them as "check local rules", not legal advice.

## Run locally

Requires Node 22.18 or newer (see `.nvmrc`).

```bash
npm ci
cp .env.example server/.env      # add GEMINI_API_KEY, or leave it empty for fallback mode
npm run dev -w server            # API on http://localhost:8787
npm run dev -w web               # web on http://localhost:5173, demo mode
```

For the live path in development, set `CORS_ORIGINS=http://localhost:5173` in `server/.env` and
start the web app with `VITE_API_BASE=http://localhost:8787 npm run dev -w web`.

| Command                         | What it does                                                                        |
| :------------------------------ | :---------------------------------------------------------------------------------- |
| `npm run verify`                | Format check, lint (0 warnings), typecheck, tests with coverage, build, size budget |
| `npm test`                      | Tests with coverage thresholds in every workspace                                   |
| `npm run pregenerate -w server` | Regenerates the demo content with Gemini (needs a key)                              |
| `docker build -t jashn .`       | One image serving the API and the built app from one origin                         |

**Web modes.** With `VITE_API_BASE` set (an absolute URL, or `/` when the server hosts the app)
the web app calls the API. Without it the build runs in **demo mode**, as on GitHub Pages: the
plan is computed in the browser exactly as in live mode, and the generative features come from
the pre-generated sample content or the offline fallbacks, labelled as such.

**Server environment** (all optional, validated at start-up): `GEMINI_API_KEY`, `PORT` (8787),
`CORS_ORIGINS`, `TRUST_PROXY`, `GEMINI_MODELS`, `RATE_LIMIT_MAX` (20), `RATE_LIMIT_WINDOW_MS`
(60000), `GEMINI_HOURLY_BUDGET` (600), `GEMINI_CLIENT_HOURLY` (30), `STATIC_DIR` (read from the
repository root and checked at start-up). See [.env.example](.env.example).

## Architecture

```
jashn/
├── packages/core/   @jashn/core: pure TypeScript, no runtime dependencies, no I/O
│                    input validation, context and rules, budget, timeline, vendors, run sheet,
│                    plan assembly and diff, guards, .ics and share links, offline fallbacks
├── server/          Hono on Node, stateless: config, middleware (security, rate limit, quota,
│                    errors, logger), routes (health, ideas, assist, draft), ai/ (Gemini chain,
│                    prompts, schemas, tools), response cache, optional static hosting
└── web/             Svelte 5 + Vite, one hand-written CSS file: intake, lazy plan view,
                     components per tab, assistant, storage, genai client (live or demo)
```

The core is shared by the server and the browser, so the plan a user sees and the plan the
server prompts with are the same computation. Profiles are dynamic imports, so the browser loads
only the chosen event type's tables. The full design is in [docs/DESIGN.md](docs/DESIGN.md) and
the main decisions in [docs/decisions.md](docs/decisions.md).

## Quality notes

| Focus area    | What we did                                                                                                                                                                                                                                                                                        | Where                                                                                                                                                                                                                                     |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code quality  | Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), typescript-eslint strict type-checked with budgets (complexity 10, 60 lines per function, 250 per file, depth 3, 4 params), Prettier, JSDoc on every export, one shared core for all planning logic                  | [tsconfig.base.json](tsconfig.base.json), [eslint.config.js](eslint.config.js), [packages/core/src/index.ts](packages/core/src/index.ts)                                                                                                  |
| Security      | Strict zod schemas then the core validator, JSON only, 16 KB body limit, generic errors with a request id, secure headers and API CSP, CORS allow-list, SPA CSP without `unsafe-inline`, rate limit and hourly Gemini budget, fenced note, guarded output, key only on the server                  | [SECURITY.md](SECURITY.md), [middleware/security.ts](server/src/middleware/security.ts), [middleware/rateLimit.ts](server/src/middleware/rateLimit.ts), [routes/common.ts](server/src/routes/common.ts), [web/index.html](web/index.html) |
| Efficiency    | Plan computed in the browser; integer day numbers; memoised `buildPlan`; per-type profile chunks, lazy plan view, calendar export and demo content; no UI, chart or date library; first-screen gzip budget in CI; server cache with in-flight coalescing, `compress()`, immutable hashed assets    | [plan.ts](packages/core/src/plan.ts), [days.ts](packages/core/src/days.ts), [cache.ts](server/src/cache.ts), [static.ts](server/src/static.ts), [scripts/size-budget.mjs](scripts/size-budget.mjs)                                        |
| Testing       | Vitest in every workspace with coverage thresholds (core 100 %); fast-check property tests for budget, timeline, patches, share links and `.ics`; scenario tests pinning the samples; every route with Gemini mocked; every component with an axe check                                            | [plan.property.test.ts](packages/core/src/plan.property.test.ts), [samples.test.ts](packages/core/src/samples.test.ts), [app.test.ts](server/src/app.test.ts), [Assistant.test.ts](web/src/components/Assistant.test.ts)                  |
| Accessibility | Skip link and landmarks, fieldsets and legends, inline errors plus a focusable error summary, ARIA tabs with roving tabindex, live regions, status as icon plus word, SVG chart with a table, documented AA contrast in both themes, forced colours, reduced motion, Hindi text marked `lang="hi"` | [App.svelte](web/src/App.svelte), [Intake.svelte](web/src/views/Intake.svelte), [PlanView.svelte](web/src/views/PlanView.svelte), [app.css](web/src/app.css), [tabs.ts](web/src/lib/tabs.ts)                                              |

## License

[MIT](LICENSE)
