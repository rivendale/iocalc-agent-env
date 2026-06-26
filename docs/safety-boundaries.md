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
