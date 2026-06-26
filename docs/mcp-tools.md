# MCP Tools

The MCP bridge should be a thin wrapper around the same sandbox protocol used by HTTP, browser, manual, and local-core adapters.

## Proposed tools

```text
iocalc.get_capabilities
iocalc.get_state
iocalc.submit_command
iocalc.resolve_season
iocalc.get_report
iocalc.get_log
iocalc.get_match_history
iocalc.run_agent_trial
```

## Tool boundary

MCP tools may only operate on sandbox game state. They must not expose wallet actions, private keys, secrets, production mutation, deployment mutation, arbitrary URL fetching, code execution, feedback trust mutation, or financial functionality.

## Implementation note

The initial package contains a scaffold only. A follow-up slice should wire the tool specs to the official MCP SDK and either a local game core or the `/api/game/*` HTTP adapter.
