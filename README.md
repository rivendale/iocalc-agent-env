# IOCALC Agent Env

Open-source TypeScript protocol, adapter suite, conformance helpers, and MCP bridge scaffolding for making IOCALC playable by humans, browser agents, HTTP agents, MCP clients, and local test runners.

IOCALC Agent Env is intentionally sandbox-only. It defines how agents can read game state, submit game commands, resolve deterministic seasons, read reports/logs, and run agent trials. It does **not** provide wallet access, private-key access, feedback trust mutation, production deployment access, arbitrary code execution, secrets access, or financial functionality.

## Packages

- `@iocalc/protocol` — shared types, safe capabilities, transcript helpers, and runtime command validation.
- `@iocalc/adapters` — manual transcript, HTTP, browser, MCP, and local-core adapter implementations or stubs.
- `@iocalc/conformance` — safety and compatibility assertions for IOCALC-compatible implementations.
- `@iocalc/mcp-server` — MCP server scaffold exposing sandbox game tools only.

## Design docs

- `docs/loop-engineering.md` — IOCALC loop vocabulary for observe, command,
  resolve, verify, and revise cycles.
- `docs/game-theory-patterns.md` — safe sandbox game-theory patterns for
  settlement strategy and agent learning.

## Agent-readable metadata

Reports and resolutions may include optional `loopVerifier` and
`gameTheoryPattern` records. These records explain sandbox season outcomes for
agents, but they do not mutate scoring, resources, command parsing, controller
behavior, wallet state, feedback trust, or production state.
`IOCALC_RECOMMENDED_GAME_THEORY_PATTERNS` lists recommended labels; it is not a
runtime allowlist.

Game state may include scoped agent identity metadata such as
`canonicalAgentId`, `controllerType`, declared sandbox `capabilityScope`,
command source, timeout/fallback events, and review notes. Identity records are
audit metadata only; they do not create accounts, grant wallet authority, imply
third-party affiliation, or bypass human review.

Compatible responses may also include optional `boundary` and `audit` records.
These records explain why a sandbox action was allowed or rejected and record
the inert gameplay action that occurred. They are not permissions, accounts,
wallet approvals, production approvals, or feedback trust signals.

## Core contract

```ts
const state = await adapter.getState();
await adapter.submitCommand({ mode: "season_duel", command: "repair wall and gather wood" });
const resolution = await adapter.resolveSeason({ seed: "demo-seed" });
const report = await adapter.getReport();
```

HTTP callers can isolate state with a sandbox ID:

```ts
const adapter = new HttpIocalcAdapter({
  baseUrl: "http://127.0.0.1:8090",
  sandboxId: "local-agent-001"
});
```

To run the local HTTP conformance example against a running IOCALC game server:

```bash
IOCALC_BASE_URL=http://127.0.0.1:8090 IOCALC_SANDBOX_ID=local-check pnpm --filter @iocalc/example-http-player conformance
```

## Safety boundary

Allowed:

- read sandbox game state
- submit sandbox game commands
- resolve deterministic seasons
- read reports/logs/match history
- run sandbox agent trials

Forbidden:

- wallet actions or transaction requests
- private keys or secrets
- feedback-to-game mutation
- arbitrary URL fetching
- code execution
- account/session requirements
- production or deployment mutation
- financial functionality or advice

## Status

Initial scaffold. The protocol and HTTP/manual adapters are designed to be ingested by `iocalc.com` / `play.iocalc.com` through `/api/game/*` sandbox endpoints.
