# Troubleshooting

Read this reference when doctor or analysis returns a partial state.

## Authentication or cookie permission

Ask the user to log into x.com in the exact configured browser profile, close browser database writers if required, and rerun `called-it doctor --json`.
Safari may require Full Disk Access for the terminal or agent host.
Never ask for copied cookie values.

## Rate pause

Bird pauses the global queue for 15 minutes after a 429.
Keep the partial report and rerun the provided `called-it resume` command after `retry_not_before` has passed.
Do not bypass the pause with parallel processes or another account.

## Bird incompatibility

Persistent query-ID 404s, malformed JSON, or contract drift stop as `tool_incompatible`.
Do not switch to an official API, paid API, generic provider, browser automation, or a different Bird binary.
Report that bundled Bird 0.8.0 needs a compatible package update.

## Unavailable target

Protected, suspended, or missing accounts are per-account unavailable conditions.
Continue interpreting other handles and list the unavailable handle separately.

## Unsupported developer override

`CALLED_IT_BIRD_PATH` works only with the explicit `--allow-unpinned-bird` flag for isolated development tests.
Do not recommend it for normal use.
