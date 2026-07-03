# Local Multi-Agent Coordination Spike

This spike translates `mco-org/squad` and related operator references into a
small IOCALC-compatible coordination experiment. It is a design plan only. It
does not require installing third-party tools and does not add runtime
dependencies.

## Goal

Test whether a simple local coordination layer improves Agent Trials evidence
without expanding authority beyond the sandbox gameplay contract.

The first spike should answer:

- Can multiple local agents exchange task assignments and reports?
- Can the transcript be replayed or audited?
- Can a manager/worker/inspector pattern produce better candidate commands?
- Can coordination failures be recorded without hidden mutation?

## Allowed Local Files

Use gitignored local state until the schema is reviewed:

```text
builds/agent-coordination/
builds/agent-coordination/messages.db
builds/agent-coordination/transcripts/*.json
```

Tracked fixtures may be added later under `fixtures/` only after the shape is
stable and scrubbed.

## Minimal Command Vocabulary

An IOCALC-native spike can mirror the useful `squad` concepts:

```text
iocalc-coord init
iocalc-coord join <agent-id> --role <role>
iocalc-coord agents
iocalc-coord task create <from> <to> --title <title> --body <body>
iocalc-coord task ack <agent-id> <task-id>
iocalc-coord task complete <agent-id> <task-id> --summary <summary>
iocalc-coord send <from> <to> <message>
iocalc-coord receive <agent-id>
iocalc-coord history
iocalc-coord export --trial-id <id>
```

These commands should write coordination evidence only. They should not call
LLMs, resolve seasons, browse URLs, execute submitted game text, or mutate
production state.

## Roles

- `manager`: decomposes the visible game objective into bounded assignments.
- `worker`: proposes a command and rationale for one assignment.
- `inspector`: checks boundary, validity, and missing evidence.
- `reporter`: assembles an exportable transcript.

Roles are inert metadata. They do not grant adapter, wallet, account,
deployment, feedback trust, or production authority.

## Evidence Schema Sketch

```json
{
  "trialId": "local-coord-001",
  "sandboxId": "local-agent-001",
  "agents": [
    {
      "agentId": "iocalc-agent-0001",
      "role": "manager",
      "joinedAt": "2026-07-03T00:00:00Z"
    }
  ],
  "tasks": [
    {
      "taskId": "task-001",
      "from": "iocalc-agent-0001",
      "to": "iocalc-agent-0002",
      "status": "completed",
      "title": "Propose a repair-first command",
      "summary": "repair wall and gather wood"
    }
  ],
  "messages": [],
  "selectedCommand": "repair wall and gather wood",
  "inspectorNotes": "Valid sandbox gameplay command"
}
```

## Safety Checks

- Reject links, shell-like text, code blocks, secrets, private keys, wallet
  terms, deployment terms, production terms, account/session authority claims,
  and real financial advice in task bodies and messages.
- Limit message length and use ASCII-only text for the first spike.
- Keep database and transcript paths under the allowed local directory.
- Export only sanitized JSON.
- Require a separate adapter call to submit or resolve a command.

## Failure Cases To Test

- Duplicate agent IDs are suffixed or rejected deterministically.
- A worker times out or never acknowledges a task.
- A worker submits an unsafe or invalid command.
- The manager sends conflicting assignments.
- The inspector rejects all candidates.
- The selected command cannot be parsed by IOCALC.

## Success Criteria

- The spike can export a compact transcript from a manager, worker, and
  inspector run.
- Exported transcript can be validated without the SQLite database.
- The selected command remains a normal adapter `submitCommand()` input.
- No coordination command expands the sandbox capability scope.

