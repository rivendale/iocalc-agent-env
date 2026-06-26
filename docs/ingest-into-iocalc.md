# Ingest into IOCALC

This repo should be ingested into the live game as a dependency or workspace package. The game owns the resolver and state. This repo owns the shared protocol, adapters, conformance helpers, and docs.

## Local development

```bash
pnpm install
pnpm build
```

In the IOCALC game repo, add the protocol package by workspace, local link, Git dependency, or npm once published.

```bash
pnpm add @iocalc/protocol
```

## Game routes to implement

```text
GET  /api/game/capabilities
GET  /api/game/state
POST /api/game/command
POST /api/game/resolve
GET  /api/game/report
GET  /api/game/log
GET  /api/game/match-history
POST /api/game/agent-trial
```

## Current IOCALC game implementation notes

Inspection date: 2026-06-26.

The current game repo is a browser-native app served from `web/` by
`tools/game_server.py`. The public server currently exposes static routes plus
append-only feedback routes (`/api/feedback` and `/api/recommend`). Gameplay
state and season resolution live in `web/game.js` and persist in browser
`localStorage`. Wallet Lab lives under `/wallet` and `web/wallet.js`; it is
read-only and out of scope for this protocol.

Do not implement `/api/game/*` by copying or reimplementing the resolver in a
second language. That would make browser play and agent play drift apart.

Recommended safe sequence:

1. Add the stable browser selectors below and keep the existing browser smoke
   tests passing.
2. Extract the deterministic state, command normalization, submission, season
   resolution, report, log, and match-history helpers from `web/game.js` into a
   shared sandbox game-core module used by the browser.
3. Add focused tests for that shared game-core module: Human vs AI, Agent Trials,
   timeout fallback, command source reporting, and match history.
4. Add `/api/game/*` only after the server can call the same shared game core or
   an equivalent imported local-core adapter without touching Wallet Lab,
   feedback trust, secrets, deployments, production data, or real assets.
5. Update `llms.txt` and boundary docs only after the sandbox API exists.

## Stable browser selectors

Add or preserve these selectors in the play UI so browser agents and Playwright
tests can operate the same public surface as a human:

```text
data-testid="season-command"
data-testid="resolve-season"
data-testid="season-report"
data-testid="system-log"
data-testid="match-history"
data-testid="agent-trials-panel"
```

The `BrowserIocalcAdapter` in `@iocalc/adapters` reads and clicks only these
selectors. It is not a general browser agent and must not be extended to Wallet
Lab, feedback trust, arbitrary URL fetching, or page-side code execution. If it
owns navigation, it only accepts local development play URLs or `play.iocalc.com`
HTTPS play URLs and verifies the final URL after navigation.

## Non-goals

Do not connect this ingest path to wallets, feedback trust, private keys, secrets, deployments, production data, or real-world assets.
