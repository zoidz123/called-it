# Host classification contract

Read this reference after `called-it analyze` or `called-it resume` returns `needs_host_classification`.

The classification request is private local evidence generated from the SQLite ledger.
Use only each candidate's post text and listed cashtags.
Do not research outside context, infer position size, or add assets.

For every candidate and every listed asset, choose `BULL`, `BEAR`, or `NONE` with conviction from `0` through `1`.
Use `BULL` only for a clear current or forward view that the exact asset should appreciate, be bought, owned, or held long.
Use `BEAR` only for a clear current or forward view that the exact asset should decline, be sold, avoided, or held short.
Default to `NONE` when confidence is below `0.7` or the text is ambiguous.

Recaps, rankings, neutral news, questions, jokes, product comparisons, benchmark mentions, and retrospective victory laps are `NONE` unless the author also states a fresh directional investment view for that exact asset.
Words such as buy, sell, long, short, up, or down do not decide the label without the author's own clear stance.

Write a JSON object with this exact shape:

```json
{
  "schemaVersion": 1,
  "requestId": "copy from request",
  "reviewedCandidateCount": 42,
  "results": [
    {
      "id": "copy candidate id",
      "stances": [
        { "asset": "$BTC", "direction": "BULL", "conviction": 0.95 }
      ]
    }
  ]
}
```

Review every candidate and set `reviewedCandidateCount` to the request's candidate count.
Include a result only when at least one listed asset is `BULL` or `BEAR` with conviction at least `0.7`; omitted candidates are `NONE`.
The CLI rejects mismatched request IDs or reviewed counts, duplicate or unknown candidate IDs, unknown assets, extra fields, and invalid confidence values.
Keep the response file private with mode `0600`.
