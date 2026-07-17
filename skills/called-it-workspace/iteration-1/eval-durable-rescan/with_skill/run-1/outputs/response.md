I would resume the saved scan with the same handle and requested UTC start date:

```sh
called-it resume @alpha_macro --since 2026-01-01
```

This reuses the durable local evidence ledger instead of starting a fresh scan.
The new timeline work is limited to checking the current head until it finds known-post overlap, then continuing older tail backfill from the last committed cursor.

I cannot honestly give page, post, or retry counts here because this response simulation did not execute the resume command.
After the run, the exact accounting must come from the saved report's `coverage` and `scanResults` fields: committed pages, committed posts, retries, stop reason, requested window, observed window, and whether coverage is `best_effort`, `partial`, or `error`.
I would report those values directly rather than infer work from the requested date or invent page counts.

Any result remains historical best-effort evidence, not an authoritative X archive or financial advice.
