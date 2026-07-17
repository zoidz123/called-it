# Reliability and return semantics

Read this reference when the user asks how Called It ranks accounts or calculates returns.

Called It reuses the website's current domain logic.
It identifies high-conviction BULL and BEAR stances conservatively, groups the first directional call per asset, resolves the asset, prices the entry and current observation, and computes direction-adjusted return.

Reliability is hit rate: priced calls with positive direction-adjusted return divided by all priced calls in the sample.
The report also shows average return, median return, total calls, and positive calls.
Default ranking sorts by hit rate, then sample size, then average return.

The score is descriptive rather than predictive.
Small samples, unresolved assets, unavailable historical pricing, edited posts, and incomplete Bird coverage all limit interpretation.
Do not invent a composite score or confidence interval that the report does not contain.
