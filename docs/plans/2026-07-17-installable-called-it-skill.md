# Installable Called It local-agent skill

## Decision

Build the local-agent integration in this monorepo around a deterministic `@called-it/agent` CLI and a concise `skills/called-it` procedural wrapper.
Use bundled `@steipete/bird@0.8.0` as the only X ingestion path.
Reuse the existing Called It classification, asset resolution, pricing, return, and aggregate logic instead of duplicating formulas in skill prose.

## Product contract

The local package reads public profile timelines through an explicitly selected local browser profile, persists normalized evidence and resumable scan state in SQLite, and emits structured JSON plus readable Markdown reports.
Repeated scans always check the timeline head, stop after a durable overlap, and resume tail backfill from the last committed opaque cursor.
Every valid Bird page is committed before another page is requested, so rate limits, authentication expiry, crashes, and contract failures preserve useful partial coverage.
Reports rank only comparable complete samples and disclose requested versus observed windows, partial coverage, unavailable handles, retries, revisions, and Bird limitations.

## Architecture

1. Extract or reuse pure domain seams from `@called-it/core` for call identification, asset normalization, pricing, directional returns, hit rate, averages, medians, and notable-call selection.
2. Add `@called-it/agent` with a numbered SQLite schema, a secret-safe configuration layer, an allowlisted Bird subprocess runner, strict Bird parsers, resumable ingestion, analysis orchestration, report assembly, and a small CLI.
3. Bundle the exact Bird 0.8.0 CLI with its required runtime dependencies and third-party license texts, then verify bundle version and integrity at build and doctor time.
4. Add `skills/called-it` with deterministic CLI instructions, progressive report/scoring/troubleshooting references, realistic evaluation prompts, and objective assertions.

## Security invariants

- Accept only explicit Safari, Chrome or Chromium, or Firefox cookie sources and profiles.
- Never accept, copy, store, log, report, or pass `auth_token` or `ct0` values.
- Strip known X credential environment variables before spawning Bird.
- Run Bird with argv through `execFile`, from a controlled configuration directory, with one global page at a time.
- Allow only `whoami`, `user-tweets`, and targeted `read` operations.
- Keep configuration and SQLite files at mode `0600`.
- Never fall back to official X APIs, paid providers, browser automation, or raw Bird passthrough.

## Verification gates

- Unit and integration tests cover exact argv, allowlisting, environment stripping, parsers, page transaction ordering, partial failure preservation, head overlap, stale cursor recovery, rate and auth pauses, unavailable targets, revisions, deletion confirmation, and coverage reporting.
- Synthetic fixtures cover supported Bird envelope and error variants without real credentials or copied user data.
- Temporary-XDG end-to-end tests prove clean setup, resumable scans, partial reports, unchanged rescans, bundle integrity, and secret absence from all durable and rendered artifacts.
- Full repository lint, typecheck, tests, and configured web build remain green on top of the hardening PR.
- Isolated with-skill and no-skill evaluations exercise five-account comparison, durable rescan, and mixed partial failure behavior.
- The final acceptance uses a user-confirmed real browser profile only for a secret-safe doctor and serialized five-handle read-only scan.

## Risks and open questions

Bird depends on private X web behavior and can break because of query changes, cookie expiry, rate limits, account challenges, or browser database permissions.
Best-effort profile coverage must therefore never be described as authoritative or complete.
Bird 0.8.0 may need a narrow Chrome expiry cast when its runtime probe demonstrates the SQLite integer incompatibility; do not apply the patch speculatively.
The existing OpenAI classification and Yahoo or Hyperliquid pricing paths remain required for full analysis and can independently produce partial outcomes.
Do not choose a root Called It license as part of this work; include only the required third-party license notices for bundled dependencies.
