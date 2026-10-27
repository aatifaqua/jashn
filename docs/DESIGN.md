# Jashn — Design

Jashn ("celebration") is a planning assistant for weddings, birthdays and
community events. The user describes the event once; Jashn returns a budget split with a
feasibility verdict, a dated timeline worked backwards from the event day, a vendor checklist
with book-by dates and deposits, a day-of run sheet, and personalised ideas. A conversational
assistant answers questions about the plan and proposes changes to it ("cut to 180 guests",
"move it to a weekday"), which the user previews and applies.

Every number, date and recommendation comes from deterministic, tested code that explains
why it was made. Gemini adds what code cannot: themes, menus, activities, invitation wording,
vendor enquiry drafts, and natural-language understanding of the user's requests. Gemini
never produces a number or a date.

---

## 1. Problem, vertical, personas

**Vertical:** Celebration & Event Planner — "a GenAI-powered planning assistant that helps
users organize weddings, birthdays, and community events with budgets, timelines, vendor
checklists, and personalized ideas."

**Personas**

| Persona          | Event                                                                          | Scale                                             | What hurts today                                                                          |
| :--------------- | :----------------------------------------------------------------------------- | :------------------------------------------------ | :---------------------------------------------------------------------------------------- |
| Family organiser | Wedding, often several functions (haldi, mehndi, sangeet, ceremony, reception) | 100–600 guests, months of lead time, 8–12 vendors | No idea if the budget is realistic; venues and photographers book out; payments scattered |
| Parent or friend | Birthday (kids, milestone, adult)                                              | 10–80 guests, 1–6 weeks                           | Last-minute scramble; forgets return gifts, cake order, entertainer                       |
| Volunteer        | Community event (festival mela, fundraiser, meetup, clean-up drive)            | 50–2,000 open attendance                          | Permits, safety, volunteers, sanitation, sponsors; walk-in numbers unknown                |

**What every persona needs:** is my budget enough, what do I book first, what is already
late, what do I ask each vendor, what happens on the day, and fresh ideas that respect my
constraints (diet, faith, accessibility, money).

---

## 2. User journey

1. **Start.** Landing shows a one-line promise, three sample chips (Lucknow wedding,
   7th birthday, Diwali mela), "My plans" (saved in this browser), and the form.
2. **Describe the event** in three short fieldsets (section 5). A live summary beside the
   form shows days to go, expected headcount and the budget verdict as the user types.
3. **Plan view** (lazy-loaded) opens on **Overview**: verdict banner, days to go, headcount,
   top three actions ("Book the venue — 12 days late"), each with a "Why?" disclosure.
4. Tabs: **Budget** (chart + table, trims), **Timeline** (phases, checkboxes, late and
   at-risk flags, calendar export), **Vendors** (status per vendor, questions, payment
   schedule, "Draft enquiry"), **Day of** (run sheet), **Ideas** (generated).
5. **Assistant** panel on every tab: ask a question or request a change. A proposed change
   shows a before/after preview (guests 250 → 180, verdict tight → comfortable) and is
   applied only when the user confirms.
6. **Take it away:** print the plan, export the timeline to a calendar (.ics), copy the
   checklist, or copy a share link (the event description travels in the URL fragment,
   never to a server).

---

## 3. Architecture

Deterministic core first, language model second. The plan is always computed **in the
browser** by the core (instant, works offline, no round trip). The server exists only for
the generative features and re-derives the plan from validated input; it never trusts a
plan sent by the client.

```
jashn/
├── packages/core/            @jashn/core — pure TypeScript, zero runtime deps, no I/O,
│   └── src/                  "sideEffects": false
│       ├── types.ts          domain types (section 4)
│       ├── days.ts           calendar dates as integer day numbers; parse/format helpers
│       ├── input.ts          normaliseInput / validateInput / applyPatch / validatePatch
│       ├── profiles/         one module per event type, loaded on demand
│       │   ├── wedding.ts    budget weights, styles, functions, tasks, vendors, run sheet
│       │   ├── birthday.ts
│       │   └── community.ts
│       ├── context.ts        derives EventContext (season, weekday, lead time, tier, flags)
│       ├── rules.ts          contextual rules table -> adjustments with reasons
│       ├── budget.ts         allocation and rounding
│       ├── feasibility.ts    cost floor and verdict
│       ├── trims.ts          ranked savings
│       ├── attendance.ts     invited -> expected headcount; volunteers; safety thresholds
│       ├── timeline.ts       back-scheduling, compression, phases
│       ├── vendors.ts        vendor checklist, questions, payment schedule
│       ├── runsheet.ts       day-of schedule (per day for multi-function weddings)
│       ├── plan.ts           buildPlan(input, today, profile) -> Plan; diffPlans(a, b)
│       ├── summary.ts        the plan facts generated text may use
│       ├── samples.ts        the three sample events, dated from today
│       ├── fallback/         deterministic stand-ins for every generative feature
│       │   ├── ideas.ts      idea catalogue filtered by type, style, constraints
│       │   ├── draft.ts      vendor enquiry template
│       │   └── assistant.ts  offline intent parser -> reply + optional PlanPatch
│       ├── guards.ts         post-generation checks (dietary conflicts, length, links, amounts)
│       ├── date-mentions.ts  dates written in generated text, checked against the plan
│       ├── ics.ts            timeline -> RFC 5545 calendar text
│       └── share.ts          input <-> compact URL-fragment encoding
├── server/                   Hono on Node, stateless
│   └── src/
│       ├── config.ts         zod-validated environment
│       ├── app.ts            createApp(deps): middleware + routes (no listen)
│       ├── static.ts         optional static hosting of web/dist, mounted by app.ts
│       ├── index.ts          listen
│       ├── middleware/       security.ts, rateLimit.ts, quota.ts, errors.ts, logger.ts
│       ├── routes/           health.ts, ideas.ts, assist.ts, draft.ts
│       ├── ai/               gemini.ts (client, model chain, timeouts), prompts.ts,
│       │                     schemas.ts (zod + response schemas), tools.ts (function decl.)
│       └── cache.ts          LRU + TTL cache with in-flight request coalescing
└── web/                      Svelte 5 + Vite, one hand-written CSS file
    └── src/
        ├── App.svelte        shell: skip link, header, main, footer, view switch
        ├── lib/              plans.svelte.ts (state + persistence), storage.ts,
        │                     genai.ts (live or demo), demo-genai.json, format.ts
        ├── views/            Intake.svelte, PlanView.svelte (lazy)
        └── components/       one component per tab + Assistant, VerdictBanner, BudgetChart,
                              TaskList, VendorCard, RunSheet, IdeasPanel, ThemeToggle, ...
```

**Data flow**

```
form ──normaliseInput──▶ EventInput ──buildPlan(today)──▶ Plan ──▶ tabs
                              │                              │
                              └──▶ POST /api/ideas|assist|draft (input only)
                                       server: validateInput → buildPlan → prompt
                                       → Gemini (schema-constrained) → zod → guards
                                       → { …, source: "gemini" | "fallback" }
```

---

## 4. Domain model (core types, abridged)

```ts
type EventType = 'wedding' | 'birthday' | 'community';
type CityTier = 'metro' | 'tier2' | 'town';
type Setting = 'indoor' | 'outdoor' | 'mixed';
type Constraint =
  | 'vegetarian'
  | 'jain'
  | 'halal'
  | 'alcohol-free'
  | 'kid-friendly'
  | 'step-free'
  | 'eco-friendly'
  | 'budget-strict';

interface EventInput {
  type: EventType;
  style: string; // style ids come from the type's profile
  functions: readonly string[]; // wedding only; [] otherwise
  date: string;
  startTime: string; // ISO date, HH:MM (local)
  city: string;
  tier: CityTier;
  setting: Setting;
  venueBooked: boolean;
  invited: number;
  budget: number; // whole rupees
  priorities: readonly string[]; // ≤ 2 budget category ids
  constraints: readonly Constraint[];
  note: string; // ≤ 300 chars, free text
}

interface Reason {
  code: string;
  text: string;
} // every derived item explains itself
interface BudgetLine {
  category: string;
  amount: number;
  share: number;
  reasons: Reason[];
}
interface Feasibility {
  verdict: 'comfortable' | 'tight' | 'unrealistic';
  perGuest: number;
  floor: number;
  trims: Trim[];
}
interface Trim {
  id: string;
  label: string;
  saves: number;
  reasons: Reason[];
}
interface Task {
  id: string;
  title: string;
  due: number;
  idealDue: number;
  phase: Phase;
  status: 'upcoming' | 'late' | 'at-risk' | 'done';
  vendorId?: string;
  reasons: Reason[];
}
interface VendorItem {
  id: string;
  label: string;
  category: string;
  bookBy: number;
  depositShare: number;
  questions: string[];
  reasons: Reason[];
}
interface Payment {
  vendorId: string;
  kind: 'deposit' | 'balance';
  due: number;
  amount: number;
}
interface RunSheetSlot {
  day: number;
  start: string;
  end: string;
  title: string;
  owner: string;
}
interface Plan {
  input: EventInput;
  today: number;
  daysToGo: number;
  expected: number;
  budget: BudgetLine[];
  contingency: number;
  feasibility: Feasibility;
  tasks: Task[];
  vendors: VendorItem[];
  payments: Payment[];
  runSheet: RunSheetSlot[];
  topActions: Task[];
  notices: Reason[];
}
type PlanPatch = Partial<
  Pick<
    EventInput,
    | 'date'
    | 'startTime'
    | 'invited'
    | 'budget'
    | 'priorities'
    | 'constraints'
    | 'setting'
    | 'tier'
    | 'functions'
    | 'style'
  >
>;
```

Dates inside the core are integer day numbers (days since 1970-01-01, calendar dates with no
time zone). This makes back-scheduling plain integer arithmetic, avoids `Date` allocation in
loops, and removes daylight-saving and time-zone bugs.

---

## 5. Input and validation

| Field       | Control              | Rule                                                                                                                                                       |
| :---------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type        | radio cards          | one of three                                                                                                                                               |
| style       | radio                | from the type's profile (wedding: traditional, intimate, destination; birthday: kids, milestone, adult; community: festival, fundraiser, meetup, clean-up) |
| functions   | checkboxes (wedding) | subset of haldi, mehndi, sangeet, ceremony, reception; ceremony always on                                                                                  |
| date        | date input           | today … today + 3 years; past dates rejected                                                                                                               |
| startTime   | time input           | default from style (wedding 18:00, kids birthday 16:00, festival 10:00)                                                                                    |
| city        | text                 | ≤ 60 chars, letters/spaces/.-' only; used only to personalise ideas                                                                                        |
| tier        | select               | metro / tier-2 city / town or village                                                                                                                      |
| setting     | radio                | indoor / outdoor / mixed                                                                                                                                   |
| venueBooked | checkbox             | —                                                                                                                                                          |
| invited     | number               | 1 … 5,000                                                                                                                                                  |
| budget      | number (₹)           | 1,000 … 100,000,000                                                                                                                                        |
| priorities  | checkboxes           | ≤ 2, from the type's categories                                                                                                                            |
| constraints | checkboxes           | any of the eight                                                                                                                                           |
| note        | textarea             | ≤ 300 chars; hint asks not to include personal details                                                                                                     |

`normaliseInput` trims, collapses whitespace, strips control and zero-width characters,
de-duplicates arrays and clamps nothing silently: `validateInput` returns typed field errors
that the form shows inline and in an error summary. The server runs the same function after
a strict zod schema (unknown keys rejected). Stored and shared plans are untrusted input and
pass through the same validation when read.

---

## 6. Decision engine

All tables live in the profile modules as frozen, named, documented constants. Figures are
editorial planning estimates for India, labelled as such in the UI, never presented as quotes.

### 6.1 Context (`context.ts`)

`deriveContext(input, today, profile)` computes once: `daysToGo`, weekday/weekend, season
(peak wedding season Nov–Feb, monsoon Jun–Sep, summer Apr–Jun), multi-day span (wedding
functions), and boolean flags (`outdoor`, `largeCrowd` ≥ 200 expected, `publicGathering`
community ≥ 500 or outdoor, `shortNotice` below the type's minimum lead time).

### 6.2 Contextual rules (`rules.ts`)

A table of `{ id, when(ctx, input), effects }`. Effects add tasks, vendor questions, budget
line adjustments, run-sheet slots or notices, each carrying a `Reason` that names the input
that triggered it. Initial set:

| Rule                      | When                                 | Effect (with reason shown to the user)                                                                      |
| :------------------------ | :----------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| peak-season               | wedding, date in Nov–Feb             | venue/caterer/photographer lead times ×1.25; notice that prices run higher                                  |
| monsoon-outdoor           | Jun–Sep and outdoor/mixed            | "Book rain cover or a backup hall" task; infrastructure share +4 pts                                        |
| summer-outdoor            | Apr–Jun, outdoor, start before 17:00 | shade + water station task; run-sheet hydration slot                                                        |
| weekday                   | Mon–Thu                              | notice: venues often cheaper on weekdays (no extra spend)                                                   |
| short-notice              | daysToGo below type minimum          | compression mode (6.5); top action "Lock the venue today"                                                   |
| step-free                 | constraint                           | venue questions (ramp, lift, accessible toilet), seating task, run-sheet "accessibility helper at entrance" |
| jain / vegetarian / halal | constraint                           | caterer questions (no root vegetables / no meat or egg / halal certification); idea guard on menus          |
| alcohol-free              | constraint                           | removes bar line and bartender vendor; notice for mocktail counter                                          |
| halal-no-bar              | halal, without alcohol-free          | the same bar removal and notice, with its own reason (alcohol is not halal)                                 |
| kid-friendly              | constraint                           | kids' corner task; entertainment line +2 pts                                                                |
| eco-friendly              | constraint                           | e-invites (invitations share −80 %, moved to decor), no single-use plastic question, waste-segregation task |
| budget-strict             | constraint                           | contingency 15 % instead of 10 %; trims shown even when comfortable                                         |
| large-crowd               | ≥ 200 expected                       | first-aid station; at ≥ 1,000 ambulance on standby                                                          |
| public-gathering          | community, outdoor or ≥ 500          | permission tasks (local police, municipal, loudspeaker, fire safety for tents), marked "check local rules"  |
| venue-booked              | checkbox                             | venue task completed; venue lead-time pressure removed                                                      |

### 6.3 Attendance (`attendance.ts`)

Expected headcount = invited × turnout (wedding 0.85, birthday 0.90, community 1.0 plus a
walk-in factor by style: festival 1.5, meetup 1.1, fundraiser 1.2, clean-up 1.0), rounded up.
Catering and per-guest figures use expected headcount. Community volunteers =
max(4, ⌈expected / 50⌉).

### 6.4 Budget (`budget.ts`)

1. Start from the type's base weights (sum 90; 10 held as contingency, 15 if budget-strict).
   - Wedding: venue 18, catering 30, decor 10, photography 8, attire & beauty 10,
     entertainment 5, invitations 2, gifts & favours 3, travel & stay 4.
   - Birthday: venue 20, food & cake 35, decor 12, entertainment 13, photography 5,
     invitations 1, return gifts 4.
   - Community: venue & permits 12, food & refreshments 22, infrastructure (tent, stage,
     sound, light) 22, programme 10, publicity 6, safety & first aid 8, sanitation & waste 6,
     volunteer kit 4.
2. Apply style deltas (e.g. destination wedding: travel & stay +8; intimate: catering +4,
   decor −2; kids birthday: entertainment +5, return gifts +2; fundraiser: publicity +4).
3. Apply rule deltas (6.2), then priorities: each chosen category ×1.25.
4. Renormalise to the non-contingency share in the same pass; round to ₹100 with the
   largest-remainder method so the lines plus contingency equal the budget exactly.
5. Multi-function weddings additionally split catering and decor across functions by a
   per-function guest share (haldi 0.4, mehndi 0.6, sangeet 0.8, ceremony 1.0, reception 1.0).

**Feasibility.** perGuest = budget / expected. Floor (₹ per expected guest, modest version):
wedding 3,000 / 2,000 / 1,200 (metro / tier-2 / town), ×(1 + 0.35 × (functions − 1));
birthday 800 / 500 / 300; community 150 / 100 / 60. Verdict: ≥ 1.5 × floor comfortable,
≥ floor tight, otherwise unrealistic.

**Trims** (computed when tight or unrealistic, or always when budget-strict), each with the
amount saved, ranked by saving: invite fewer guests (the largest invited count that reaches
the floor), weekday date (venue −10 %), lunch instead of dinner (catering −15 %), merge two
pre-ceremony functions (haldi, mehndi, sangeet; never the reception), e-invites (invitations
−80 %), sponsorship target equal to the shortfall (community). The weekday trim is not offered
once the venue is booked. Trims never apply themselves; the assistant or the user does.

### 6.5 Timeline (`timeline.ts`)

Each profile task has `{ id, title, leadDays, after?, vendorId?, appliesWhen? }`.
`idealDue = eventDay − leadDays × seasonFactor`. Then one pass in dependency order:

- `due = max(idealDue, today, due(after) + 1)`.
- `status = at-risk` when the earliest workable day is after `eventDay − minLead` (the latest
  day the task can still realistically happen); otherwise `late` when `idealDue < today`;
  otherwise `upcoming`. A late task that cannot fit is at-risk and carries both reasons.
- Late tasks are spread from today one working day apart in priority order, so "do now"
  never shows twelve tasks on one day; one spread past its last workable day is flagged
  at-risk rather than sitting quietly on the event day.
- Phases by days before the event: Do now (late), Months out (≥ 60), Weeks out (14–59),
  Final fortnight (1–13), Day of (0), After (thank-yous, settle balances, return rentals).
- Nothing is dropped: an impossible task stays visible as at-risk with its reason.

`topActions` = the first three of: late tasks, then at-risk, then the next upcoming. The web app
drops tasks the user has ticked and moves the next ones up (`remainingActions`).

### 6.6 Vendors and payments (`vendors.ts`)

Vendor list derives from type, style, functions and constraints (e.g. mehndi artist only with
a mehndi function; bartender never with alcohol-free). Each vendor: book-by date (its timeline
task), typical deposit share (venue 30 %, caterer 25 %, photographer 30 %, decorator 30 %,
others 20 %), base questions plus constraint questions. Payments: deposit on the book-by date,
balance seven days before the event. A vendor's amount is its share of the matching budget
line: a line that also buys goods pays a vendor only its `lineShare` (make-up artist 35 % and
mehndi artist 15 % of attire, officiant 30 % of gifts, baker 15 % of food), and vendors without
one split the rest evenly. A booked vendor's deposit counts as paid, so only the balance after
it is listed. Status per vendor (to contact → quoted → booked → paid) is user state, stored in
the browser; a paid vendor's payments show as settled.

### 6.7 Run sheet (`runsheet.ts`)

Templates per style as `{ offsetMin, durationMin, title, owner }`, anchored to `startTime`.
Multi-function weddings get one block per function on consecutive days ending with the
ceremony, each anchored to its function's customary hour (haldi 11:00, mehndi 16:00, sangeet
18:00, reception 19:30) rather than the ceremony's start time. The reception follows the next
day, or the same evening for an intimate wedding that starts by 15:00. Community events add set-up three
hours before, volunteer briefing, opening, programme, close and clean-up. Rules add slots
(accessibility helper, hydration, rain check).

### 6.8 Plan assembly and diff (`plan.ts`)

`buildPlan(input, today, profile)` derives context once and runs the stages in a fixed order, each a
single pass over its catalogue. `diffPlans(before, after)` returns the user-facing changes
(headcount, verdict, per-line amounts, newly late tasks) used by the assistant preview.
The profile is passed in so the browser loads only the chosen type's tables; plans are
memoised on the canonical input key. `planSummary(plan)` is the compact view the assistant
reasons over, both in Gemini prompts and in the offline fallback.

---

## 7. Generative layer (Gemini)

Three endpoints, all POST, all stateless, all with a deterministic fallback from
`core/fallback`. Every response carries `source: "gemini" | "fallback"` and the UI labels it.

| Endpoint      | Purpose                               | Input                                             | Output (validated)                                                                                                                         |
| :------------ | :------------------------------------ | :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/ideas`  | Personalised ideas                    | `EventInput`                                      | theme (name, palette words, why), 3 decor ideas, 3–5 menu items respecting diet, 3 activities, one guest-experience touch, invitation text |
| `/api/assist` | Assistant: answer or propose a change | `EventInput`, message ≤ 500 chars, last ≤ 6 turns | `{ reply, patch? }`                                                                                                                        |
| `/api/draft`  | Vendor enquiry message                | `EventInput`, vendor id                           | short message listing event facts and that vendor's questions                                                                              |

**Assistant tool use.** Gemini receives one function declaration, `update_event(patch)`,
whose parameters mirror `PlanPatch`. When the user asks for a change, Gemini returns a
function call; the server validates it with `validatePatch`, rebuilds the plan, and returns
the patch with a short reply. The browser shows the `diffPlans` preview and applies the patch
only on confirmation. Questions are answered from a compact plan summary in the prompt; the
reply must not introduce figures absent from it (enforced by instruction and by a guard that
rejects replies containing currency amounts not present in the plan, falling back).

**Prompting.** System instruction states the role, the cultural-sensitivity rule (respect
the user's faith, diet and budget; no stereotypes), the "never invent prices or dates" rule,
and that the user note is data, not instructions. The user content is compact JSON of the
validated input and plan summary; the note is sanitised, length-capped and fenced. Output
uses `responseMimeType: application/json` with a response schema, then zod, then `guards.ts`
(dietary conflicts such as meat words under vegetarian/Jain, Jain root vegetables, alcohol
under alcohol-free; no URLs; length caps; no rupee figure or calendar date the plan does not
state). Ideas carry no dates at all: invitation wording leaves `[date]`, `[venue]` and `[names]`
as placeholders, so stored or pre-generated ideas never go stale. Any failure → fallback.

**Model use.** Model chain (newest flash → older flash), per-call timeout and a whole-chain
deadline, retry only on 429/5xx status codes, explicit safety settings, `maxOutputTokens`
per endpoint, low thinking budget, temperature 0.8 for ideas and 0.3 for the assistant.
Fallback results are never cached.

**Caching.** Ideas and drafts are pure functions of the validated input, so the server keeps
an LRU + TTL cache (256 entries, 1 h) keyed by a SHA-256 of the canonical input JSON, with
in-flight coalescing so concurrent identical requests share one Gemini call. Assistant turns
are not cached.

**Quota protection.** Per-client rate limit on the three routes plus a global hourly Gemini
call budget; past it, requests get the fallback with `source: "fallback"` instead of an error.

---

## 8. Web app

- **State.** `plans.svelte.ts` holds the current input, derived plan (`$derived`, recomputed
  only when the normalised input changes) and per-plan user state (task checks, vendor
  statuses, applied idea set). Up to 10 saved plans in `localStorage` under a versioned key,
  written debounced, read through validation (invalid entries dropped, never trusted).
  "Delete this plan" and "Clear all my data" controls.
- **Live summary.** The form recomputes the summary on input with a short debounce.
- **Tabs** load nothing extra; the Plan view itself is a lazy chunk; profile data for the
  chosen event type is a dynamic import; calendar export loads on first click.
- **Charts** are hand-written SVG bars with a data table equivalent; no chart library.
- **Exports.** Print stylesheet for the whole plan; `.ics` with all-day tasks and the event
  (RFC 5545 escaping and line folding, stable UIDs); plain-text checklist to clipboard;
  share link with the input encoded in the URL fragment (validated on open).
- **Demo mode.** Without `VITE_API_BASE`, `genai.ts` serves the pre-generated Gemini output
  in `demo-genai.json` and the core fallbacks for anything else, with
  a visible "demo mode" note. The plan itself is identical in both modes because it is always
  computed in the browser. The GitHub Pages deployment is demo mode; the live Gemini path
  runs with the server. Sample dates move with today, so every demo entry passes the same
  guards as live output against today's plan; a draft or answer whose dates have drifted falls
  back. The file holds whatever the last `pregenerate` run produced: one Gemini request per
  sample returns its ideas, a draft per vendor and answers to the suggested prompts, each item
  checked like live output and left out if it fails. A run cut short by a quota leaves gaps
  (today it holds ideas for the Lucknow wedding only), and the offline content fills them,
  labelled as such.
  `VITE_API_BASE=/` calls the API on the page's own origin (server-hosted build).

---

## 9. Security and responsible AI

**Threat model** (kept in `SECURITY.md`): no accounts and no server-side storage, so there is
nothing to read across users; the assets are the Gemini key and its quota, the integrity of
generated content, and the user's browser data.

- **Stateless server:** no database, no files, no ids; requests are processed and forgotten.
- **No personal data collected:** no names, phone numbers or emails anywhere; the note field
  warns against personal details; logs record the request id, route, status, latency and
  source, plus why Gemini fell back or a request failed (error name and status; for a 500 the
  message and stack), never a body or the key.
- **Boundaries validated:** strict zod schemas (unknown keys rejected, enums, bounds) then
  the core validator; JSON-only (`415` otherwise); body limit 16 KB; generic error bodies with
  a request id, no stack traces.
- **Headers:** Hono `secureHeaders` with HSTS, `nosniff`, `frame-ancestors 'none'`,
  `Referrer-Policy: no-referrer`, `Permissions-Policy` denying sensors and payment, and a
  `default-src 'none'` CSP on API responses. CORS limited to an allow-list, `POST` only.
- **SPA CSP with no `'unsafe-inline'` or `'unsafe-eval'`:** CSS is a built file, no inline
  `style` attributes or Svelte transitions that inject `<style>`, `connect-src` set to the
  exact API origin at build time, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`. When the server hosts the built app, the same policy is sent as a
  header with `frame-ancestors 'none'`.
- **Output handling:** Svelte escapes all text; `{@html}` is banned by lint; generated text is
  rendered as text only; `.ics` text is escaped per RFC 5545.
- **Key handling:** read once from the environment (Node's built-in env-file loading of
  `server/.env` for local runs), validated by zod at start-up, never logged or sent to the browser; `.env` ignored,
  `.env.example` documented.
- **Abuse limits:** per-client rate limit with an explicit trust-proxy switch, global Gemini
  budget, upstream timeouts with `AbortSignal`.
- **Prompt injection:** the note is fenced and declared as data; output is schema-constrained,
  re-validated and guarded; the assistant can only propose a `PlanPatch` that passes the same
  validation as the form, and the user confirms it.
- **Responsible content:** explicit safety settings; cultural and dietary respect in the
  system instruction plus deterministic dietary guards; costs labelled as estimates on screen,
  in API responses and in prompts; every generated item marked with its source.
- **Supply chain:** exact-pinned dependencies with a lockfile, `npm ci` in CI, CodeQL, CI
  actions pinned to commit SHAs, Dependabot limited to security updates.

---

## 10. Efficiency

- The plan never needs the network: computed in the browser, instantly, offline.
- Core: integer day numbers; frozen module-scope tables; each stage is a single pass with no
  intermediate arrays; regexes and `Intl` formatters hoisted to module scope; `buildPlan`
  memoised on the canonical input key.
- Bundles: `sideEffects: false` on the core; per-event-type profile chunks; lazy Plan view and
  calendar export; no UI, chart, date or icon library; system font stack (no web fonts);
  icons as one inline SVG sprite; a gzip size budget for the first screen checked in CI.
- Rendering: `$derived` recomputation only on input change; keyed lists; long lists use
  `content-visibility: auto`; storage writes debounced.
- Server: Gemini response cache with in-flight coalescing; `compress()`; hashed static assets
  served `immutable` when the server hosts the app; compact prompt JSON; output token caps;
  `/api/health` cheap and cacheable.
- Each of these choices carries a one-line JSDoc stating why.

---

## 11. Accessibility and inclusive design

- Skip link, landmarks (`header`, `main`, `footer`; the plan tabs are an ARIA tablist, not
  site navigation), one `h1` per view, logical
  heading order, `lang` set on the document.
- Form: `fieldset` + `legend` per step, visible labels, `aria-describedby` hints, inline
  errors plus a focusable error summary, no placeholder-only labels.
- Tabs: ARIA tablist with roving tabindex and arrow keys; focus moves to the panel heading.
- Live regions: polite for the live summary and assistant replies, `role="alert"` for
  errors, `aria-busy` while generating; long generated text (ideas, drafts) is announced by a
  short status line, not read out whole. Busy buttons use `aria-disabled` so focus stays on
  them, and a control that removes itself (Cancel, Apply, Dismiss, Delete) hands focus on.
- Status never by colour alone (icon + word for verdicts, late, at-risk); WCAG AA contrast
  documented on every colour token in light and dark themes; `forced-colors` support.
- Chart is SVG with `role="img"` + label and a full `<table>` equivalent with `<caption>`.
- `prefers-reduced-motion` respected; visible `:focus-visible` outlines; targets ≥ 24 px.
- Inclusive: Indian date and currency formatting via
  `Intl`; step-free and dietary needs are first-class inputs that change the plan.
- Print stylesheet produces a readable black-on-white plan.

---

## 12. Testing

Vitest in every package, coverage enforced by thresholds in config.

- **Core (100 % lines and branches):** unit tests per module plus property tests (fast-check)
  for invariants: budget lines + contingency equal the budget exactly for any valid input;
  no task due before today or after the event (except phase After); dependencies never
  inverted; every dietary constraint reaches the caterer questions; `applyPatch` then
  `validateInput` always succeeds for a valid patch; share encoding round-trips; `.ics` output
  is CRLF-terminated with lines ≤ 75 octets; guards catch every conflict in a fixture table.
  Scenario tests for the three samples pin key figures.
- **Server:** each route through `app.request()` with Gemini mocked: success, schema-invalid
  output, guard rejection, timeout, 429 chain fallthrough, quota exhaustion, cache hit and
  coalescing, validation errors (400/415/413), rate limit, headers present.
- **Web:** components with `@testing-library/svelte`, every component asserting no axe
  violations; tab keyboard behaviour; form errors and summary; assistant preview/apply flow;
  storage validation drops tampered data; demo-mode client.
- `npm run verify` = format check, lint, typecheck, tests with coverage, build, size budget.

---

## 13. Code quality conventions

- Three workspaces only; core shared by server and web, so planning logic and shared helpers
  (day arithmetic, counted nouns) have one definition.
- TypeScript strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`; no `any`, no non-null assertions.
- ESLint (typescript-eslint strict + stylistic type-checked, eslint-plugin-svelte) with
  budgets: complexity 10, max-lines-per-function 60, max-lines 250, max-depth 3,
  max-params 4; `--max-warnings 0`; Prettier.
- JSDoc on every export stating intent and the reason for non-obvious choices.
- Typed errors; pure functions in the core; side effects only at the edges.
- No dead code, no TODOs, colocated tests (`*.test.ts` next to the module).

---

## 14. Repository and delivery

Root: `README.md`, `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`,
`.editorconfig`, `.gitattributes`, `.gitignore`, `.env.example`, `Dockerfile` (multi-stage,
non-root; serves API and built app from one origin), `.dockerignore`, `docs/DESIGN.md`,
`docs/decisions.md` (short decision records).
`.github/`: `ci.yml` (verify), `codeql.yml`, `pages.yml` (demo build to GitHub Pages once CI passes on main),
`dependabot.yml` (security updates only). One branch, `main`. Repository well under 10 MB.

**README order:** title and one-line promise with the live demo link and the estimates note;
chosen vertical (quoting the brief); requirement → feature → file table covering every part of
the brief and the challenge expectations; how it works (flow); approach and logic (rules table
with a worked example); where Gemini is used and how it degrades; assumptions; run locally and
demo mode; architecture; quality notes per focus area (code quality, security, efficiency,
testing, accessibility) pointing to files.

---

## 15. Non-goals

No accounts, vendor marketplace, real vendor listings, bookings or payments; no sending
invitations or messages (drafts are copied by the user); no guest-list management beyond
counts; no currencies other than INR; prices are typical estimates, not quotes.

## 16. Assumptions

- Users are in India; budgets in INR; city tiers capture the main cost difference.
- Cost floors, budget weights, turnout and lead times are editorial planning estimates,
  stated in one place and easy to tune.
- Dates are calendar dates; "today" is the date in India in both the browser and the server,
  so they agree on what is late. The run sheet uses local wall-clock times.
- One event per plan; up to ten plans per browser.
- Permit requirements vary by city; Jashn lists them as "check local rules", not legal advice.

## 17. Left to the builder

Exact copy and visual design (warm, festive, restrained; contrast-checked tokens), the idea
catalogue contents, the full task/vendor/run-sheet catalogues within the rules above, exact
rate-limit and quota numbers, and the size budget figure.
