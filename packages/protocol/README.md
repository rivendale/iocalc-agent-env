# @iocalc/protocol

Shared TypeScript contract for sandbox-only IOCALC agent clients.

## Includes

- IOCALC player adapter interfaces.
- Safe and forbidden capability types.
- Runtime validators for game commands, capabilities, manifests, boundary
  decisions, audit events, and governance ledgers.
- Guardian policy evaluation for prompt poisoning, secret/env exfiltration,
  workflow-token authority, external fetches, code execution, and unsafe tool
  requests.
- Transcript helpers for observe, command, resolve, report, and log flows.

## Boundary

This package models sandbox gameplay only. It does not grant wallet, private
key, secret, production deployment, arbitrary URL fetch, code execution,
feedback trust, account, session, or financial authority.

## License

`MIT-0 OR Apache-2.0`
