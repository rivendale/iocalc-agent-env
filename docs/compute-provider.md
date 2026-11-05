# Compute provider

Phase 1 adds one in-process compute provider so season planning can go through a
compute market without a hard-coded network. `SimulatedProvider` spends play
credits and returns a fake receipt. The receipt uses the same schema a later
verified provider would use, with `trustKind: "simulated"`.

This module does not open a socket, read credentials, or settle money. Play
credits are not transferable, tradable, or redeemable.

Real providers stay out of this cut. The live sandbox routes are unchanged.
Budget HTTP, plan routes, and scorecards are later issues and should call this
interface instead of growing a second planner.

## Interface

`ComputeProvider` in `@iocalc/protocol` has:

- `id`
- `capabilities()`
- `plan(request)`
- optional `verify(provenance)`

`plan` returns untrusted inert text plus provenance. `verify` checks that a
simulated receipt is intact. It returns a boolean and does not set
`verifiedLocally`. `plan` always returns `verifiedLocally: false`. A later
score step can record `verifiedLocally: true` only after `verify` returns true.

`capabilities()` reports `needsNetwork: false`, `needsApiKey: false`,
`pricedIn: "credits"`, and `realMoneyPaymentsEnabled: false`.

## Public flags

`COMPUTE_MARKET_PUBLIC_FLAGS` is the Phase 1 flag record:

```json
{
  "computeMarketEnabled": true,
  "computeProviders": ["sim"],
  "realMoneyPaymentsEnabled": false
}
```

`realMoneyPaymentsEnabled` is fixed false. The object is frozen.
`GET /api/game/capabilities` does not yet include these fields. When a later
change adds them to that route, it must copy this record and keep
`realMoneyPaymentsEnabled` false.

## Play credits

`PlayCreditLedger` is the in-process balance `SimulatedProvider` deducts.
`createInMemoryPlayCreditLedger` builds one from grants of `sandboxId`,
`trialId`, `maxCredits`, and `allowedProviders`. There is no method that raises
`maxCredits`. An unknown scope reads as zero and does not create a grant.

The request field `budgetCredits` is a per-call ceiling. A larger number does
not increase the grant. If the quoted cost is greater than the ceiling or the
remaining grant, `plan` returns `budget_exhausted`, charges nothing, and omits
the receipt hash. A grant whose `allowedProviders` list does not include `sim`
returns `provider_not_allowed` and also charges nothing.

The provisional price is `SIMULATED_CREDIT_PRICE`: 4 characters per planner
token, 1 play credit per input token, 1 play credit per output token, and an
output cap of 32 tokens. `quoteSimulatedPlan` returns that quote and does not
deduct. The exact Trial 001 table is still open. Replace the constant rather
than scattering a second rate.

## Receipt

A successful plan returns `providerId: "sim"`, `modelId: "sim-planner-v1"`, and
`trustKind: "simulated"`. `receiptOrAttestationHash` is a sha256 hex digest of
the public receipt fields (provider, model, trust kind, token counts, and
cost). It is not a signing key. The digest does not include the prompt.
`rawArtifactRef` is an opaque `sim-receipt-` id derived from that digest.

`costUsdEstimate` and `costTestFlopEstimate` exist on the shared provenance
type so later meters have a field. `SimulatedProvider` omits both.

A rejected plan uses `trustKind: "none"`, `costCredits: 0`, and no receipt
hash. That rejection is not a simulated receipt.

`requireTrust` accepts a plan when `simulated` is one of the listed kinds.
A list that does not include `simulated` fails closed without a charge.

## Draft OpenAPI fields

Draft only. These schemas are not in
`schemas/iocalc-agent-env-openapi-lite-v1.json`, and no `/api/game/compute/*`
route is registered. Field names match the in-process types so a later route
can reuse them.

```json
{
  "ComputeRequest": {
    "type": "object",
    "additionalProperties": false,
    "required": ["trialId", "sandboxId", "seasonOrStep", "prompt", "budgetCredits"],
    "properties": {
      "trialId": { "type": "string" },
      "sandboxId": { "type": "string" },
      "seasonOrStep": { "type": "integer", "minimum": 0 },
      "prompt": { "type": "string", "description": "Printable ASCII. Untrusted sandbox text." },
      "modelHint": { "type": "string" },
      "maxTokens": { "type": "integer", "minimum": 1 },
      "maxLatencyMs": { "type": "integer", "minimum": 0 },
      "budgetCredits": { "type": "integer", "minimum": 0, "description": "Per-call play-credit ceiling. Not money." },
      "requireTrust": {
        "type": "array",
        "items": { "type": "string", "enum": ["none", "simulated", "poi_receipt", "tee_attestation"] }
      }
    }
  },
  "ComputeProvenance": {
    "type": "object",
    "additionalProperties": false,
    "required": ["providerId", "modelId", "trustKind", "costCredits", "verifiedLocally"],
    "properties": {
      "providerId": { "type": "string", "enum": ["sim"] },
      "modelId": { "type": "string" },
      "trustKind": { "type": "string", "enum": ["none", "simulated", "poi_receipt", "tee_attestation"] },
      "inputTokens": { "type": "integer", "minimum": 0 },
      "outputTokens": { "type": "integer", "minimum": 0 },
      "costCredits": { "type": "integer", "minimum": 0, "description": "Play credits charged. Not money." },
      "costUsdEstimate": { "type": "number", "minimum": 0, "description": "Optional later meter. Omitted by sim. Not a charge." },
      "costTestFlopEstimate": { "type": "number", "minimum": 0, "description": "Optional later meter. Omitted by sim. Not a charge." },
      "receiptOrAttestationHash": { "type": "string", "pattern": "^[a-f0-9]{64}$", "description": "Digest of public receipt fields. Not a key." },
      "verifiedLocally": { "type": "boolean" },
      "rawArtifactRef": { "type": "string" }
    }
  },
  "ComputeResponse": {
    "type": "object",
    "additionalProperties": false,
    "required": ["text", "provenance"],
    "properties": {
      "text": { "type": "string", "description": "Untrusted inert advice. Empty when the plan did not run." },
      "provenance": { "$ref": "#/components/schemas/ComputeProvenance" },
      "error": {
        "type": "object",
        "additionalProperties": false,
        "required": ["code", "message"],
        "properties": {
          "code": {
            "type": "string",
            "enum": ["budget_exhausted", "invalid_request", "prompt_rejected", "trust_unavailable", "provider_not_allowed"]
          },
          "message": { "type": "string" }
        }
      }
    }
  },
  "ComputeMarketFlags": {
    "type": "object",
    "additionalProperties": false,
    "required": ["computeMarketEnabled", "computeProviders", "realMoneyPaymentsEnabled"],
    "properties": {
      "computeMarketEnabled": { "type": "boolean" },
      "computeProviders": { "type": "array", "items": { "type": "string", "enum": ["sim"] } },
      "realMoneyPaymentsEnabled": { "type": "boolean", "const": false }
    }
  }
}
```

Phase 1 flag example:

```json
{
  "computeMarketEnabled": true,
  "computeProviders": ["sim"],
  "realMoneyPaymentsEnabled": false
}
```

## Test

```bash
pnpm --filter @iocalc/protocol test
```

The suite covers budget exhaustion without a partial deduction, the receipt
field shape, and `realMoneyPaymentsEnabled` staying false.
