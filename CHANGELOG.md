# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Demo pre-generation makes one Gemini request per sample, returning its ideas, every vendor
  draft and the suggested-prompt answers; each item passes the live routes' own checks or is
  left out. The demo file drops its per-language level (version 2).

### Removed

- The output-language choice: generated text is English only. Plans saved earlier still load.

## [0.1.0] - 2026-10-27

### Added

- `@jashn/core`: event input validation and normalisation; wedding, birthday and community
  profiles loaded on demand; context derivation and contextual rules with reasons; budget split
  with largest-remainder rounding, feasibility verdict and ranked trims; back-scheduled timeline
  with late and at-risk flags; vendor checklist with questions and payment schedule; day-of run
  sheet; plan assembly with memoisation and plan diffs; plan summary for the assistant.
- `@jashn/core`: guards for dietary conflicts, links, length, invented rupee figures and
  invented or stale calendar dates; offline ideas, enquiry drafts and assistant answers; three sample events.
- Server: Hono API with `GET /api/health` and `POST /api/ideas`, `/api/assist`, `/api/draft`;
  Gemini model chain with timeouts, schema-constrained output, function calling for plan
  changes and deterministic fallbacks; secure headers, CORS allow-list, rate limit, hourly call
  budget, response cache with in-flight coalescing; optional static hosting of the web app.
- Web: Svelte 5 app with intake and live summary, lazy plan view with overview, budget,
  timeline, vendors, day-of and ideas tabs, an assistant with change preview, an autosaved
  plan, print stylesheet, light and dark themes, and demo mode with
  pre-generated Gemini content where available (so far ideas for one sample) and offline
  content elsewhere.
- Repository: CI, CodeQL, GitHub Pages and Dependabot workflows; first-screen size budget;
  Dockerfile; design document and decision records; security policy.
