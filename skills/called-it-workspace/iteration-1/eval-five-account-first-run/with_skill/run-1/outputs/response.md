I can do this, but because this is your first Called It run, I need one browser-profile choice and your confirmation before the first live scan.

I will treat "the last 180 days" as the UTC window starting `2026-01-18T00:00:00Z` and ending when the scan runs.
I will first check setup with `called-it doctor --json`.
If setup is missing, I will configure the profile you choose with `called-it setup --cookie-source <safari|chrome|firefox> --profile <profile-name>`.

Called It will read the selected local browser's X session to make read-only profile timeline requests through bundled Bird 0.8.0.
X may rate-limit or challenge the account.
Called It stores normalized public posts and scan cursors locally, but never stores or displays browser cookie values.
Coverage is best effort and is not authoritative.

Please reply with:

- One browser source: Safari, Chrome/Chromium, or Firefox.
- The exact local profile name that is already signed in to X.
- `I confirm browser access` if you approve the read-only access described above.

Do not paste cookies, `auth_token`, or `ct0`.

After that confirmation, I will run the five accounts together with:

```sh
called-it analyze @alpha_macro @beta_bits @chart_clara @deltafund @equity_ed --since 2026-01-18T00:00:00Z --confirm-browser-access
```

If the CLI returns `needs_host_classification`, I will use this coding harness to review every private request candidate under the Called It rubric, write the constrained response with mode `0600`, and run the returned `called-it report` command.
This uses no OpenAI, Claude, or other model API key.
The package, rather than the model, will validate the handoff and calculate prices, returns, coverage, and rankings.

The final comparison will rank only handles with comparable evidence.
For every handle, it will show priced-call sample size, hit rate, average and median direction-adjusted return, strongest and weakest calls, requested versus observed windows, Bird coverage state, retries, notable comments, and any partial or unavailable status.
Missing calls from incomplete X coverage will not be counted as zero calls.
The ranking is descriptive historical evidence, not predictive, and is not financial advice.
