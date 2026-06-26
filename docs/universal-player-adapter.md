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

## Browser Adapter

The browser adapter accepts a Playwright-compatible `page` object and uses only
these fixed selectors:

```text
[data-testid="season-command"]
[data-testid="resolve-season"]
[data-testid="season-report"]
[data-testid="system-log"]
[data-testid="match-history"]
[data-testid="agent-trials-panel"]
```

It may optionally navigate once to a restricted play-page URL:
localhost/127.0.0.1/[::1] for local development, or HTTPS `play.iocalc.com` for
the public play surface. It strips query/hash values from the initial URL,
rejects credentials, rejects API/feedback/Wallet Lab paths, and rejects final
navigation URLs that include query/hash values or leave the play allowlist. Other
pages must be opened and trusted by the caller before constructing the adapter.
It does not run `page.evaluate`, does not follow links found in command text,
does not accept arbitrary selectors, and does not interact with Wallet Lab.
Command text is still untrusted gameplay input.

The browser adapter cannot apply `seed` or `sandboxId` through the UI. Use the
HTTP or local-core adapter for seeded sandbox resolution.

## Design rule

The adapter never owns wallet, feedback trust, deployment, secret, or production authority. It only normalizes safe gameplay.
