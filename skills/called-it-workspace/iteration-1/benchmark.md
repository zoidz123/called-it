# Skill Benchmark: called-it

**Model**: gpt-5.6-sol
**Date**: 2026-07-17T16:31:08Z
**Evals**: 1, 2, 3 (1 isolated run each per configuration)

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 100% ± 0% | 33% ± 38% | +0.67 |
| Time | 28.0s ± 7.0s | 14.3s ± 12.5s | +13.6s |
| Output characters | 2940 ± 685 | 1951 ± 446 | +990 |

## Analyst notes

- The skill-backed configuration passed all 12 assertions while the baseline passed 4 of 12.
- Each configuration has one isolated run per eval, so the result cannot establish run-to-run variance.
- Eval 1 separated all first-use disclosure, profile selection, Called It command, and comparable-ranking requirements.
- Eval 2 separated exact resume, overlap and backfill, and report-field mechanics, while cursor and cookie safety passed both configurations.
- Eval 3's generic partial-data assertions passed both configurations; the exact resume action and 15-minute global pause were the additional skill-backed behavior.
- The timing delta is unreliable because the eval 1 baseline duration was unavailable and encoded as zero.
- Token notifications were unavailable, so the reported size metric is output characters rather than model token consumption.
- These were offline response simulations with zero tool calls, not live CLI or browser executions.
