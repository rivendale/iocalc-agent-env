# Compatibility Matrix

This matrix records the currently supported IOCALC agent integration targets.

| Surface | Status | Contract |
| --- | --- | --- |
| Node.js | Supported | Node 22 in local checks and CI. |
| Package manager | Supported | pnpm 9.15.0 from `packageManager`. |
| HTTP adapter | Supported | `/api/game/*` sandbox endpoints. |
| Browser adapter | Supported | Fixed selectors on `https://play.iocalc.com/` or local `127.0.0.1` game roots. |
| MCP bridge | Supported | Closed-schema tools in `@iocalc/mcp-server`. |
| MCP stdio wrapper | Supported | `iocalc-mcp-server` binary after build. |
| Agent governance ledger | Supported | Read-only sandbox evidence only. |
| Season 1 ruleset | Compatible when game manifest exposes it | Agents pass game-supported request fields only. |

## Generated Snapshots

Run:

```bash
pnpm contracts:generate
```

Outputs:

- `schemas/iocalc-agent-env-contract-v1.json`
- `schemas/iocalc-agent-env-openapi-lite-v1.json`

Use `pnpm contracts:check` in CI to ensure generated snapshots are committed.

## Boundary

Compatibility never grants authority for wallets, private keys, secrets,
production deployment, arbitrary URL fetch, code execution, feedback trust,
accounts, sessions, or financial functionality.
