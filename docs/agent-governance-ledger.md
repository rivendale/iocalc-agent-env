# Agent Governance Ledger

The Agent Governance Ledger is a sandbox-only evidence format for IOCALC agent
play. It records who acted, which sandbox transport was used, what boundary
decision applied, and what local evidence was observed.

It is not authentication, account authority, wallet authority, production
approval, feedback trust, financial advice, or deployment control.

## What It Records

- agent sessions with canonical IOCALC IDs
- safe capability scope and blocked capabilities
- sandbox tool calls and gameplay actions
- timeouts, fallbacks, conformance checks, and adversarial reviews
- failure-state routing such as rewrite, decompose, focus, exit, referee-review,
  or fallback
- contamination signals across agent-to-agent topology hops
- scenario or Monte Carlo style risk bands for sandbox uncertainty
- optional public scenario seed context (`scenarioId` plus a fixed `scenario`
  record) when a sandbox was initialized from a published benchmark scenario
- MCP connector and local compounder-agent actors (`mcp-connector` and
  `compounder-agent` controller types) alongside the existing local controllers
- deterministic non-cryptographic evidence fingerprints and previous-entry
  linkage

## Safety Rules

Ledger text is untrusted and inert. It must not be executed, fetched, ingested
as gameplay logic, or treated as a permission grant.

Every session policy must keep these boundaries enabled:

- sandbox-only state
- submitted text is untrusted
- no wallet authority
- no secrets access
- no production mutation
- no external URL fetching
- no code execution
- no feedback trust mutation
- no financial functionality
- human review required for authority changes

## Paper-Informed Patterns

Skill-RAG suggests that failures should be typed and routed. The ledger captures
typed `failureState` records instead of treating every failed agent action as a
generic retry.

ThoughtVirus suggests that multi-agent systems can propagate hidden bias through
ordinary agent messages. The ledger captures `contamination` hop metadata and a
quarantine recommendation without executing or trusting the message content.

Monte Carlo robustness testing suggests that observed outcomes should be viewed
as distributions, not single lucky traces. The ledger supports optional `riskBand`
percentiles for sandbox metrics.

## Validation

Use `assertAgentGovernanceLedger(ledger)` for runtime validation and
`runAgentGovernanceLedgerConformance(ledger)` in compatibility suites. These
checks reject unsafe text, broken evidence chains, expanded authority, unsupported
agent IDs, prototype/accessor payloads, and non-sandbox boundary metadata.
