The audit is only partially complete, so I would not issue a five-account ranking yet.

What is trustworthy now:

- Findings from posts that were actually retrieved can be reported and scored, with each claim tied to the post URL and date.
- The protected account is unavailable, not unsuccessful. No posts from it should be treated as missed or bad calls.
- The rate-limited account is incomplete. Only the retrieved portion is usable, and any hit rate or comparison for that account must be labeled partial.
- Absence from either unavailable portion is not evidence that a prediction was wrong.

The prompt does not include the five handles or the retrieved posts, so I cannot truthfully provide account-specific findings from this message alone. I would preserve the completed scan results and mark each account as `complete`, `partial`, or `unavailable`, rather than filling gaps with assumptions.

To continue later:

1. Save the rate-limited account's last successful cursor or oldest retrieved post date, plus the scan timestamp and requested one-year boundary.
2. After the rate-limit window resets, resume from that cursor and stop at the original boundary. Deduplicate by post ID before merging.
3. For the protected account, retry only after an authorized account with access is available. If access remains unavailable, leave it marked unavailable.
4. Recompute account-level totals and comparisons only after each account is complete. Until then, keep partial counts separate and do not annualize them.
5. Record the source URL, post date, retrieval status, and evidence for every scored call so the final audit can be reproduced.

If you provide the completed scan output and the saved cursor or cutoff for the interrupted scan, I can turn the trustworthy portion into the actual partial audit without overstating coverage.
