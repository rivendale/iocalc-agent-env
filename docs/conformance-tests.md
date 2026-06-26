# Conformance Tests

The conformance package verifies that an adapter or IOCALC-compatible implementation preserves the sandbox-only contract.

## Initial checks

- `getCapabilities()` returns safe capability flags.
- Wallet actions remain disabled.
- Feedback cannot mutate gameplay.
- External URL fetching remains disabled.
- Code execution remains disabled.
- Secrets access remains disabled.
- Production mutation remains disabled.
- State/report/log/match-history can be read when the target supports those calls.

## Future checks

- Same seed plus same starting state plus same command resolves deterministically.
- Commands are treated as untrusted game text.
- Browser selectors exist and are stable.
- Agent trial transcript contains state, command, resolution, report, and log events.
- Loop transcript entries can record objective, hypothesis, action,
  observedOutcome, verifierNotes, and nextPolicy without mutating game logic.
- Game-theory pattern reports can explain payoff, signaling, repeated-game, or
  equilibrium-break tradeoffs without adding market data or financial behavior.
