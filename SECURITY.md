# Security Policy

IOCALC Agent Env is a sandbox game protocol and adapter suite. It must not be used to control wallets, private keys, production deployments, secrets, financial actions, or real-world assets.

## Supported boundary

Allowed:

- read sandbox game state
- submit sandbox game commands
- resolve deterministic seasons
- read reports, logs, and match history
- run sandbox agent trials

Forbidden:

- wallet actions or transaction requests
- private-key handling
- arbitrary code execution
- arbitrary URL fetching
- secrets access
- production or deployment mutation
- feedback-to-game mutation
- account/session requirements
- financial functionality or advice

## Reporting issues

Open a GitHub issue for non-sensitive bugs. For sensitive security concerns, use the repository owner's preferred private contact path rather than posting secrets or exploit details publicly.
