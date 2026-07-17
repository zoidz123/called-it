I can safely return the committed partial evidence now, but I would not rank all five accounts together.

- The three accounts that reached `best_effort` coverage and have at least one priced call are the only accounts eligible for the comparable ranking.
- The protected account is unavailable and must be listed separately.
- The rate-paused account keeps every page and post committed before the 429, but its coverage is partial, so it must also be listed separately rather than scored as though the missing history contained zero calls.

The account handles, saved report, sample sizes, calls, returns, observed windows, and retry details are not included in the information here, so I will not invent a ranking or account-specific results.
The partial report is still the trustworthy artifact to use: for each comparable account it should show the priced-call sample size, hit rate, average and median direction-adjusted return, top calls, notable evidence comments, requested UTC window, observed window, coverage state, and retries.
The protected and rate-paused accounts should appear under partial or unavailable handles with their actual stop reasons and whatever evidence was committed.

To continue, wait until the report's `retry_not_before` time has passed.
A 429 pauses Bird's global queue for 15 minutes, so do not bypass it with parallel processes, another X account, another provider, or browser automation.
Then run the exact resume action printed by the partial report, using the same five handles and the same requested UTC start date:

```sh
called-it resume @handle1 @handle2 @handle3 @protected_handle @rate_paused_handle --since <same-ISO-UTC-start-date>
```

The resume starts each rescan at the head, finds known-post overlap, and continues tail backfill from the last committed cursor.
After it completes, compare the new requested and observed windows, coverage states, retry counts, and stop reasons before adding either previously incomplete account to the ranking.

Please confirm the exact UTC bounds you intended by "the past year" when you provide the handles or saved report.
These results are historical best-effort evidence, not an authoritative X archive or financial advice.
