# Contributing

Thanks for helping. Jashn is small on purpose; please keep it that way.

## Setup

```bash
nvm use                      # Node 22.18 or newer, see .nvmrc
npm ci
cp .env.example server/.env  # GEMINI_API_KEY is optional
```

Everything, including every test, runs without a key: the server serves the deterministic
fallbacks and the web app runs in demo mode.

## Before you open a pull request

```bash
npm run verify
```

That runs the format check, lint with zero warnings, typecheck, tests with coverage thresholds,
the build and the first-screen size budget. CI runs the same command.

## Rules of the road

- **Numbers and dates come from `packages/core`, never from the model.** New logic goes in the
  core with a colocated `*.test.ts`, and the core stays at 100 % coverage.
- **Tests run offline.** Gemini is always injected and mocked; no test may need a key or the
  network.
- **Budgets are not negotiable.** Complexity 10, 60 lines per function, 250 lines per file,
  depth 3, 4 parameters. Split a module rather than suppress a rule; never lower a coverage
  threshold or the size budget to make a check pass.
- **JSDoc on every export**: what it is for and, where the choice is not obvious (security,
  efficiency, accessibility), why in one line.
- **No `any`, no non-null assertions, no TODOs, no dead code.**
- **The web app must never import `getProfile`**: use `loadProfile`, so each event type stays in
  its own chunk.
- **Accessibility is tested.** Every component test includes an axe check; try the change with
  the keyboard alone once.
- **Never commit `server/.env` or any key.** `.gitignore` covers it; do not work around it.

## Regenerating the demo content

The GitHub Pages build serves whatever Gemini output has been pre-generated for the three
samples (currently ideas for the Lucknow wedding in English only; everything else comes from
the offline content). With a key in `server/.env`, run `npm run pregenerate -w server`; it
resumes, so repeat it after a quota stop. It writes the file through Prettier, so the format
check passes. Review the diff of `web/src/lib/demo-genai.json` for tone and dietary
correctness before committing it.

## Commits and pull requests

Short, plain commit messages (`fix late task spreading`). One change per commit where
practical. In the pull request say what changed, why, and how you tested it; screenshots help
for UI changes.
