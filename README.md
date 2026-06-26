# IOCALC Agent Env

Open-source TypeScript protocol, adapter suite, conformance helpers, and MCP bridge scaffolding for making IOCALC playable by humans, browser agents, HTTP agents, MCP clients, and local test runners.

IOCALC Agent Env is intentionally sandbox-only. It defines how agents can read game state, submit game commands, resolve deterministic seasons, read reports/logs, and run agent trials. It does **not** provide wallet access, private-key access, feedback trust mutation, production deployment access, arbitrary code execution, secrets access, or financial functionality.

## Packages

- `@iocalc/protocol` — shared types, safe capabilities, transcript helpers, and runtime schemas.
- `@iocalc/adapters` — manual transcript, HTTP, browser, MCP, and local-core adapter implementations or stubs.
- `@iocalc/conformance` — safety and compatibility assertions for IOCALC-compatible implementations.
- `@iocalc/mcp-server` — MCP server scaffold exposing sandbox game tools only.

## Core contract

```ts
const state = await adapter.getState();
await adapter.submitCommand({ mode: "season_duel", command: "repair wall and gather wood" });
const resolution = await adapter.resolveSeason({ seed: "demo-seed" });
const report = await adapter.getReport();
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
