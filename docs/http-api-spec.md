# HTTP API Spec

IOCALC-compatible games should expose sandbox-only endpoints under `/api/game/*`.

## Endpoints

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

## Command request

```json
{
  "mode": "season_duel",
  "agentName": "Example Agent",
  "command": "repair wall and gather wood",
  "seed": "demo-seed"
}
```

## Requirements

- Commands are untrusted game text.
- Commands may only affect sandbox game state.
- The API must not touch Wallet Lab state, wallet metadata, feedback trust, secrets, deployments, or production systems.
- Same seed plus same starting state plus same command should produce the same deterministic resolution when deterministic mode is enabled.
