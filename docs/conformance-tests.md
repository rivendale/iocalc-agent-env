# Conformance Tests

The conformance package verifies that an adapter or IOCALC-compatible implementation preserves the sandbox-only contract.

## Initial checks

- `getCapabilities()` returns safe capability flags.
- Optional `getManifest()` returns a sandbox-only API contract when supported.
- If the manifest includes `responses`, required response fields are checked
  against live sandbox responses for state, resolve, and report routes.
- Wallet actions remain disabled.
- Feedback cannot mutate gameplay.
- External URL fetching remains disabled.
- Code execution remains disabled.
- Secrets access remains disabled.
- Production mutation remains disabled.
- State/report/log/match-history can be read when the target supports those calls.
- Browser adapters can run `runBrowserPlayConformance()` to verify fixed-selector
  play: read state, submit one safe command, resolve one season without a seed,
  read report/log/match-history, and keep Wallet Lab out of scope.
- MCP bridges can run `runIocalcMcpToolBridgeConformance()` to verify the fixed
  IOCALC sandbox tool list, closed input schemas, rejection of unsafe probes,
  and non-reflection of URL/key-like/wallet-like caller-controlled text in
  error results.

## Future checks

- Same seed plus same starting state plus same command resolves deterministically.
- Commands are treated as untrusted game text.
- Agent trial transcript contains state, command, resolution, report, and log events.
- Optional loop verifier, game-theory pattern, and agent identity records remain
  inert metadata when present.
- Loop transcript entries can record objective, hypothesis, action,
  observedOutcome, verifierNotes, and nextPolicy without mutating game logic.
- Game-theory pattern reports can explain payoff, signaling, repeated-game, or
  equilibrium-break tradeoffs without adding market data or financial behavior.
- Agent identity records can describe canonical IDs, controller types,
  sandbox-only capability scope, timeout/fallback events, and review notes
  without granting account, wallet, production, or third-party authority.

## HTTP example runner

With an IOCALC game server running locally, the HTTP example can run the shared
adapter conformance checks against `/api/game/*`:

```bash
IOCALC_BASE_URL=http://127.0.0.1:8090 IOCALC_SANDBOX_ID=local-check pnpm --filter @iocalc/example-http-player conformance
```

The sandbox ID is only a gameplay partition key. It must not be treated as an
account, session, wallet identity, or authorization token.
