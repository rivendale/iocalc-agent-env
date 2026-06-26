# Loop Engineering for IOCALC

IOCALC uses loops to teach agent design. A loop is a repeatable sandbox cycle
that observes state, chooses a command, resolves a season, verifies the outcome,
and records what should change next.

This document describes the protocol vocabulary. It does not add automation,
wallet access, broker access, external model calls, accounts, deployments, or
financial functionality.

## Core Loop

```text
observe -> command -> resolve -> verify -> revise
```

- `observe`: read sandbox game state, visible reports, logs, and match history.
- `command`: submit bounded game text through the protocol.
- `resolve`: advance one deterministic sandbox season.
- `verify`: compare the outcome against the agent objective and constraints.
- `revise`: update the next sandbox command or local agent settings.

The loop never executes submitted text. Commands are untrusted gameplay input.

## Six Parts

### Automation

The heartbeat that starts a loop. In IOCALC this can be a human click, browser
test, local script, HTTP call, or MCP tool call. Automation must stay inside the
sandbox game contract.

### Skill

The durable instructions an agent uses for one role. In IOCALC this maps to
agent settings such as role, goal, constraints, strategy bias, risk level,
memory depth, fallback policy, and command style.

### State

The durable game record. In IOCALC this is state, season report, system log,
match history, and transcript entries.

### Verifier

The checker that decides whether the command helped. In IOCALC this should be a
separate report field or conformance check, not the command-writing agent
declaring itself correct.

### Isolation

The boundary that prevents parallel work from colliding. In code this means
branches or worktrees. In gameplay this means each match and agent trial has its
own sandbox state.

### Connectors

The transport an agent uses to play: manual transcript, browser, HTTP, MCP, or
local core. Connectors must not add new authority. They only normalize sandbox
gameplay.

## Transcript Fields

Future transcript events should be able to represent:

```json
{
  "objective": "Grow safely while reducing rival pressure",
  "hypothesis": "Repair plus scouting should reduce damage risk next season",
  "action": "repair wall and scout the rival",
  "observedOutcome": "Damage fell and pressure stayed stable",
  "verifierNotes": "Constraint satisfied; energy use was high",
  "nextPolicy": "Preserve more energy before expansion"
}
```

These fields are inert records. They must not mutate game logic automatically.

## Safe Stopping Conditions

Good stopping conditions are externally checkable:

- season count reached
- score delta recorded
- fallback rate below a threshold
- report contains command source and rationale
- conformance tests pass

Bad stopping conditions depend only on agent claims:

- "the agent says it is done"
- "the command looks good"
- "the strategy feels improved"

## Forbidden Scope

Loop engineering in IOCALC must not include:

- wallet actions or transaction requests
- private-key handling
- secrets access
- arbitrary URL fetching
- arbitrary code execution
- feedback-to-game mutation
- production or deployment mutation
- account/session requirements
- financial functionality or advice
