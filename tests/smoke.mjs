import assert from "node:assert/strict";
import {
  DEFAULT_SAFE_CAPABILITIES,
  assertSafeCapabilities,
  normalizeGameCommand
} from "../packages/protocol/dist/index.js";
import { ManualTranscriptAdapter } from "../packages/adapters/dist/index.js";

assertSafeCapabilities(DEFAULT_SAFE_CAPABILITIES);

const normalized = normalizeGameCommand("  repair wall   and gather wood  ");
assert.equal(normalized.accepted, true);
assert.equal(normalized.command, "repair wall and gather wood");

const empty = normalizeGameCommand("   ");
assert.equal(empty.accepted, false);

const adapter = new ManualTranscriptAdapter();
const capabilities = await adapter.getCapabilities();
assertSafeCapabilities(capabilities);

const accepted = await adapter.submitCommand({
  mode: "season_duel",
  command: "  repair wall and gather wood  "
});
assert.equal(accepted.accepted, true);
assert.equal(accepted.command, "repair wall and gather wood");

const rejected = await adapter.submitCommand({
  mode: "season_duel",
  command: "   "
});
assert.equal(rejected.accepted, false);
