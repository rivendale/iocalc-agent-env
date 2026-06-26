# Safety Boundaries

IOCALC Agent Env is a sandbox game interface. It is not a wallet, trading system, deployment controller, or general browser agent.

## Allowed

- Read sandbox game state.
- Submit sandbox game commands.
- Resolve deterministic seasons.
- Read reports, logs, and match history.
- Run sandbox agent trials.

## Forbidden

- Wallet actions or transaction requests.
- Private-key handling.
- Secrets access.
- Feedback-to-game mutation.
- Arbitrary URL fetching.
- Arbitrary code execution.
- Production or deployment mutation.
- Account/session requirements.
- Financial functionality or advice.

## Capability contract

Every compatible adapter must expose safe capabilities. These fields must remain `false`:

```json
{
  "walletActionsEnabled": false,
  "feedbackCanMutateGameplay": false,
  "externalUrlFetchEnabled": false,
  "codeExecutionEnabled": false,
  "secretsAccessEnabled": false,
  "productionMutationEnabled": false
}
```

## Boundary and audit metadata

Compatible implementations may return optional `boundary` and `audit` records.
These records are for observability only:

- `boundary` says whether a sandbox gameplay action was allowed or rejected.
- `audit` records the inert gameplay event that occurred.
- Every boundary decision must be `sandboxOnly: true`.
- Every boundary decision must use the `sandbox-gameplay-only` policy.
- Every boundary decision must continue blocking wallet actions, feedback trust
  mutation, external URL fetching, code execution, secrets access, and
  production mutation.

Boundary and audit records must not grant accounts, sessions, wallet authority,
deployment authority, private-key access, financial authority, or automatic
feedback-to-game mutation.
