# Agent Harness Guardians

IOCALC Agent Env exposes a small guardian API for harness builders that need a
deterministic check before model context, tool calls, memory writes, or workflow
actions are allowed to proceed.

The guardian is not a model prompt and not a replacement for sandboxing. It is a
typed policy gate that classifies untrusted inputs and returns a sanitized
verdict that other harness code can enforce.

## What It Protects

- Prompt poisoning from issues, PRs, comments, web pages, artifacts, memory, or
  model output.
- Attempts to read secrets, tokens, OIDC data, environment variables, or
  `/proc/self/environ`.
- Tool escalation to GitHub writes, shell/code execution, external fetches,
  package publishing, deployments, wallets, payments, or financial authority.
- Unreviewed changes to workflow token permissions such as `id-token: write`,
  `contents: write`, `issues: write`, `pull-requests: write`, or `write-all`.

## Runtime API

```ts
import { evaluateIocalcGuardian } from "@iocalc/protocol";

const evaluation = evaluateIocalcGuardian({
  subjectKind: "prompt",
  trustZone: "untrusted-issue",
  text: issueBody,
  requestedTool: "github.issue.edit",
  requestedAction: "write to issue"
});

if (!evaluation.safeToExecuteTools) {
  // Do not call tools. Store evaluation.sanitizedSummary and findings instead.
}
```

Safe sandbox gameplay can pass:

```ts
const evaluation = evaluateIocalcGuardian({
  subjectKind: "game-command",
  trustZone: "sandbox-gameplay",
  text: "repair wall and gather wood",
  requestedTool: "iocalc.submit_command",
  requestedCapabilities: ["canSubmitGameCommand"]
});
```

## Verdicts

- `allow`: bounded sandbox action may proceed.
- `review`: trusted or reviewed content produced warning-level findings; a
  human or higher-level policy should decide.
- `quarantine`: untrusted content produced block-level findings. Do not send it
  into a privileged model/tool loop.
- `block`: trusted content still requested forbidden authority. Do not execute.

`safeToSendToModel` and `safeToExecuteTools` are explicit so harnesses do not
need to infer behavior from free text.

## Trust Zones

Use the narrowest trust zone:

- `sandbox-gameplay`: direct bounded game commands.
- `trusted-operator`: an operator action outside untrusted data flow.
- `maintainer-reviewed`: content that already passed human review.
- `untrusted-issue`, `untrusted-pr`, `untrusted-comment`, `untrusted-web`, or
  `untrusted-artifact`: public or external content.
- `agent-memory` and `model-output`: previous agent output and memory remain
  untrusted unless promoted by tracked review.

## Harness Pattern

1. Classify the source before concatenating it into any model prompt.
2. Call `evaluateIocalcGuardian()` with requested tool/action/capability data.
3. If the result is `quarantine` or `block`, stop tool execution and log only
   the sanitized summary plus typed findings.
4. If the result is `review`, require operator approval before any write,
   publish, deploy, shell, network, or workflow-token action.
5. If the result is `allow`, continue through the existing adapter, MCP, and
   governance ledger boundaries.

The guardian result includes a normal IOCALC sandbox `boundary` decision so it
can be recorded alongside other conformance and governance evidence.

## Conformance

`@iocalc/conformance` exports `runGuardianConformance()`. It checks that:

- safe sandbox game commands are allowed;
- poisoned issue text is quarantined;
- workflow token authority requests are blocked;
- model-originated code execution and secret access requests are blocked;
- guardian summaries do not reflect the dangerous raw text.

Aggregate adapter checks include these static guardian fixtures through
`runAdapterConformance()`.

## Boundary

The guardian adds evaluation and evidence only. It does not grant wallet,
private-key, secret, account, session, production, deployment, shell, network,
GitHub write, package publishing, or financial authority.
