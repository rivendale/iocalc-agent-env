# Contributing

Thanks for contributing to IOCALC Agent Env.

## Project rules

Contributions must preserve the sandbox-only boundary:

- no wallet actions
- no private-key handling
- no secrets access
- no arbitrary code execution
- no arbitrary URL fetching
- no production/deployment mutation
- no feedback-to-game mutation
- no financial functionality or advice

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Run `pnpm license:check` after adding packages or changing license files. All
publishable workspace packages should advertise `MIT-0 OR Apache-2.0`.

## Package layout

- `packages/protocol` defines the shared contract.
- `packages/adapters` implements transports against that contract.
- `packages/conformance` validates compatible IOCALC implementations.
- `packages/mcp-server` exposes sandbox-only MCP tools.

Please keep game logic in IOCALC itself. This repo defines contracts, adapters, tests, and docs.

## Handoff notes — 2026-08-18

Management is moving to overseer (and possibly ryg-lenovo); nick-pw will only
`git pull` after this round. Two transfers from the Protocol Wealth estate,
whose measured write-ups are public at
https://github.com/Protocol-Wealth/pw-ai-agent-code-core:

1. **Measure the tool registry against actual usage before growing it.**
   ryg-lenovo measured a sibling registry at 191 tools against OpenAI's hard
   128-tool ceiling — and the trim was ALPHABETICAL, so the system prompt named
   tools the trim had removed. PW measured its chat registry at 211 tools
   registered, 143 shipped to the model per request, **10 called in thirty
   days**. If this repo's tool surface grows, commit a generated usage report so
   the diff carries the signal, and key any eager/deferred split on measured
   use, never on a metadata default. Three exit codes on the checker: 0 fine,
   2 stale, 3 could-not-check — and 2/3 must never collapse, or an outage
   becomes a silent pass.

2. **Prove every gate in both directions.** The local gates above are the right
   shape; add the negative control — break a contract deliberately, confirm
   `contracts:check` fails BY NAME, restore. A check nobody has seen fail is
   indistinguishable from one that cannot.
