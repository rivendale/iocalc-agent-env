# IOCALC Agent Env

Open-source TypeScript protocol, adapter suite, conformance helpers, and MCP bridge tooling for making IOCALC playable by humans, browser agents, HTTP agents, MCP clients, and local test runners.

IOCALC Agent Env is intentionally sandbox-only. It defines how agents can read game state, submit game commands, resolve deterministic seasons, read reports/logs, and run agent trials. It does **not** provide wallet access, private-key access, feedback trust mutation, production deployment access, arbitrary code execution, secrets access, or financial functionality.

## Packages

- `@iocalc/protocol` — shared types, safe capabilities, transcript helpers, and runtime command validation.
- `@iocalc/adapters` — manual transcript, HTTP, browser, MCP, and local-core adapter implementations or stubs.
- `@iocalc/conformance` — safety and compatibility assertions for IOCALC-compatible implementations.
- `@iocalc/mcp-server` — MCP tool bridge and opt-in stdio wrapper exposing sandbox game tools only.

## Design docs

- `docs/loop-engineering.md` — IOCALC loop vocabulary for observe, command,
  resolve, verify, and revise cycles.
- `docs/game-theory-patterns.md` — safe sandbox game-theory patterns for
  settlement strategy and agent learning.
- `docs/agent-governance-ledger.md` — sandbox-only evidence ledger for agent
  sessions, boundary decisions, conformance checks, and adversarial reviews.

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

Agent governance ledgers may record sandbox sessions, tool calls, failure-state
routes, contamination signals, risk bands, conformance checks, and adversarial
reviews. They are read-only evidence records and do not grant identity,
account, wallet, production, feedback trust, or financial authority.

## Core contract

```ts
const manifest = await adapter.getManifest?.();
const state = await adapter.getState();
await adapter.submitCommand({ mode: "season_duel", command: "repair wall and gather wood" });
const resolution = await adapter.resolveSeason({ seed: "demo-seed" });
const report = await adapter.getReport();
```

`getManifest()` is optional because manual and browser transports may not expose
the HTTP manifest directly. HTTP adapters use `GET /api/game/manifest` and do
not send sandbox IDs for that static contract read.

HTTP manifests may include an optional `responses` map keyed by known API route,
with safe dot-path field names such as `settingsSummary` or
`changes.passiveSettings`. Response contracts are documentation for sandbox game
payloads only; they do not grant authority or permit live-world effects.

HTTP callers can isolate state with a sandbox ID:

```ts
const adapter = new HttpIocalcAdapter({
  baseUrl: "http://127.0.0.1:8090",
  sandboxId: "local-agent-001"
});
```

Browser agents can play through the public UI with a Playwright-compatible page
object and the fixed IOCALC selectors:

```ts
const adapter = new BrowserIocalcAdapter({
  page,
  baseUrl: "http://127.0.0.1:8090"
});

await adapter.submitCommand({ mode: "season_duel", command: "repair wall and gather wood" });
await adapter.resolveSeason();
```

The browser adapter uses only fixed gameplay selectors, does not evaluate page
JavaScript, does not follow command links, and does not interact with Wallet Lab.
If `baseUrl` is supplied, it must target localhost/127.0.0.1/[::1] or
HTTPS `play.iocalc.com` at the play UI root or `/play`; other browser pages should be
opened and trusted by the caller before constructing the adapter.

To run the local HTTP conformance example against a running IOCALC game server:

```bash
IOCALC_BASE_URL=http://127.0.0.1:8090 IOCALC_SANDBOX_ID=local-check pnpm --filter @iocalc/example-http-player conformance
```

MCP callers can wrap an existing adapter with the sandbox-only tool bridge:

```ts
const bridge = createIocalcHttpMcpToolBridge({
  baseUrl: "http://127.0.0.1:8090",
  sandboxId: "local-agent-001"
});

await bridge.callTool("iocalc.submit_command", {
  mode: "season_duel",
  command: "repair wall and gather wood"
});
```

The MCP bridge also exposes `iocalc.get_manifest` when the wrapped adapter
supports `getManifest()`. Manifest output is sanitized and descriptive only.
Bridge authors can run `runIocalcMcpToolBridgeConformance(bridge)` to verify the
fixed sandbox tool list, closed tool schemas, unsafe probe rejection, and
non-reflective error output.

For local MCP stdio clients, `@iocalc/mcp-server` also ships an opt-in stdio
wrapper around the same safe bridge:

```bash
pnpm --filter @iocalc/mcp-server build
IOCALC_BASE_URL=http://127.0.0.1:8090 IOCALC_SANDBOX_ID=local-agent-001 node packages/mcp-server/dist/stdio.js
```

The stdio wrapper speaks JSON-RPC over stdin/stdout and supports `initialize`,
`ping`, `tools/list`, and `tools/call`. It does not bind a port, hold secrets,
or add any tool authority beyond `createIocalcHttpMcpToolBridge`. Installed
packages can use the `iocalc-mcp-server` binary.

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

Initial scaffold. The protocol, HTTP/manual/browser adapters, SDK-adaptable MCP tool bridge, and opt-in MCP stdio wrapper are designed to be ingested by `iocalc.com` / `play.iocalc.com` through stable UI selectors and `/api/game/*` sandbox endpoints.
