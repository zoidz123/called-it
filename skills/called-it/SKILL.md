---
name: called-it
description: Analyze and compare the historical reliability of X accounts using the local Called It evidence ledger. Use this skill whenever a user asks who made reliable calls, wants an X account call audit, asks for top calls or misses, compares trader or investor accounts, resumes a prior Called It scan, or inspects a saved local reliability report. Use it even when the user says Twitter instead of X or does not name Called It.
compatibility: Requires Bun, the local @called-it/agent package, an explicit supported browser profile already logged into x.com, and OpenAI plus market-pricing access for full analysis.
---

# Called It

Use the deterministic `called-it` CLI for browser authentication checks, Bird timeline scanning, durable evidence, scoring, and reports.
Do not recreate scoring formulas or call Bird directly.

## Before live access

Run `called-it doctor --json` first.
If setup is missing, ask the user which local Safari, Chrome or Chromium, or Firefox profile to use, then run:

```sh
called-it setup --cookie-source <safari|chrome|firefox> --profile <profile-name>
```

Before the first live scan for that profile and signed-in principal, explain:

> Called It will read the selected local browser's X session to make read-only profile timeline requests through bundled Bird 0.8.0.
> X may rate-limit or challenge the account.
> Called It stores normalized public posts and scan cursors locally, but never stores or displays browser cookie values.
> Coverage is best effort and is not authoritative.

Ask for confirmation once.
After confirmation, add `--confirm-browser-access` to the first analysis command.
Never ask the user to paste cookies, `auth_token`, or `ct0`.

## Analyze or compare

Normalize each requested account to an `@handle` and clarify the UTC lookback if the user omitted it.
Run one command for the requested group:

```sh
called-it analyze @handle1 @handle2 --since <ISO-date> [--confirm-browser-access]
```

Relay progress using these exact stages when they appear: `bird_auth`, `bird_head`, `bird_backfill`, `bird_rate_paused`, `classifying`, `pricing`, and `reporting`.
Open the saved Markdown report for the user-facing answer and retain the JSON path for structured inspection.

Lead with ranked reliability only for comparable handles.
Always show sample size, top calls and returns, notable comments, requested and observed windows, Bird coverage state, retries, and partial or unavailable handles.
Never treat missing calls from an incomplete handle as zero calls.
State that the result is historical best-effort evidence and not financial advice.

Read [references/report-schema.md](references/report-schema.md) when interpreting JSON or integrating the result elsewhere.
Read [references/reliability.md](references/reliability.md) when explaining ranking or return semantics.

## Resume and inspect

Resume with the same handles and requested start date:

```sh
called-it resume @handle1 @handle2 --since <ISO-date>
```

Inspect the latest saved report with `called-it inspect`, or use `called-it inspect --report <id> --json` for a specific structured report.
The ledger starts every rescan at the head, uses known-post overlap, and continues tail backfill from the last committed cursor.

On rate limits, authentication expiry, Bird incompatibility, or unavailable accounts, return the partial report and the CLI-provided resume action.
Do not switch to another X provider or browser automation.
Read [references/troubleshooting.md](references/troubleshooting.md) before giving recovery instructions.
