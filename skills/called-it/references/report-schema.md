# Called It report schema

Read this reference when consuming the JSON report or mapping it into another tool.

## Stable top-level fields

- `schemaVersion` is `1`.
- `id` and `generatedAt` identify the immutable saved report.
- `requestedWindow` records the user-requested UTC bounds.
- `observedWindow` is the union of evidence actually observed during the run.
- `coverage` contains one scan-coverage record per attempted account.
- `scanResults` records committed pages, committed posts, retries, the stop reason, and a rate-limit retry time when applicable for every attempted account.
- `ranking` contains only accounts with comparable best-effort coverage and at least one priced call.
- `accounts` contains calls, aggregate statistics, and notable evidence comments.
- `partialHandles` contains authentication, rate, compatibility, budget, and availability gaps plus retry counts.
- `limitations` contains required interpretation caveats.

## Coverage states

`best_effort` means the configured stop condition was reached without a known interruption.
It does not mean X returned an authoritative complete archive.

`partial` means committed evidence is useful but a gap, budget, rate limit, authentication problem, or cursor condition stopped the scan.

`error` means no trustworthy continuation decision could be made for that account in the run.

Never merge a partial account into the ranking by substituting zero calls for missing evidence.
