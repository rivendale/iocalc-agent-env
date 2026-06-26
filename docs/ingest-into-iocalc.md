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

## Stable browser selectors

Add these selectors to the play UI so browser agents and Playwright tests can operate the same public surface as a human:

```text
data-testid="season-command"
data-testid="resolve-season"
data-testid="season-report"
data-testid="system-log"
data-testid="match-history"
data-testid="agent-trials-panel"
```

## Non-goals

Do not connect this ingest path to wallets, feedback trust, private keys, secrets, deployments, production data, or real-world assets.
