# Agent instructions

IOCALC Agent Env is a sandbox game protocol. Start with the allowed list and the forbidden list in `SECURITY.md`. Those lists bind every change and every tool call.

Read `docs/mcp-tools.md` before using or changing MCP tools. Each tool there has a Herald-inspired tier label. The label is `read` or `act`. The same label is the `tier` field on `IOCALC_MCP_TOOLS`.

## Tiers

A `read` tool observes sandbox state. It does not change that state. An `act` tool may change sandbox game state. It still cannot leave the sandbox.

Herald labels tools as read, act, mutate, or destructive. This repository uses only read and act. It does not add a mutate tier or a destructive tier. Wallet paths, secrets paths, and production paths are refused.

## Tool tiers

| Tool | Tier |
| --- | --- |
| `iocalc.get_manifest` | read |
| `iocalc.get_capabilities` | read |
| `iocalc.get_state` | read |
| `iocalc.submit_command` | act |
| `iocalc.resolve_season` | act |
| `iocalc.get_report` | read |
| `iocalc.get_log` | read |
| `iocalc.get_match_history` | read |
| `iocalc.get_governance_ledger` | read |
| `iocalc.run_agent_trial` | act |

## Forbidden paths

Do not read, write, request, or implement wallet paths. Do not read, write, request, or implement secrets paths. Do not read, write, request, or implement production paths.

That ban covers wallet actions, private keys, secrets access, and production or deployment mutation. `SECURITY.md` also forbids arbitrary code execution, arbitrary URL fetching, feedback-to-game mutation, account or session requirements, and financial functionality or advice.

If a task needs one of those paths, stop. Do not look for a workaround.
