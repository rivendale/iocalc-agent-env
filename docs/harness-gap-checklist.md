# Harness Gap Checklist

This checklist converts external harness and multi-agent references into
concrete IOCALC Agent Env review items. It is a planning and conformance aid,
not a grant of new authority.

IOCALC Agent Env remains sandbox-only. Nothing here permits wallet actions,
secrets access, account/session authority, arbitrary URL fetching, code
execution, production mutation, feedback trust mutation, or financial
functionality.

## Reference Inputs

- `ai-boost/awesome-harness-engineering`: harness taxonomy for loops, context,
  tools, permissions, memory, orchestration, verification, and observability.
- `mco-org/squad`: one-shot CLI plus SQLite coordination between terminal
  agents.
- `johannesjo/parallel-code`: per-agent worktree isolation, reviewable diffs,
  task notes, and operator control.
- `BayramAnnakov/claude-reflect`: human-reviewed correction capture and reusable
  skill discovery.
- `paperclipai/paperclip`: goals, tickets, heartbeats, budgets, org charts,
  governance, and audit logs.
- `kstevica/captain-claw`: blind ensembles, councils, shared blackboards, plan
  mode, reliability weighting, and deterministic flow ideas.
- `amanaiproduct/personal-os`: backlog, goals, P0/P1 limits, knowledge base, and
  session eval workflow.
- `vibheksoni/stealth-browser-mcp`: MCP tool ergonomics and browser lifecycle
  safeguards. Anti-bot bypass behavior is out of scope.

## Loop Contract

- [ ] Every agent loop records `observe`, `command`, `resolve`, `verify`, and
  `revise` evidence when the transport supports transcripts.
- [ ] `verify` is externally checkable: report metrics, conformance result,
  score delta, fallback rate, or ledger entry.
- [ ] Stopping conditions avoid agent self-claims and use season count, score
  threshold, conformance pass, or budget/timeout limits.
- [ ] Revisions are stored as inert next-policy notes unless a human-reviewed
  code or configuration change promotes them.

## Context Delivery

- [ ] Manifest, state, report, log, match history, and governance ledger outputs
  use stable field names across HTTP, browser, MCP, manual, and local adapters.
- [ ] Context records identify sandbox ID, command source, controller type,
  scenario ID when present, and fallback/timeout status.
- [ ] Prior-run memory is explicitly labeled as memory, not live state.
- [ ] Public scenario seeds are attached as immutable context and cannot mutate
  an active sandbox after initialization.

## Tool Interface

- [ ] MCP tools remain a thin bridge over the same adapter contract.
- [ ] Tool schemas are closed and reject unexpected fields.
- [ ] Tool errors do not reflect caller-controlled unsafe strings.
- [ ] Read tools are read-only and accept no arguments unless the contract
  explicitly requires a sandbox selector.
- [ ] Write tools accept only bounded sandbox gameplay input.
- [ ] Browser adapters use fixed IOCALC selectors and never evaluate page
  JavaScript, follow command links, or browse arbitrary URLs.

## Permissions and Boundaries

- [ ] Every adapter publishes or implies an allowed capability scope.
- [ ] Forbidden capabilities are tested: wallet, private key, secret,
  deployment, production, account/session, arbitrary fetch, code execution,
  feedback trust mutation, and financial advice.
- [ ] Boundary rejections are generic enough to avoid leaking or echoing unsafe
  input.
- [ ] Governance ledger entries remain evidence only and never act as
  permissions.
- [ ] New reference-inspired features must pass `runIocalcMcpToolBridgeConformance`
  or an equivalent adapter conformance suite before publication.

## Multi-Agent Coordination

- [ ] Agent IDs are canonical, stable, and scoped to a sandbox or trial.
- [ ] Role metadata is inert: manager, worker, inspector, councilor, reporter,
  and verifier roles do not grant authority outside gameplay.
- [ ] Task state supports assigned, acknowledged, completed, requeued, skipped,
  and timed-out statuses when multi-agent coordination is enabled.
- [ ] Message history records sender, recipient, task ID, timestamp, source
  transport, and whether the message was broadcast.
- [ ] Parallel agents cannot collide on one mutable sandbox without an explicit
  merge, vote, or resolver step.
- [ ] Shared-board modes record ownership of sections and final reporter output.

## Isolation

- [ ] Each trial run uses a unique sandbox ID or equivalent state partition.
- [ ] Code-editing agents operate in separate branches or worktrees when they
  are working in parallel.
- [ ] Runtime artifacts, downloaded reports, and generated benchmark results
  write to gitignored local paths until explicitly promoted.
- [ ] Agent-generated plans, notes, and corrections are reviewed before merging
  into tracked instructions or benchmark manifests.

## Memory and Learning

- [ ] Corrections are captured as proposed learnings with source, confidence,
  affected target, and review status.
- [ ] Approved learnings can update docs, skills, prompts, benchmark scenarios,
  or conformance tests only through normal tracked-file review.
- [ ] Rejected learnings remain auditable if retained, but they are not injected
  into future context.
- [ ] Repeated workflow patterns can become skills only after a human-readable
  draft and a deterministic verification path exist.

## Observability

- [ ] Every trial can produce a compact transcript suitable for replay review.
- [ ] Budget, timeout, fallback, and repair events are visible in reports or
  ledger entries.
- [ ] Agent Trial outputs include command, rationale, source, resolver result,
  verifier result, and next-policy notes when available.
- [ ] Publication gates distinguish raw runs, provisional summaries, confidence
  gates, and public leaderboard claims.

## Game-Mechanic Candidates

- [ ] Blind ensemble mode: independent commands, separate rationales, deterministic
  merge/vote rule, visible disagreement notes.
- [ ] Council mode: round-based visible discussion, bounded turns, vote,
  synthesized command, and reporter output.
- [ ] Shared-board mode: per-agent ownership, waits/timeouts, final assembly, and
  visible skipped-agent handling.
- [ ] Advisor budget mode: roles, cost limits, and deterministic spend outcomes.
- [ ] Reserve-allocation scenario: settlement risk/reward tradeoffs framed as
  game economy, never personal financial advice.

## Out-of-Scope Reference Ideas

- Native C++ engine migration.
- Anti-bot bypass tooling.
- Real financial recommendations.
- Autonomous production deployment.
- Tool access that expands beyond the sandbox contract.

