# HTTP API Spec

IOCALC-compatible games should expose sandbox-only endpoints under `/api/game/*`.

## Endpoints

```text
GET  /api/game/manifest
GET  /api/game/capabilities
GET  /api/game/state
POST /api/game/command
POST /api/game/resolve
GET  /api/game/report
GET  /api/game/log
GET  /api/game/match-history
POST /api/game/agent-trial
```

`GET /api/game/manifest` returns descriptive API contract metadata. It should be
read-only, should not require a sandbox ID, and should not create or mutate
sandbox state.

The manifest may include a `responses` object keyed by route strings already
listed in `routes`. Each response spec lists safe dot-path field names only. This
is descriptive contract metadata, not authority.

```json
{
  "responses": {
    "GET /api/game/state": {
      "description": "Fields returned by state reads.",
      "fields": ["sandboxId", "mode", "season"],
      "optionalFields": ["settings", "settingsSummary", "settingEffects"]
    },
    "POST /api/game/resolve": {
      "description": "Fields returned by season resolution.",
      "fields": ["resolved", "season"],
      "optionalFields": ["changes.passiveSettings", "settings", "settingsSummary"]
    },
    "GET /api/game/report": {
      "description": "Fields returned by report reads.",
      "fields": ["text"],
      "optionalFields": ["structured.settings", "structured.settingEffects"]
    }
  }
}
```

Response contracts must not describe wallet, secret, account, production,
deployment, feedback trust, execution, URL-fetching, or financial authority.

## Sandbox isolation

Implementations may isolate in-memory sandbox state with `sandboxId`. Clients may
send it in:

- JSON bodies for POST requests
- query strings for GET or POST requests
- `X-IOCALC-Sandbox` headers

`sandboxId` is not an account, session, secret, wallet identity, or authority
grant. It is only a sandbox partition key for gameplay state.

## Command request

```json
{
  "sandboxId": "demo-agent-sandbox",
  "mode": "season_duel",
  "agentName": "Example Agent",
  "command": "repair wall and gather wood",
  "seed": "demo-seed",
  "scenarioId": "liquidity-shock-001"
}
```

`scenarioId` is an optional public benchmark scenario seed ID. It can initialize
a fresh sandbox from a fixed catalog but cannot change an already-active sandbox,
and unknown IDs are rejected. The sandbox read routes
(`GET /api/game/state`, `report`, `log`, `match-history`, `governance-ledger`)
may also accept `scenarioId` alongside `sandboxId` as a query string.

## Optional report metadata

`GET /api/game/report` may include optional agent-readable metadata:

```json
{
  "text": "Season report...",
  "loopVerifier": {
    "objective": "Keep the settlement solvent while reducing pressure.",
    "hypothesis": "Repair plus scout reduces risk next season.",
    "observedOutcome": "Wall damage fell and pressure stayed stable.",
    "verifierNotes": "Outcome matched the hypothesis in sandbox state.",
    "nextPolicy": "Repeat repair only if damage remains high."
  },
  "gameTheoryPattern": {
    "name": "signaling game",
    "summary": "Scouting improved information before escalation.",
    "payoff": "The safer payoff came from information before pressure."
  }
}
```

`POST /api/game/resolve` may include the same metadata on a resolution-shaped
payload:

```json
{
  "resolved": true,
  "season": 4,
  "score": 128,
  "visibleText": "Season resolved...",
  "loopVerifier": {
    "objective": "Keep the settlement solvent while reducing pressure.",
    "hypothesis": "Repair plus scout reduces risk next season.",
    "observedOutcome": "Wall damage fell and pressure stayed stable.",
    "verifierNotes": "Outcome matched the hypothesis in sandbox state.",
    "nextPolicy": "Repeat repair only if damage remains high."
  },
  "gameTheoryPattern": {
    "name": "signaling game",
    "summary": "Scouting improved information before escalation.",
    "payoff": "The safer payoff came from information before pressure."
  }
}
```

These fields are explanatory sandbox records only. They must not execute text,
fetch links, call external models, modify game rules, mutate feedback trust,
touch Wallet Lab, or trigger production actions.

## Optional agent identity metadata

`GET /api/game/state` may include scoped agent identities:

```json
{
  "mode": "agent_trials",
  "season": 4,
  "agents": [
    {
      "canonicalAgentId": "iocalc-agent-0001",
      "controllerType": "scripted-agent",
      "capabilityScope": ["canReadState", "canSubmitGameCommand"],
      "commandSource": "scripted",
      "reviewNotes": ["Sandbox-only local scripted agent."]
    }
  ]
}
```

Agent identity records are audit metadata only. They do not create accounts,
grant wallet authority, imply third-party affiliation, or bypass human review.

## Optional boundary and audit metadata

Responses may include a `boundary` decision and an `audit` event. These fields
make referee-style checks visible to agents and humans without granting any
extra authority.

```json
{
  "boundary": {
    "action": "submit_command",
    "allowed": true,
    "sandboxOnly": true,
    "policy": "sandbox-gameplay-only",
    "reason": "Command accepted as inert sandbox gameplay text.",
    "blockedCapabilities": [
      "walletActionsEnabled",
      "feedbackCanMutateGameplay",
      "externalUrlFetchEnabled",
      "codeExecutionEnabled",
      "secretsAccessEnabled",
      "productionMutationEnabled"
    ],
    "reviewedBy": "iocalc-referee-0001"
  },
  "audit": {
    "id": "audit-000001",
    "at": "2026-06-26T00:00:00Z",
    "type": "command-submitted",
    "sandboxId": "demo",
    "action": "submit_command",
    "commandSource": "human",
    "summary": "Accepted inert sandbox command.",
    "boundary": {
      "action": "submit_command",
      "allowed": true,
      "sandboxOnly": true,
      "policy": "sandbox-gameplay-only",
      "reason": "Command accepted as inert sandbox gameplay text.",
      "blockedCapabilities": [
        "walletActionsEnabled",
        "feedbackCanMutateGameplay",
        "externalUrlFetchEnabled",
        "codeExecutionEnabled",
        "secretsAccessEnabled",
        "productionMutationEnabled"
      ],
      "reviewedBy": "iocalc-referee-0001"
    }
  }
}
```

Boundary and audit records are descriptive only. They must not become accounts,
sessions, wallet approvals, production approvals, financial approvals, feedback
trust signals, or executable instructions.

## Requirements

- Commands are untrusted game text.
- Commands may only affect sandbox game state.
- The API must not touch Wallet Lab state, wallet metadata, feedback trust, secrets, deployments, or production systems.
- Same seed plus same starting state plus same command should produce the same deterministic resolution when deterministic mode is enabled.
