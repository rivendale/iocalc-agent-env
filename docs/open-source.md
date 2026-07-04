# Open Source Readiness

`iocalc-agent-env` is the open-source integration surface for IOCALC agents. It
is intentionally separate from the private game repository so external agents
and client authors can build against stable contracts without receiving game
runtime authority.

## License

The repository is dual-licensed under:

- `MIT-0`
- `Apache-2.0`

SPDX expression:

```text
MIT-0 OR Apache-2.0
```

Use `MIT-0` when a frictionless no-attribution grant is preferred. Use
`Apache-2.0` when the explicit patent grant and notice terms are preferred.

## Reusable Surface

The intended reusable surface is:

- `@iocalc/protocol`
- `@iocalc/adapters`
- `@iocalc/conformance`
- `@iocalc/mcp-server`
- docs under `docs/`
- examples under `examples/`

This repo does not grant authority over wallet actions, private keys, secrets,
production deployment, arbitrary URL fetching, code execution, feedback trust,
accounts, sessions, or financial functionality.

## Metadata Check

Run the license check after changing package metadata or license files:

```bash
pnpm license:check
```

The check verifies:

- the root license summary advertises `MIT-0 OR Apache-2.0`;
- full MIT-0 and Apache-2.0 license texts are present;
- publishable workspace packages use the same SPDX expression.

`pnpm check` also runs this guard.
