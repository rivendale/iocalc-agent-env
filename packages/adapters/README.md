# @iocalc/adapters

Transport adapters for the IOCALC sandbox agent protocol.

## Includes

- `ManualTranscriptAdapter` for transcript-driven tests.
- `HttpIocalcAdapter` for `/api/game/*` sandbox endpoints.
- `BrowserIocalcAdapter` for fixed-selector browser play.
- `createIocalcAdapter` helper for transport selection.

## Boundary

Adapters submit bounded sandbox game commands and read sandbox evidence. They do
not execute submitted text, follow command links, fetch arbitrary URLs, or touch
wallets, secrets, accounts, production state, feedback trust, or financial
systems.

## License

`MIT-0 OR Apache-2.0`
