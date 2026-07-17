# @called-it/agent

Install the complete Called It local-agent runtime and skill with one command.

Called It uses the selected local browser profile through bundled, read-only Bird 0.8.0 and the current Codex or Claude Code harness for classification.
It never asks for model API keys, X API keys, or browser cookie values.

## Install

Node.js 18 or newer is required for the `npx` installer.
Bun 1.x is required by the installed Called It runtime.

```sh
npx @called-it/agent install --target codex
npx @called-it/agent install --target claude
```

The Codex skill defaults to `~/.codex/skills/called-it`.
The Claude Code skill defaults to `~/.claude/skills/called-it`.
The versioned runtime and stable launcher default to `${XDG_DATA_HOME:-$HOME/.local/share}/called-it/runtime`.
The installer does not edit shell configuration or install global packages.

After installation, invoke Called It through the installed skill and choose the Safari, Chrome, or Firefox profile that is already logged into x.com.
The first live scan explains the read-only browser-session disclosure and asks for confirmation.

## Update and uninstall

```sh
npx @called-it/agent update --target codex
npx @called-it/agent update --target claude
npx @called-it/agent uninstall --target codex
npx @called-it/agent uninstall --target claude
```

Normal uninstall preserves Called It configuration, SQLite evidence, and reports.
Data deletion requires `uninstall --purge`, an interactive terminal, and the exact confirmation word `PURGE`.
Downgrades are refused unless `--allow-downgrade` is explicit.
Modified installed skill files are refused unless `--backup-modified` is explicit, in which case the installer preserves a timestamped backup and prints its path.

## Security

Called It never accepts OpenAI, Anthropic, or X API credentials and never asks for browser cookies.
The local coding harness performs constrained classification.
Bundled Bird 0.8.0 is the only X ingestion path, and its bundle and licenses are checksum-verified before installation.

The package is self-contained after npm downloads it, so a cached package can execute without fetching runtime dependencies.
See the repository README for the full usage and security workflow.
