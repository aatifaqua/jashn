# Security policy

## Supported versions

| Version | Supported |
| :------ | :-------- |
| 0.1.x   | Yes       |

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability
reporting on this repository (Security tab, "Report a vulnerability") with the steps to
reproduce and the impact you see. You will get an acknowledgement within a few days and a fix or
a clear answer within 30 days.

## Threat model

Jashn has no accounts and no server-side storage, so there is nothing to read across users. The
assets worth protecting are the Gemini key and its quota, the integrity of generated content
(it must never contradict the plan, break a declared diet or carry a link), and the user's own
data in their browser.

| Threat                                                               | Asset                  | Control                                                                                                                                                                                                                                                                                   | Where                                                                                                                                  |
| :------------------------------------------------------------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| Key leaked through the repo, bundle or logs                          | Gemini key             | Read only by the server from the environment or the gitignored `server/.env`, validated by zod at start-up, never logged, never sent to the browser; the Pages demo has no server and no key                                                                                              | [config.ts](server/src/config.ts), [.gitignore](.gitignore)                                                                            |
| Quota exhaustion by repeated or scripted requests                    | Gemini quota           | Per-client fixed-window rate limit (IPv6 keyed by /64, `X-Forwarded-For` read only with `TRUST_PROXY`), a global hourly call budget, a response cache with in-flight coalescing; past the budget, requests get the fallback rather than an error                                          | [rateLimit.ts](server/src/middleware/rateLimit.ts), [quota.ts](server/src/middleware/quota.ts), [cache.ts](server/src/cache.ts)        |
| Malformed or oversized requests                                      | Server availability    | JSON only (415), 16 KB body limit (413), strict zod schemas that reject unknown keys, then the same core validator the form uses; upstream calls bounded by `AbortSignal` timeouts                                                                                                        | [app.ts](server/src/app.ts), [schemas.ts](server/src/ai/schemas.ts), [input.ts](packages/core/src/input.ts)                            |
| Prompt injection through the free-text note or the assistant message | Generated content      | The note is sanitised, capped at 300 characters, fenced and declared as data; the server rebuilds the plan from validated input and never trusts a client plan; output is schema-constrained, re-parsed and guarded; a proposed change must pass `validatePatch` and the user confirms it | [prompts.ts](server/src/ai/prompts.ts), [assist.ts](server/src/routes/assist.ts)                                                       |
| Invented prices or dates, unsafe or culturally wrong content         | Generated content      | Explicit safety settings; system rules on faith, diet and access needs; deterministic guards reject dietary conflicts, links, over-long text and any rupee figure or calendar date the plan does not state; any failure serves the deterministic fallback                                 | [guards.ts](packages/core/src/guards.ts), [date-mentions.ts](packages/core/src/date-mentions.ts), [gemini.ts](server/src/ai/gemini.ts) |
| Script injection into the page                                       | User's browser         | Svelte escapes all text and `{@html}` is banned by lint; SPA CSP with no `unsafe-inline` or `unsafe-eval`, `connect-src` set to the exact API origin at build time, `object-src 'none'`; framing denied when the server hosts the app                                                     | [index.html](web/index.html), [vite.config.ts](web/vite.config.ts), [static.ts](server/src/static.ts)                                  |
| Tampered saved plans or share links                                  | User's browser data    | Stored and shared plans are untrusted input: read through `validateInput`, structural checks and the idea guards; invalid entries are dropped. Share links travel in the URL fragment, which never reaches a server                                                                       | [storage.ts](web/src/lib/storage.ts), [share.ts](packages/core/src/share.ts)                                                           |
| Personal data collected or logged                                    | Users' privacy         | No names, phone numbers or emails are asked for; the note warns against personal details and is left out of vendor drafts; logs hold route, method, status, latency and source only; errors are generic bodies with a request id                                                          | [logger.ts](server/src/middleware/logger.ts), [errors.ts](server/src/middleware/errors.ts)                                             |
| Clickjacking, sniffing, referrer leaks                               | API and app            | HSTS, `nosniff`, `X-Frame-Options: DENY` and `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, a Permissions-Policy denying sensors, payment and USB, `default-src 'none'` on API responses; CORS allow-list, POST only                                                           | [security.ts](server/src/middleware/security.ts)                                                                                       |
| Compromised dependency or workflow                                   | Build and deploy chain | Exact-pinned dependencies with a lockfile, `npm ci` in CI, CodeQL, every action pinned to a commit SHA with least-privilege permissions, Dependabot security updates                                                                                                                      | [package-lock.json](package-lock.json), [.github/workflows](.github/workflows)                                                         |

## Known limits

- `TRUST_PROXY=true` reads the right-most `X-Forwarded-For` entry, which assumes exactly one
  trusted proxy. Behind a CDN plus a load balancer, set the platform's own client-address header
  at the edge instead, or every client shares one bucket.
- Rate limits and the hourly budget are per process. Several replicas each enforce their own.
- The dietary guard errs on the side of rejection: a dish described as "without egg" is still
  rejected under vegetarian, which only costs a fallback.
