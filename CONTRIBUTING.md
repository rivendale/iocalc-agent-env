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
