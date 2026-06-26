# Universal Player Adapter

The Universal Player Adapter gives every IOCALC transport the same contract:

```text
Manual transcript
Browser / Playwright
HTTP API
MCP tools
Local resolver/core
```

## Core loop

```ts
const capabilities = await adapter.getCapabilities();
const state = await adapter.getState();
await adapter.submitCommand({ mode: "season_duel", command: "repair wall and gather wood" });
const resolution = await adapter.resolveSeason();
const report = await adapter.getReport();
const log = await adapter.getLog();
```

## Transport goals

- Manual transcript: works in any chat by pasting state and reports.
- Browser: plays the public UI with stable selectors.
- HTTP: gives agents a clean JSON interface.
- MCP: exposes sandbox game tools to MCP clients.
- Local core: imports the deterministic resolver for tests and simulations.

## Design rule

The adapter never owns wallet, feedback trust, deployment, secret, or production authority. It only normalizes safe gameplay.
