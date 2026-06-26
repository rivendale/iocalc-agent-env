import assert from "node:assert/strict";
import {
  DEFAULT_SAFE_CAPABILITIES,
  IOCALC_FORBIDDEN_CAPABILITIES,
  IOCALC_SAFE_GAME_THEORY_PATTERNS,
  assertSafeCapabilities,
  assertSandboxBoundaryDecision,
  makeSandboxBoundaryDecision,
  normalizeGameCommand
} from "../packages/protocol/dist/index.js";
import {
  runAgentTrialConformance,
  runReadConformance,
  runResolveSeasonConformance,
  runSubmitCommandConformance
} from "../packages/conformance/dist/index.js";
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

assert.equal(IOCALC_SAFE_GAME_THEORY_PATTERNS.includes("setup"), true);
assert.equal(IOCALC_SAFE_GAME_THEORY_PATTERNS.includes("signaling game"), true);

const sampleReport = {
  text: "Season report",
  loopVerifier: {
    objective: "Improve settlement outcome inside the sandbox.",
    hypothesis: "Repair plus scout should reduce avoidable pressure.",
    observedOutcome: "Damage fell and information improved.",
    verifierNotes: "Report-only verifier note.",
    nextPolicy: "Prefer scouting before pressure commands."
  },
  gameTheoryPattern: {
    name: "signaling game",
    summary: "The command improved information before escalation.",
    payoff: "Better information reduced downside risk."
  }
};

assert.equal(sampleReport.loopVerifier.nextPolicy.includes("scouting"), true);
assert.equal(sampleReport.gameTheoryPattern.name, "signaling game");

const sampleAgentIdentity = {
  canonicalAgentId: "iocalc-agent-0001",
  controllerType: "scripted-agent",
  capabilityScope: ["canReadState", "canSubmitGameCommand"],
  commandSource: "scripted",
  reviewNotes: ["Sandbox-only local scripted agent."]
};

assert.equal(sampleAgentIdentity.capabilityScope.includes("canReadState"), true);
assert.equal(sampleAgentIdentity.capabilityScope.includes("walletActionsEnabled"), false);

const sampleBoundary = makeSandboxBoundaryDecision(
  "submit_command",
  "Command text is accepted only as inert sandbox gameplay input."
);
assertSandboxBoundaryDecision(sampleBoundary);
assert.equal(sampleBoundary.policy, "sandbox-gameplay-only");
assert.equal(sampleBoundary.blockedCapabilities.includes("walletActionsEnabled"), true);
assert.equal(Object.isFrozen(IOCALC_FORBIDDEN_CAPABILITIES), true);

const mutatedBoundary = makeSandboxBoundaryDecision("submit_command", "Local mutation test.");
mutatedBoundary.blockedCapabilities.length = 0;
assert.throws(() => assertSandboxBoundaryDecision(mutatedBoundary), /blockedCapabilities/);
const freshBoundary = makeSandboxBoundaryDecision("submit_command", "Fresh list after local mutation.");
assert.equal(freshBoundary.blockedCapabilities.includes("walletActionsEnabled"), true);
assert.throws(
  () => assertSandboxBoundaryDecision({ ...freshBoundary, action: "approve_wallet_transaction" }),
  /Unsafe boundary action/
);

const unsafeAuditAdapter = {
  async getState() {
    return {
      mode: "season_duel",
      season: 0,
      audit: [
        {
          boundary: {
            ...freshBoundary,
            policy: "wallet-approved",
            sandboxOnly: false
          }
        }
      ]
    };
  },
  async getReport() {
    return { text: "ok" };
  },
  async getLog() {
    return { entries: [] };
  },
  async getMatchHistory() {
    return { matches: [] };
  }
};
const unsafeAuditResults = await runReadConformance(unsafeAuditAdapter);
assert.equal(
  unsafeAuditResults.some((result) => result.name === "get-state-audit-0" && !result.passed),
  true
);

const unsafeBoundary = {
  ...freshBoundary,
  action: "approve_wallet_transaction",
  policy: "wallet-approved",
  sandboxOnly: false
};

const unsafeAuditEvent = {
  id: "audit-unsafe-0001",
  at: "2026-06-26T00:00:00Z",
  type: "wallet-approved",
  action: "approve_wallet_transaction",
  summary: "Wallet approval granted.",
  boundary: freshBoundary
};

const unsafeAuditActionResults = await runReadConformance({
  async getState() {
    return {
      mode: "season_duel",
      season: 0,
      audit: [unsafeAuditEvent]
    };
  },
  async getReport() {
    return { text: "ok" };
  },
  async getLog() {
    return { entries: [] };
  },
  async getMatchHistory() {
    return { matches: [] };
  }
});
assert.equal(
  unsafeAuditActionResults.some((result) => result.name === "get-state-audit-0" && !result.passed),
  true
);

const unsafeSubmitResults = await runSubmitCommandConformance({
  async submitCommand() {
    return {
      accepted: true,
      command: "repair wall",
      boundary: unsafeBoundary,
      audit: unsafeAuditEvent
    };
  }
});
assert.equal(
  unsafeSubmitResults.some((result) => result.name === "submit-command-boundary" && !result.passed),
  true
);
assert.equal(
  unsafeSubmitResults.some((result) => result.name === "submit-command-audit-0" && !result.passed),
  true
);

const unsafeResolveResults = await runResolveSeasonConformance({
  async resolveSeason() {
    return {
      resolved: true,
      season: 1,
      boundary: unsafeBoundary
    };
  }
});
assert.equal(
  unsafeResolveResults.some((result) => result.name === "resolve-season-boundary" && !result.passed),
  true
);

const unsafeTrialResults = await runAgentTrialConformance({
  async runAgentTrial() {
    return {
      scorecard: {},
      transcript: { transport: "http", startedAt: "2026-06-26T00:00:00Z", events: [] },
      audit: [unsafeAuditEvent]
    };
  }
});
assert.equal(
  unsafeTrialResults.some((result) => result.name === "agent-trial-audit-0" && !result.passed),
  true
);
