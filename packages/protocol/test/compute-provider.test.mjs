import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COMPUTE_MARKET_PUBLIC_FLAGS,
  SIMULATED_CREDIT_PRICE,
  SimulatedProvider,
  assertComputeProvenance,
  assertComputeResponse,
  createInMemoryPlayCreditLedger,
  quoteSimulatedPlan
} from "../dist/index.js";

const scope = {
  sandboxId: "sandbox-001",
  trialId: "trial-001"
};

const baseRequest = {
  trialId: scope.trialId,
  sandboxId: scope.sandboxId,
  seasonOrStep: 3,
  prompt: "Repair the wall and gather wood before night.",
  budgetCredits: 10000
};

function grant(maxCredits, allowedProviders = ["sim"]) {
  return createInMemoryPlayCreditLedger([
    {
      sandboxId: scope.sandboxId,
      trialId: scope.trialId,
      maxCredits,
      allowedProviders
    }
  ]);
}

test("public capability flags keep real money disabled", () => {
  assert.equal(COMPUTE_MARKET_PUBLIC_FLAGS.realMoneyPaymentsEnabled, false);
  assert.equal(COMPUTE_MARKET_PUBLIC_FLAGS.computeMarketEnabled, true);
  assert.deepEqual([...COMPUTE_MARKET_PUBLIC_FLAGS.computeProviders], ["sim"]);
  assert.throws(() => {
    COMPUTE_MARKET_PUBLIC_FLAGS.realMoneyPaymentsEnabled = true;
  });
  assert.throws(() => {
    COMPUTE_MARKET_PUBLIC_FLAGS.computeProviders.push("other");
  });
});

test("simulated pricing quote is deterministic and does not deduct", () => {
  const ledger = grant(10000);
  const before = ledger.remaining(scope);
  const short = quoteSimulatedPlan({ ...baseRequest, prompt: "abcd", budgetCredits: 0 });
  assert.equal(SIMULATED_CREDIT_PRICE.charsPerToken, 4);
  assert.equal(SIMULATED_CREDIT_PRICE.defaultMaxOutputTokens, 32);
  assert.equal(SIMULATED_CREDIT_PRICE.creditsPerInputToken, 1);
  assert.equal(SIMULATED_CREDIT_PRICE.creditsPerOutputToken, 1);
  assert.deepEqual(short, { inputTokens: 1, outputTokens: 1, costCredits: 2 });

  const capped = quoteSimulatedPlan({
    ...baseRequest,
    prompt: "a".repeat(200),
    budgetCredits: 1000
  });
  assert.deepEqual(capped, { inputTokens: 50, outputTokens: 24, costCredits: 74 });

  const tighter = quoteSimulatedPlan({
    ...baseRequest,
    prompt: "a".repeat(200),
    maxTokens: 8,
    budgetCredits: 1000
  });
  assert.deepEqual(tighter, { inputTokens: 50, outputTokens: 8, costCredits: 58 });
  assert.equal(ledger.remaining(scope), before);
  assert.throws(() => quoteSimulatedPlan({ ...baseRequest, prompt: "" }));
});

test("one output token refuses advice beyond four characters", async () => {
  const ledger = grant(100);
  const provider = new SimulatedProvider(ledger);
  const request = { ...baseRequest, prompt: "abcd", maxTokens: 1 };
  const response = await provider.plan(request);
  assert.equal(response.error, undefined);
  assert.equal(response.text, "Seas");
  assert.equal(response.provenance.outputTokens, Math.ceil(response.text.length / 4));
  assert.deepEqual(quoteSimulatedPlan(request), { inputTokens: 1, outputTokens: 1, costCredits: 2 });
  assert.equal(ledger.remaining(scope), 98);
  assert.equal(await provider.verify(response.provenance), true);
});

test("output usage charges only returned advice when the cap exceeds its length", async () => {
  const ledger = grant(1000);
  const provider = new SimulatedProvider(ledger);
  const request = { ...baseRequest, prompt: "a".repeat(200), maxTokens: 32 };
  const response = await provider.plan(request);
  const outputTokens = Math.ceil(response.text.length / 4);
  assert.equal(response.provenance.outputTokens, outputTokens);
  assert.equal(response.provenance.costCredits, 50 + outputTokens);
  assert.equal(quoteSimulatedPlan(request).outputTokens, outputTokens);
  assert.equal(ledger.remaining(scope), 1000 - 50 - outputTokens);
  assert.equal(await provider.verify(response.provenance), true);
});

test("empty trust requirement refuses before any deduction", async () => {
  let deductions = 0;
  const ledger = grant(100);
  const provider = new SimulatedProvider({
    remaining: (value) => ledger.remaining(value),
    deduct: (...args) => { deductions += 1; return ledger.deduct(...args); }
  });
  const response = await provider.plan({ ...baseRequest, requireTrust: [] });
  assert.equal(response.error?.code, "trust_unavailable");
  assert.equal(response.text, "");
  assert.equal(response.provenance.trustKind, "none");
  assert.equal(response.provenance.costCredits, 0);
  assert.equal(Object.hasOwn(response.provenance, "receiptOrAttestationHash"), false);
  assert.equal(deductions, 0);
  assert.equal(ledger.remaining(scope), 100);
  assertComputeResponse(response);
});

test("budget exhaustion fails closed without a partial deduction", async () => {
  const request = { ...baseRequest, prompt: "abcd", budgetCredits: 100 };
  const quote = quoteSimulatedPlan(request);
  assert.ok(quote.costCredits > 1);
  const ledger = grant(quote.costCredits - 1);
  const provider = new SimulatedProvider(ledger);
  const response = await provider.plan(request);

  assert.equal(response.error?.code, "budget_exhausted");
  assert.equal(response.text, "");
  assert.equal(response.provenance.trustKind, "none");
  assert.equal(response.provenance.costCredits, 0);
  assert.equal(response.provenance.verifiedLocally, false);
  assert.equal(Object.hasOwn(response.provenance, "receiptOrAttestationHash"), false);
  assert.equal(ledger.remaining(scope), quote.costCredits - 1);
  assertComputeResponse(response);
});

test("a plan deducts quoted play credits until the grant is gone", async () => {
  const request = { ...baseRequest, prompt: "abcd", budgetCredits: 100 };
  const quote = quoteSimulatedPlan(request);
  const ledger = grant(quote.costCredits);
  const provider = new SimulatedProvider(ledger);

  const first = await provider.plan(request);
  assert.equal(first.error, undefined);
  assert.equal(Object.hasOwn(first, "error"), false);
  assert.equal(first.provenance.trustKind, "simulated");
  assert.equal(first.provenance.costCredits, quote.costCredits);
  assert.equal(first.provenance.inputTokens, quote.inputTokens);
  assert.equal(first.provenance.outputTokens, quote.outputTokens);
  assert.equal(ledger.remaining(scope), 0);

  const second = await provider.plan({ ...request, budgetCredits: 999999 });
  assert.equal(second.error?.code, "budget_exhausted");
  assert.equal(second.provenance.costCredits, 0);
  assert.equal(ledger.remaining(scope), 0);
});

test("request budgetCredits cannot raise or overspend the grant", async () => {
  const request = { ...baseRequest, prompt: "abcd", budgetCredits: 1 };
  const ledger = grant(10000);
  const provider = new SimulatedProvider(ledger);
  const blocked = await provider.plan(request);
  assert.equal(blocked.error?.code, "budget_exhausted");
  assert.equal(ledger.remaining(scope), 10000);

  const quote = quoteSimulatedPlan({ ...baseRequest, prompt: "abcd", budgetCredits: 10000 });
  const exact = grant(quote.costCredits);
  const exactProvider = new SimulatedProvider(exact);
  const spent = await exactProvider.plan({ ...baseRequest, prompt: "abcd", budgetCredits: quote.costCredits + 5000 });
  assert.equal(spent.provenance.costCredits, quote.costCredits);
  assert.equal(exact.remaining(scope), 0);
});

test("successful plan returns a simulated receipt with the shared schema", async () => {
  const ledger = grant(10000);
  const provider = new SimulatedProvider(ledger);
  const caps = provider.capabilities();
  assert.equal(provider.id, "sim");
  assert.equal(typeof provider.verify, "function");
  assert.deepEqual([...caps.trustKinds], ["simulated"]);
  assert.equal(caps.needsNetwork, false);
  assert.equal(caps.needsApiKey, false);
  assert.equal(caps.pricedIn, "credits");
  assert.equal(caps.realMoneyPaymentsEnabled, false);
  assert.throws(() => {
    caps.realMoneyPaymentsEnabled = true;
  });
  assert.throws(() => {
    caps.trustKinds.push("poi_receipt");
  });

  const started = Date.now();
  const response = await provider.plan({
    ...baseRequest,
    modelHint: "advisory",
    maxLatencyMs: 5000,
    requireTrust: ["simulated", "poi_receipt"]
  });
  assert.ok(Date.now() - started < 500);

  assert.equal(Object.hasOwn(response, "error"), false);
  assert.equal(response.provenance.providerId, "sim");
  assert.equal(response.provenance.modelId, "sim-planner-v1");
  assert.equal(response.provenance.trustKind, "simulated");
  assert.equal(response.provenance.verifiedLocally, false);
  assert.equal(typeof response.provenance.inputTokens, "number");
  assert.equal(Number.isInteger(response.provenance.inputTokens), true);
  assert.equal(typeof response.provenance.outputTokens, "number");
  assert.equal(Number.isInteger(response.provenance.costCredits), true);
  assert.ok(response.provenance.costCredits > 0);
  assert.match(response.provenance.receiptOrAttestationHash, /^[a-f0-9]{64}$/);
  assert.match(response.provenance.rawArtifactRef, /^sim-receipt-[a-f0-9]{16}$/);
  assert.equal(response.provenance.costUsdEstimate, undefined);
  assert.equal(response.provenance.costTestFlopEstimate, undefined);
  assert.equal(Object.hasOwn(response.provenance, "costUsdEstimate"), false);
  assert.equal(Object.hasOwn(response.provenance, "costTestFlopEstimate"), false);
  assert.deepEqual(Object.keys(response.provenance).sort(), [
    "costCredits",
    "inputTokens",
    "modelId",
    "outputTokens",
    "providerId",
    "rawArtifactRef",
    "receiptOrAttestationHash",
    "trustKind",
    "verifiedLocally"
  ]);
  assert.match(response.text, /^[\x20-\x7E]+$/);
  assert.equal(response.text.includes(baseRequest.prompt), false);
  assert.equal(JSON.stringify(response).includes("://"), false);
  assertComputeProvenance(response.provenance);
  assertComputeResponse(response);
  assert.doesNotThrow(() =>
    assertComputeProvenance({
      ...response.provenance,
      costUsdEstimate: 0,
      costTestFlopEstimate: 0
    })
  );
  assert.throws(() => assertComputeProvenance({ ...response.provenance, trustKind: "other" }));
  assert.throws(() => assertComputeProvenance({ ...response.provenance, costUsdEstimate: "1.00" }));
  assert.throws(() =>
    assertComputeProvenance({ ...response.provenance, receiptOrAttestationHash: "zz" })
  );

  const again = await provider.plan({
    ...baseRequest,
    modelHint: "advisory",
    maxLatencyMs: 5000,
    requireTrust: ["simulated", "poi_receipt"]
  });
  assert.equal(again.provenance.receiptOrAttestationHash, response.provenance.receiptOrAttestationHash);
  assert.equal(await provider.verify(response.provenance), true);
  assert.equal(await provider.verify({ ...response.provenance, verifiedLocally: true }), true);
  assert.equal(
    await provider.verify({
      ...response.provenance,
      verifiedLocally: true,
      receiptOrAttestationHash: "0".repeat(64)
    }),
    false
  );
  assert.equal(await provider.verify({ ...response.provenance, costCredits: response.provenance.costCredits + 1 }), false);
  assert.equal(await provider.verify({ ...response.provenance, trustKind: "poi_receipt" }), false);
  assert.equal(response.provenance.verifiedLocally, false);
});

test("unavailable trust and disallowed providers do not deduct", async () => {
  const ledger = grant(10000);
  const provider = new SimulatedProvider(ledger);
  const trust = await provider.plan({ ...baseRequest, requireTrust: ["poi_receipt"] });
  assert.equal(trust.error?.code, "trust_unavailable");
  assert.equal(trust.provenance.trustKind, "none");
  assert.equal(ledger.remaining(scope), 10000);

  const closed = grant(10000, []);
  const blocked = new SimulatedProvider(closed);
  const response = await blocked.plan(baseRequest);
  assert.equal(response.error?.code, "provider_not_allowed");
  assert.equal(closed.remaining(scope), 10000);
  assert.equal(await blocked.verify(response.provenance), false);
});

test("rejected prompts and unknown request fields do not deduct", async () => {
  const ledger = grant(10000);
  const provider = new SimulatedProvider(ledger);
  const nonAscii = await provider.plan({ ...baseRequest, prompt: "repair caf\u00e9" });
  assert.equal(nonAscii.error?.code, "prompt_rejected");
  assert.equal(nonAscii.text, "");
  assert.equal(ledger.remaining(scope), 10000);

  const linked = await provider.plan({ ...baseRequest, prompt: "repair the wall http://" });
  assert.equal(linked.error?.code, "prompt_rejected");
  assert.equal(linked.error?.message.includes(baseRequest.prompt), false);
  assert.equal(ledger.remaining(scope), 10000);

  const extra = await provider.plan({ ...baseRequest, rpcUrl: "nope" });
  assert.equal(extra.error?.code, "invalid_request");
  assert.equal(JSON.stringify(extra).includes("nope"), false);
  assert.equal(ledger.remaining(scope), 10000);
});

test("a play credit ledger cannot be raised by a negative deduction", () => {
  const ledger = grant(10000);
  const negative = ledger.deduct(scope, -5, "sim");
  const zero = ledger.deduct(scope, 0, "sim");
  assert.equal(negative.ok, false);
  assert.equal(zero.ok, false);
  assert.equal(ledger.remaining(scope), 10000);
  assert.equal(ledger.remaining({ sandboxId: "missing-sandbox", trialId: "trial-001" }), 0);
});

test("simulated provider source stays inside the sandbox", () => {
  const source = readFileSync(new URL("../src/compute.ts", import.meta.url), "utf8");
  assert.equal(/\bfetch\s*\(/.test(source), false);
  assert.equal(/\b(?:net|http|https)\.request\s*\(/.test(source), false);
  assert.equal(/\bchild_process\b/.test(source), false);
  assert.equal(/:\/\//.test(source), false);
  assert.equal(/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(source), false);
  assert.equal(source.toLowerCase().includes("oll" + "ama"), false);
  assert.equal(/\b(?:private[_ -]?key|seed phrase|mnemonic|bearer )\b/i.test(source), false);
});
