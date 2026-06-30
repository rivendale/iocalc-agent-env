import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  DEFAULT_SAFE_CAPABILITIES,
  DEFAULT_AGENT_GOVERNANCE_POLICY,
  IOCALC_FORBIDDEN_CAPABILITIES,
  IOCALC_SAFE_GAME_THEORY_PATTERNS,
  assertAgentGovernanceLedger,
  assertSafeCapabilities,
  assertSandboxGameApiManifest,
  assertSandboxBoundaryDecision,
  makeAgentGovernanceEntryEvidence,
  makeIocalcGovernanceDigest,
  makeSandboxBoundaryDecision,
  normalizeGameCommand
} from "../packages/protocol/dist/index.js";
import {
  runAgentTrialConformance,
  runAgentGovernanceLedgerConformance,
  runAdapterConformance,
  runBrowserPlayConformance,
  runManifestConformance,
  runReadConformance,
  runResponseContractConformance,
  runResolveSeasonConformance,
  runSubmitCommandConformance
} from "../packages/conformance/dist/index.js";
import {
  IOCALC_MCP_TOOLS,
  createIocalcHttpMcpToolBridge,
  createIocalcMcpToolBridge,
  runIocalcMcpToolBridgeConformance
} from "../packages/mcp-server/dist/index.js";
import {
  IOCALC_MCP_PROTOCOL_VERSION,
  handleIocalcMcpJsonRpcMessage,
  handleIocalcMcpJsonRpcRequest
} from "../packages/mcp-server/dist/stdio.js";
import {
  BROWSER_IOCALC_SELECTORS,
  BrowserIocalcAdapter,
  HttpIocalcAdapter,
  ManualTranscriptAdapter,
  createIocalcAdapter
} from "../packages/adapters/dist/index.js";

assertSafeCapabilities(DEFAULT_SAFE_CAPABILITIES);

const normalized = normalizeGameCommand("  repair wall   and gather wood  ");
assert.equal(normalized.accepted, true);
assert.equal(normalized.command, "repair wall and gather wood");

const empty = normalizeGameCommand("   ");
assert.equal(empty.accepted, false);

const sampleGameApiManifest = {
  project: "IOCALC",
  publicBrand: "IOCALC: Agent Trials",
  mode: "Season Duel",
  description: "Sandbox-only game API for agent play.",
  version: "2026-06-27",
  protocol: {
    name: "IOCALC Agent Env HTTP",
    compatibleWith: "iocalc-agent-env",
    agentEnvRepository: "rivendale/iocalc-agent-env",
    agentEnvCompatibilityCommit: "48060bbc6b74d1bc504e0f206bae49987d5e90fa",
    stateScope: "isolated in-memory server sandbox only",
    sandboxIdSupported: true,
    sandboxIdIsAccountOrSession: false,
    maxInMemorySandboxes: 64,
    sandboxTtlSeconds: 86400
  },
  routes: [
    { method: "GET", path: "/api/game/manifest", purpose: "Read this API manifest.", body: "none", sideEffects: "none" },
    { method: "GET", path: "/api/game/capabilities", purpose: "Read capabilities.", body: "none", sideEffects: "none" },
    { method: "GET", path: "/api/game/state", purpose: "Read state.", query: ["sandboxId"], sideEffects: "audit-read-event-only" },
    {
      method: "POST",
      path: "/api/game/command",
      purpose: "Submit inert ASCII settlement command text.",
      contentType: "application/json",
      maxBytes: 8192,
      sideEffects: "sandbox-pending-command-only"
    },
    {
      method: "POST",
      path: "/api/game/resolve",
      purpose: "Resolve one sandbox season.",
      contentType: "application/json",
      maxBytes: 8192,
      sideEffects: "sandbox-season-state-only"
    },
    { method: "GET", path: "/api/game/report", purpose: "Read report.", query: ["sandboxId"], sideEffects: "audit-read-event-only" },
    { method: "GET", path: "/api/game/log", purpose: "Read log.", query: ["sandboxId"], sideEffects: "audit-read-event-only" },
    {
      method: "GET",
      path: "/api/game/match-history",
      purpose: "Read match history.",
      query: ["sandboxId"],
      sideEffects: "audit-read-event-only"
    },
    {
      method: "GET",
      path: "/api/game/governance-ledger",
      purpose: "Read sandbox governance ledger evidence.",
      query: ["sandboxId"],
      sideEffects: "none"
    },
    {
      method: "POST",
      path: "/api/game/agent-trial",
      purpose: "Run local sandbox agent trial.",
      contentType: "application/json",
      maxBytes: 8192,
      sideEffects: "sandbox-trial-state-only"
    }
  ],
  responses: {
    "GET /api/game/state": {
      description: "Fields returned by state reads.",
      fields: ["sandboxId", "mode", "season"],
      optionalFields: ["agents", "settings", "settingsSummary", "settingEffects", "boundary", "audit"]
    },
    "POST /api/game/resolve": {
      description: "Fields returned by season resolution.",
      fields: ["resolved", "season"],
      optionalFields: ["changes.passiveSettings", "settings", "settingsSummary", "settingEffects", "boundary", "audit"]
    },
    "GET /api/game/report": {
      description: "Fields returned by report reads.",
      fields: ["text"],
      optionalFields: ["structured.settings", "structured.settingEffects", "structured.settingsSummary", "boundary", "audit"]
    },
    "GET /api/game/governance-ledger": {
      description: "Fields returned by governance ledger reads.",
      fields: ["schemaVersion", "project", "ledgerId", "generatedAt", "policy", "entries"],
      optionalFields: ["latestDigest", "entries.evidence", "entries.failureState", "entries.riskBand", "entries.metadata"]
    }
  },
  commandRequest: {
    contentType: "application/json",
    fields: {
      sandboxId: "Optional ASCII sandbox partition key. It is not an account or session.",
      mode: "season_duel",
      agentName: "Optional inert ASCII label.",
      command: "Required printable ASCII settlement command text.",
      seed: "Optional inert ASCII seed label."
    },
    allowedCommandVocabulary: "settlement gameplay vocabulary only",
    maxCommandChars: 1200
  },
  agentTrialRequest: {
    contentType: "application/json",
    fields: {
      sandboxId: "Optional ASCII sandbox partition key.",
      agentA: "Optional canonical local scripted agent label.",
      agentB: "Optional canonical local heuristic agent label.",
      seasons: "Integer from 1 to 12.",
      seed: "Optional inert ASCII seed label."
    }
  },
  selectors: [
    'data-testid="season-command"',
    'data-testid="resolve-season"',
    'data-testid="season-report"',
    'data-testid="system-log"',
    'data-testid="match-history"',
    'data-testid="agent-trials-panel"'
  ],
  safeCapabilities: ["canReadState", "canSubmitGameCommand", "canResolveSeason", "canReadReport", "canRunAgentTrial"],
  blockedCapabilities: [...IOCALC_FORBIDDEN_CAPABILITIES],
  inputPolicy: {
    asciiOnly: true,
    noLinks: true,
    noCodeOrExecutableSchemes: true,
    noSecrets: true,
    noWalletOrFinancialAuthority: true,
    submittedTextIsUntrusted: true,
    submittedTextIsExecuted: false,
    feedbackCanMutateGameplay: false
  },
  outOfScope: ["wallet actions", "private-key handling", "accounts or sessions", "financial functionality or advice"]
};
assertSandboxGameApiManifest(sampleGameApiManifest);
const triallessGameApiManifest = {
  ...sampleGameApiManifest,
  routes: sampleGameApiManifest.routes.filter((route) => route.path !== "/api/game/agent-trial"),
  safeCapabilities: sampleGameApiManifest.safeCapabilities.filter((capability) => capability !== "canRunAgentTrial")
};
delete triallessGameApiManifest.agentTrialRequest;
assertSandboxGameApiManifest(triallessGameApiManifest);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...triallessGameApiManifest,
      agentTrialRequest: sampleGameApiManifest.agentTrialRequest
    }),
  /agentTrialRequest requires agent trial support/
);
const missingAgentTrialRequestManifest = { ...sampleGameApiManifest };
delete missingAgentTrialRequestManifest.agentTrialRequest;
assert.throws(
  () => assertSandboxGameApiManifest(missingAgentTrialRequestManifest),
  /agent trial route requires agentTrialRequest/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      walletAuthority: "api_key=leak"
    }),
  /manifest contains unsupported key/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      raw: { walletAuthority: "api_key=leak" }
    }),
  /manifest contains unsupported key/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/wallet": {
          fields: ["walletBalance"]
        }
      }
    }),
  /responses contains unsupported key/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": {
          fields: ["sandboxId", "walletBalance"]
        }
      }
    }),
  /response.fields contains unsafe/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": {
          fields: ["sandboxId", "constructor.prototype.safe"]
        }
      }
    }),
  /response.fields contains unsafe field path/
);
const hiddenUnsafeResponses = { ...sampleGameApiManifest.responses };
Object.defineProperty(hiddenUnsafeResponses, "GET /api/game/state", {
  value: { fields: ["walletBalance"] },
  enumerable: false
});
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      responses: hiddenUnsafeResponses
    }),
  /response.fields contains unsafe/
);
const responseSymbolKey = Symbol("GET /api/game/state");
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        [responseSymbolKey]: { fields: ["sandboxId"] }
      }
    }),
  /responses contains unsupported key/
);
let manifestResponsesGetterReadCount = 0;
const responsesAccessorManifest = { ...sampleGameApiManifest };
Object.defineProperty(responsesAccessorManifest, "responses", {
  enumerable: true,
  configurable: true,
  get() {
    manifestResponsesGetterReadCount += 1;
    return sampleGameApiManifest.responses;
  }
});
assert.throws(() => assertSandboxGameApiManifest(responsesAccessorManifest), /accessor property/);
assert.equal(manifestResponsesGetterReadCount, 0);
let manifestResponseFieldsGetterReadCount = 0;
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": {
          get fields() {
            manifestResponseFieldsGetterReadCount += 1;
            return ["sandboxId", "mode", "season"];
          }
        }
      }
    }),
  /accessor property/
);
assert.equal(manifestResponseFieldsGetterReadCount, 0);
let inheritedProjectGetterReadCount = 0;
const inheritedProjectManifest = Object.create({
  get project() {
    inheritedProjectGetterReadCount += 1;
    return "IOCALC";
  }
});
for (const [key, value] of Object.entries(sampleGameApiManifest)) {
  if (key !== "project") {
    Object.defineProperty(inheritedProjectManifest, key, {
      enumerable: true,
      configurable: true,
      value
    });
  }
}
assert.throws(() => assertSandboxGameApiManifest(inheritedProjectManifest), /unsupported prototype/);
assert.equal(inheritedProjectGetterReadCount, 0);
let inheritedFieldsGetterReadCount = 0;
const inheritedFieldsSpec = Object.create({
  get fields() {
    inheritedFieldsGetterReadCount += 1;
    return ["sandboxId", "mode", "season"];
  }
});
Object.defineProperty(inheritedFieldsSpec, "description", {
  enumerable: true,
  configurable: true,
  value: "Fields returned by state reads."
});
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": inheritedFieldsSpec
      }
    }),
  /unsupported prototype/
);
assert.equal(inheritedFieldsGetterReadCount, 0);
const sparseRoutes = [...sampleGameApiManifest.routes];
delete sparseRoutes[0];
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      routes: sparseRoutes
    }),
  /contains accessor property/
);
const routesWithExtraKey = [...sampleGameApiManifest.routes];
routesWithExtraKey.extra = "unsafe";
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      routes: routesWithExtraKey
    }),
  /unsupported array key/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      protocol: {
        ...sampleGameApiManifest.protocol,
        maxInMemorySandboxes: () => 1
      }
    }),
  /executable value/
);
const nullPrototypeRoutes = [...sampleGameApiManifest.routes];
Object.setPrototypeOf(nullPrototypeRoutes, null);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      routes: nullPrototypeRoutes
    }),
  /unsupported prototype/
);
let unsafeNestedKeyGetterReadCount = 0;
const protocolWithUnsafeAccessorName = { ...sampleGameApiManifest.protocol };
Object.defineProperty(protocolWithUnsafeAccessorName, "api_key_secret", {
  enumerable: true,
  configurable: true,
  get() {
    unsafeNestedKeyGetterReadCount += 1;
    return "leak";
  }
});
let unsafeNestedKeyError;
try {
  assertSandboxGameApiManifest({
    ...sampleGameApiManifest,
    protocol: protocolWithUnsafeAccessorName
  });
} catch (error) {
  unsafeNestedKeyError = error;
}
assert.equal(unsafeNestedKeyGetterReadCount, 0);
assert.match(unsafeNestedKeyError.message, /accessor property/);
assert.equal(unsafeNestedKeyError.message.includes("api_key_secret"), false);
for (const unsafeField of ["authCookie", "loginCookie", "urlFetchResult", "feedbackTrustScore"]) {
  assert.throws(
    () =>
      assertSandboxGameApiManifest({
        ...sampleGameApiManifest,
        responses: {
          ...sampleGameApiManifest.responses,
          "GET /api/game/state": {
            fields: ["sandboxId", unsafeField]
          }
        }
      }),
    /response.fields contains unsafe/
  );
}
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": {
          fields: ["sandboxId"],
          optionalFields: ["settings", "settings"]
        }
      }
    }),
  /response.optionalFields must not contain duplicates/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": {
          fields: ["sandboxId"],
          raw: { apiKey: "leak" }
        }
      }
    }),
  /response contains unsupported key/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      protocol: {
        ...sampleGameApiManifest.protocol,
        walletAuthority: "api_key=leak"
      }
    }),
  /protocol contains unsupported key/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      routes: sampleGameApiManifest.routes.map((route) =>
        route.path === "/api/game/manifest" ? { ...route, authorityUrl: "api_key=leak" } : route
      )
    }),
  /route contains unsupported key/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      inputPolicy: {
        ...sampleGameApiManifest.inputPolicy,
        walletAuthority: "api_key=leak"
      }
    }),
  /inputPolicy contains unsupported key/
);
const manifestWithHiddenKey = { ...sampleGameApiManifest };
Object.defineProperty(manifestWithHiddenKey, "walletAuthority", { value: "api_key=leak", enumerable: false });
assert.throws(() => assertSandboxGameApiManifest(manifestWithHiddenKey), /manifest contains unsupported key/);
const manifestSymbolKey = Symbol("walletAuthority");
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      [manifestSymbolKey]: "api_key=leak"
    }),
  /manifest contains unsupported key/
);
assertSandboxGameApiManifest({
  ...sampleGameApiManifest,
  boundary: makeSandboxBoundaryDecision("read_manifest", "Read sandbox manifest")
});
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      boundary: {
        ...makeSandboxBoundaryDecision("read_manifest", "Read sandbox manifest"),
        reason: "api_key=leak wallet session authority"
      }
    }),
  /boundary.reason contains unsafe text/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      boundary: {
        ...makeSandboxBoundaryDecision("read_manifest", "Read sandbox manifest"),
        raw: { apiKey: "leak" }
      }
    }),
  /boundary contains unsupported key/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      routes: [
        ...sampleGameApiManifest.routes,
        {
          method: "GET",
          path: "/api/game/../wallet?api_key=leak",
          purpose: "Leak unsafe route",
          body: "none",
          sideEffects: "none"
        }
      ]
    }),
  /unsupported route/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      description: "seedPhrase hunter2"
    }),
  /description contains unsafe text/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      description: "access token abc123"
    }),
  /description contains unsafe text/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      description: "password hunter2"
    }),
  /description contains unsafe text/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      routes: sampleGameApiManifest.routes.map((route) =>
        route.path === "/api/game/manifest" ? { ...route, sideEffects: "sandbox-season-state-only" } : route
      )
    }),
  /route side effect does not match/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      selectors: [...sampleGameApiManifest.selectors, 'data-testid="api_key"']
    }),
  /unsafe selector/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      outOfScope: [...sampleGameApiManifest.outOfScope, "seedPhrase hunter2"]
    }),
  /unsupported outOfScope/
);
const unsafeCapabilityResults = await runManifestConformance({
  transport: "http",
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      safeCapabilities: [...sampleGameApiManifest.safeCapabilities, "api.key=leak"]
    };
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    return { mode: "season_duel", season: 0 };
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
assert.equal(unsafeCapabilityResults[0].passed, false);
assert.equal(unsafeCapabilityResults[0].message.includes("api.key"), false);
const unsafeBoundaryResults = await runManifestConformance({
  transport: "http",
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      boundary: {
        ...makeSandboxBoundaryDecision("read_manifest", "Read sandbox manifest"),
        action: "api.key=leak"
      }
    };
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    return { mode: "season_duel", season: 0 };
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
assert.equal(unsafeBoundaryResults[0].passed, false);
assert.equal(unsafeBoundaryResults[0].message.includes("api.key"), false);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      commandRequest: {
        contentType: "application/json",
        fields: {
          privateKey: "Never expose this"
        }
      }
    }),
  /commandRequest.fields contains unsupported key/
);
const hiddenCommandRequestManifest = {
  ...sampleGameApiManifest,
  commandRequest: {
    ...sampleGameApiManifest.commandRequest,
    fields: {
      ...sampleGameApiManifest.commandRequest.fields
    }
  }
};
Object.defineProperty(hiddenCommandRequestManifest.commandRequest.fields, "privateKey", {
  value: "api_key=leak",
  enumerable: false
});
assert.throws(() => assertSandboxGameApiManifest(hiddenCommandRequestManifest), /commandRequest.fields contains unsupported key/);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      commandRequest: {
        contentType: "application/json",
        fields: {
          command: "Use wallet session authority"
        }
      }
    }),
  /commandRequest.fields.command contains unsafe text/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      inputPolicy: {
        ...sampleGameApiManifest.inputPolicy,
        noSecrets: false
      }
    }),
  /secrets must be prohibited/
);
assert.throws(
  () =>
    assertSandboxGameApiManifest({
      ...sampleGameApiManifest,
      routes: sampleGameApiManifest.routes.filter((route) => route.path !== "/api/game/agent-trial")
    }),
  /agent trial route and capability must agree/
);

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

const mcpGovernanceBoundary = makeSandboxBoundaryDecision("read_state", "Read sandbox state for MCP smoke.");
const mcpGovernanceEntryPayload = {
  sequence: 1,
  id: "entry-mcp-0001",
  at: "2026-06-26T00:00:00Z",
  eventType: "tool-call",
  sessionId: "run-mcp-0001",
  actor: {
    canonicalAgentId: "iocalc-agent-0001",
    displayName: "IOCALC Guide 001",
    controllerType: "scripted-agent",
    commandSource: "mcp"
  },
  transport: "mcp",
  sandboxId: "mcp-sandbox",
  action: "read_state",
  summary: "MCP read sandbox state.",
  verdict: "allow",
  verdictWeight: 1,
  boundary: mcpGovernanceBoundary
};
const mcpGovernanceEntry = {
  ...mcpGovernanceEntryPayload,
  evidence: makeAgentGovernanceEntryEvidence(mcpGovernanceEntryPayload)
};
const mcpGovernanceLedger = {
  schemaVersion: "iocalc-agent-governance-v1",
  project: "IOCALC",
  ledgerId: "ledger-mcp-0001",
  generatedAt: "2026-06-26T00:00:00Z",
  policy: DEFAULT_AGENT_GOVERNANCE_POLICY,
  sessions: [
    {
      sessionId: "run-mcp-0001",
      canonicalAgentId: "iocalc-agent-0001",
      displayName: "IOCALC Guide 001",
      controllerType: "scripted-agent",
      commandSource: "mcp",
      transport: "mcp",
      sandboxId: "mcp-sandbox",
      owner: "local-test",
      status: "active",
      startedAt: "2026-06-26T00:00:00Z",
      capabilityScope: ["canReadState", "canSubmitGameCommand", "canResolveSeason", "canReadReport", "canRunAgentTrial"],
      blockedCapabilities: [...IOCALC_FORBIDDEN_CAPABILITIES],
      policy: DEFAULT_AGENT_GOVERNANCE_POLICY
    }
  ],
  entries: [mcpGovernanceEntry],
  latestDigest: mcpGovernanceEntry.evidence.entryDigest
};
assertAgentGovernanceLedger(mcpGovernanceLedger);

function sampleServerTriadBracket() {
  const leftStableMetrics = {
    metricVersion: "iocalc-stable-matchup-metrics-v1",
    source: "server-local-sandbox",
    completionMetricKind: "score-delta-proxy",
    scoreMargin: 12,
    completionTempo: 0.5,
    completionCount: 4,
    repeatRate: 0.13,
    energyShortfall: 0,
    damageLeak: 2,
    fallbackCount: 0,
    policyStability: "stable",
    matchupSummary: "Compounder Agent: margin +12, tempo 0.5, repeats 0.13, shortfall 0, damage leak +2, stable."
  };
  const rightStableMetrics = {
    ...leftStableMetrics,
    scoreMargin: -12,
    completionTempo: 0.38,
    completionCount: 3,
    repeatRate: 0.25,
    policyStability: "watch",
    matchupSummary: "Compounder Heuristic: margin -12, tempo 0.38, repeats 0.25, shortfall 0, damage leak +2, watch."
  };
  return {
    schemaVersion: "iocalc-server-triad-bracket-v1",
    source: "server-local-sandbox",
    seed: "mcp-smoke",
    seasons: 8,
    completed: true,
    generatedAt: "2026-06-30T00:00:00Z",
    stableMetricKeys: [
      "scoreMargin",
      "completionTempo",
      "completionCount",
      "repeatRate",
      "energyShortfall",
      "damageLeak",
      "fallbackCount",
      "policyStability"
    ],
    metricSemantics: {
      metricVersion: "iocalc-stable-matchup-metrics-v1",
      completionMetricKind: "score-delta-proxy",
      source: "server-local-sandbox",
      authority: "server-local-analogue",
      damageMetricKind: "shared-risk-damage-delta"
    },
    serverMetricPolicy: "Server triad uses stableMetrics with a completion proxy from high score-delta seasons.",
    serverVerified: false,
    leaderboardEvidence: false,
    browserParity: "server-local-analogue",
    policies: [
      {
        id: "compounder-agent",
        label: "Compounder Agent",
        controller: "compounder-agent",
        strategyBias: "compounder",
        canonicalAgentId: "iocalc-agent-0001",
        policyKind: "server-local-compounder-agent"
      }
    ],
    standings: [
      {
        id: "compounder-agent",
        label: "Compounder Agent",
        controller: "compounder-agent",
        strategyBias: "compounder",
        policyKind: "server-local-compounder-agent",
        points: 3,
        wins: 1,
        draws: 0,
        losses: 0,
        scoreFor: 100,
        scoreAgainst: 88,
        margin: 12,
        completionProxy: 4,
        shortfall: 0,
        repeatCount: 1,
        fallbackCount: 0,
        sharedDamageDelta: 2,
        stableMetrics: leftStableMetrics
      }
    ],
    matches: [
      {
        id: "server-triad-1-compounder-agent-vs-compounder-heuristic",
        leftId: "compounder-agent",
        rightId: "compounder-heuristic",
        leftLabel: "Compounder Agent",
        rightLabel: "Compounder Heuristic",
        leftController: "compounder-agent",
        rightController: "local-heuristic-ai",
        winner: "compounder-agent",
        winnerLabel: "Compounder Agent",
        seasonCount: 8,
        leftScore: 100,
        rightScore: 88,
        leftCompletionProxy: 4,
        rightCompletionProxy: 3,
        leftRepeatCount: 1,
        rightRepeatCount: 2,
        leftUniqueCommands: 7,
        rightUniqueCommands: 6,
        leftTopCommand: "build the forge and trade coin",
        rightTopCommand: "fortify the wall and trade coin",
        finalDamage: 12,
        damageDelta: 2,
        finalPressure: 41,
        stableMetrics: {
          left: leftStableMetrics,
          right: rightStableMetrics
        },
        summary: "Compounder Agent 100 vs Compounder Heuristic 88; completion proxy 4/3; repeats 1/2."
      }
    ],
    summary: "Compounder Agent leads the server-local triad with 3 points.",
    safetyBoundary: {
      sandboxOnly: true,
      submittedTextIsExecuted: false,
      walletActionsEnabled: false,
      feedbackCanMutateGameplay: false,
      externalUrlFetchEnabled: false,
      codeExecutionEnabled: false,
      secretsAccessEnabled: false,
      productionMutationEnabled: false,
      financialFunctionalityEnabled: false
    }
  };
}

const capturedRequests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  capturedRequests.push({
    url: String(url),
    headers: init.headers ?? {},
    body: init.body ? JSON.parse(String(init.body)) : undefined
  });
  const pathname = new URL(String(url)).pathname;
  const sandboxId = new URL(String(url)).searchParams.get("sandboxId") ?? "missing-sandbox";
  const payloadByPath = {
    "/api/game/manifest": sampleGameApiManifest,
    "/api/game/capabilities": DEFAULT_SAFE_CAPABILITIES,
    "/api/game/state": { sandboxId, mode: "season_duel", season: 0, agents: [] },
    "/api/game/command": { accepted: true, sandboxId, command: "repair wall and gather wood", warnings: [] },
    "/api/game/resolve": { resolved: true, sandboxId, season: 1 },
    "/api/game/report": { sandboxId, text: "report" },
    "/api/game/log": { sandboxId, entries: [] },
    "/api/game/match-history": { sandboxId, matches: [] },
    "/api/game/governance-ledger": mcpGovernanceLedger
  };
  const payload =
    payloadByPath[pathname] ?? {
      sandboxId,
      scorecard: {},
      transcript: { transport: "http", startedAt: "2026-06-26T00:00:00Z", events: [] },
      serverTriadBracket: sampleServerTriadBracket()
    };
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload
  };
};

const httpAdapter = new HttpIocalcAdapter({
  baseUrl: "http://example.test",
  sandboxId: "smoke-sandbox"
});
await httpAdapter.getState();
await httpAdapter.submitCommand({
  mode: "season_duel",
  command: "repair wall and gather wood",
  sandboxId: "override-sandbox"
});
await httpAdapter.resolveSeason({ seed: "smoke-seed" });
const httpAgentTrial = await httpAdapter.runAgentTrial({
  agentA: "iocalc-agent-0001",
  agentB: "iocalc-runner-0001",
  seasons: 1
});
assert.equal(httpAgentTrial.serverTriadBracket.schemaVersion, "iocalc-server-triad-bracket-v1");
assert.equal(httpAgentTrial.serverTriadBracket.standings[0].stableMetrics.metricVersion, "iocalc-stable-matchup-metrics-v1");
const httpGovernanceLedger = await httpAdapter.getGovernanceLedger();

assert.equal(capturedRequests[0].url.includes("sandboxId=smoke-sandbox"), true);
assert.equal(capturedRequests[1].url.includes("sandboxId=override-sandbox"), true);
assert.equal(capturedRequests[1].body.sandboxId, "override-sandbox");
assert.equal(capturedRequests[2].body.sandboxId, "smoke-sandbox");
assert.equal(capturedRequests[3].body.sandboxId, "smoke-sandbox");
assert.equal(capturedRequests[4].url.includes("/api/game/governance-ledger"), true);
assert.equal(capturedRequests[4].url.includes("sandboxId=smoke-sandbox"), true);
assertAgentGovernanceLedger(httpGovernanceLedger);
const httpManifest = await httpAdapter.getManifest();
assertSandboxGameApiManifest(httpManifest);
assert.equal(capturedRequests.at(-1).url.endsWith("/api/game/manifest"), true);
assert.equal(capturedRequests.at(-1).url.includes("sandboxId="), false);
assert.deepEqual(capturedRequests.at(-1).headers, {});
const manifestConformance = await runManifestConformance(httpAdapter);
assert.equal(manifestConformance.every((result) => result.passed), true);
let payloadBoundaryGetterReadCount = 0;
let payloadAuditGetterReadCount = 0;
const payloadAccessorConformance = await runReadConformance({
  transport: "http",
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    const state = { sandboxId: "payload-boundary", mode: "season_duel", season: 0 };
    Object.defineProperty(state, "boundary", {
      enumerable: true,
      configurable: true,
      get() {
        payloadBoundaryGetterReadCount += 1;
        throw new Error("boundary getter executed");
      }
    });
    return state;
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
  },
  async getReport() {
    const report = { text: "ok" };
    Object.defineProperty(report, "audit", {
      enumerable: true,
      configurable: true,
      get() {
        payloadAuditGetterReadCount += 1;
        throw new Error("audit getter executed");
      }
    });
    return report;
  },
  async getLog() {
    return { entries: [] };
  },
  async getMatchHistory() {
    return { matches: [] };
  }
});
assert.equal(payloadBoundaryGetterReadCount, 0);
assert.equal(payloadAuditGetterReadCount, 0);
assert.equal(
  payloadAccessorConformance.some((result) => !result.passed && result.message === "Unsafe payload boundary property."),
  true
);
assert.equal(
  payloadAccessorConformance.some((result) => !result.passed && result.message === "Unsafe payload audit property."),
  true
);
let inheritedPayloadBoundaryGetterReadCount = 0;
const inheritedPayloadConformance = await runReadConformance({
  transport: "http",
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    return Object.create({
      get boundary() {
        inheritedPayloadBoundaryGetterReadCount += 1;
        throw new Error("inherited boundary getter executed");
      }
    });
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
assert.equal(inheritedPayloadBoundaryGetterReadCount, 0);
assert.equal(inheritedPayloadConformance.every((result) => result.passed), true);
const responseContractConformance = await runResponseContractConformance(httpAdapter);
assert.equal(responseContractConformance.every((result) => result.passed), true);
const noManifestResponseContractConformance = await runResponseContractConformance(adapter);
assert.deepEqual(noManifestResponseContractConformance, []);
const noResponsesContractConformance = await runResponseContractConformance({
  transport: "http",
  async getManifest() {
    const manifest = { ...sampleGameApiManifest };
    delete manifest.responses;
    return manifest;
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    return { mode: "season_duel", season: 0 };
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
assert.deepEqual(noResponsesContractConformance, []);
const missingResponseFieldConformance = await runResponseContractConformance({
  transport: "http",
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": {
          ...sampleGameApiManifest.responses["GET /api/game/state"],
          fields: ["sandboxId", "mode", "season", "agents"]
        }
      }
    };
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    return { sandboxId: "missing-required", mode: "season_duel", season: 0 };
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
assert.equal(missingResponseFieldConformance.some((result) => !result.passed && result.message?.includes("agents")), true);
const missingNestedResponseFieldConformance = await runResponseContractConformance({
  transport: "http",
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": {
          ...sampleGameApiManifest.responses["GET /api/game/state"],
          fields: ["sandboxId", "summary.score"]
        }
      }
    };
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    return { sandboxId: "missing-nested", mode: "season_duel", season: 0 };
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
  missingNestedResponseFieldConformance.some((result) => !result.passed && result.message?.includes("summary.score")),
  true
);
const undefinedNestedResponseFieldConformance = await runResponseContractConformance({
  transport: "http",
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": {
          ...sampleGameApiManifest.responses["GET /api/game/state"],
          fields: ["sandboxId", "summary.score"]
        }
      }
    };
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    return { sandboxId: "undefined-nested", summary: { score: undefined } };
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
  undefinedNestedResponseFieldConformance.some((result) => !result.passed && result.message?.includes("summary.score")),
  true
);
let payloadGetterReadCount = 0;
const payloadGetterResponseFieldConformance = await runResponseContractConformance({
  transport: "http",
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": {
          ...sampleGameApiManifest.responses["GET /api/game/state"],
          fields: ["sandboxId", "summary.score"]
        }
      }
    };
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    const state = { sandboxId: "payload-getter" };
    Object.defineProperty(state, "summary", {
      enumerable: true,
      configurable: true,
      get() {
        payloadGetterReadCount += 1;
        throw new Error("payload getter executed");
      }
    });
    return state;
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
assert.equal(payloadGetterReadCount, 0);
assert.equal(
  payloadGetterResponseFieldConformance.some((result) => !result.passed && result.message?.includes("summary.score")),
  true
);
const inheritedResponses = Object.create({
  "GET /api/game/state": {
    fields: ["sandboxId", "mode", "season", "agents"]
  }
});
let inheritedResponseStateReadCount = 0;
const inheritedResponseConformance = await runResponseContractConformance({
  transport: "http",
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      responses: inheritedResponses
    };
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    inheritedResponseStateReadCount += 1;
    return { sandboxId: "inherited", mode: "season_duel", season: 0 };
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
  inheritedResponseConformance.some((result) => !result.passed && result.message?.includes("unsupported prototype")),
  true
);
assert.equal(inheritedResponseStateReadCount, 0);
let getterResponseFieldsReadCount = 0;
const getterResponseConformance = await runResponseContractConformance({
  transport: "http",
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      responses: {
        ...sampleGameApiManifest.responses,
        "GET /api/game/state": {
          get fields() {
            getterResponseFieldsReadCount += 1;
            return ["sandboxId", "mode", "season"];
          }
        }
      }
    };
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    return { sandboxId: "getter", mode: "season_duel", season: 0 };
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
  getterResponseConformance.some((result) => !result.passed && result.message?.includes("accessor property")),
  true
);
assert.equal(getterResponseFieldsReadCount, 0);
let topLevelResponsesReadCount = 0;
const getterResponsesConformance = await runResponseContractConformance({
  transport: "http",
  async getManifest() {
    const manifest = { ...sampleGameApiManifest };
    Object.defineProperty(manifest, "responses", {
      enumerable: true,
      configurable: true,
      get() {
        topLevelResponsesReadCount += 1;
        return topLevelResponsesReadCount === 1 ? undefined : sampleGameApiManifest.responses;
      }
    });
    return manifest;
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    return { sandboxId: "getter-responses", mode: "season_duel", season: 0 };
  },
  async submitCommand() {
    return { accepted: true, command: "repair wall" };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
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
  getterResponsesConformance.some((result) => !result.passed && result.message?.includes("accessor property")),
  true
);
assert.equal(topLevelResponsesReadCount, 0);
let sequencingResolved = false;
let sequencingResolveCount = 0;
const sequencingConformance = await runAdapterConformance({
  transport: "http",
  async getManifest() {
    return sampleGameApiManifest;
  },
  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  },
  async getState() {
    return { sandboxId: "sequencing", mode: "season_duel", season: sequencingResolved ? 1 : 0 };
  },
  async submitCommand(input) {
    if (sequencingResolved) {
      throw new Error("submit after resolve");
    }
    return { accepted: true, command: input.command };
  },
  async resolveSeason() {
    sequencingResolveCount += 1;
    if (sequencingResolveCount > 1) {
      throw new Error("duplicate resolve");
    }
    sequencingResolved = true;
    return { resolved: true, season: 1 };
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
assert.equal(sequencingConformance.every((result) => result.passed), true);
assert.equal(sequencingResolveCount, 1);
for (const invalidSandboxId of [
  "",
  "api_key",
  "api_key_abc",
  "private_key_1",
  "password1",
  "bearer-token-prod",
  "mnemonic_backup",
  "access_token_prod",
  "auth-token-prod",
  "refresh_token",
  "oauth_token",
  "local-token",
  ".",
  "..",
  "-",
  "_",
  "-._",
  ".team",
  "team.",
  "_team_",
  "-team-",
  "-._team_.-",
  null,
  123
]) {
  assert.throws(
    () => new HttpIocalcAdapter({ baseUrl: "http://example.test", sandboxId: invalidSandboxId }),
    /sandboxId/,
    `expected invalid constructor sandboxId to throw: ${String(invalidSandboxId)}`
  );
}
assert.throws(
  () => httpAdapter.submitCommand({
    mode: "season_duel",
    command: "repair wall",
    sandboxId: ""
  }),
  /sandboxId/
);
assert.throws(
  () => httpAdapter.submitCommand({
    mode: "season_duel",
    command: "repair wall",
    sandboxId: null
  }),
  /sandboxId/
);
const factoryAdapter = createIocalcAdapter({
  transport: "http",
  baseUrl: "http://example.test",
  sandboxId: "factory-sandbox"
});
await factoryAdapter.getCapabilities();
assert.equal(capturedRequests.at(-1).url.includes("sandboxId=factory-sandbox"), true);

globalThis.fetch = originalFetch;

function createFakeBrowserPage() {
  const values = new Map([
    [BROWSER_IOCALC_SELECTORS.seasonCommand, ""],
    [BROWSER_IOCALC_SELECTORS.resolveSeason, "Resolve"],
    [BROWSER_IOCALC_SELECTORS.seasonReport, "Season 0\nAwaiting orders."],
    [BROWSER_IOCALC_SELECTORS.systemLog, "System online."],
    [BROWSER_IOCALC_SELECTORS.matchHistory, "Season 0: setup"],
    [BROWSER_IOCALC_SELECTORS.agentTrialsPanel, "Agent Trials visible."]
  ]);
  const page = {
    gotoCalls: [],
    waitStates: [],
    fills: [],
    clicks: [],
    locatorCalls: [],
    currentUrl: "about:blank",
    season: 0,
    goto(url, options) {
      this.gotoCalls.push({ url, options });
      this.currentUrl = url;
    },
    waitForLoadState(state, options) {
      this.waitStates.push({ state, options });
    },
    url() {
      return this.currentUrl;
    },
    locator(selector) {
      page.locatorCalls.push(selector);
      return {
        count: () => (values.has(selector) ? 1 : 0),
        fill: (value) => {
          page.fills.push({ selector, value });
          values.set(selector, value);
        },
        click: () => {
          page.clicks.push(selector);
          if (selector === BROWSER_IOCALC_SELECTORS.resolveSeason) {
            page.season += 1;
            values.set(
              BROWSER_IOCALC_SELECTORS.seasonReport,
              `Season ${page.season}\nReport: repaired the wall and gathered wood.`
            );
            values.set(
              BROWSER_IOCALC_SELECTORS.systemLog,
              `Season ${page.season}: command source browser; fallback false.`
            );
            values.set(BROWSER_IOCALC_SELECTORS.matchHistory, `Season ${page.season}: browser command resolved`);
          }
        },
        innerText: () => values.get(selector) ?? "",
        textContent: () => values.get(selector) ?? ""
      };
    }
  };
  return page;
}

const fakeBrowserPage = createFakeBrowserPage();
const browserAdapter = new BrowserIocalcAdapter({
  page: fakeBrowserPage,
  baseUrl: "http://127.0.0.1:8090/play"
});
const browserCapabilities = await browserAdapter.getCapabilities();
assertSafeCapabilities(browserCapabilities);
assert.equal(browserCapabilities.canRunAgentTrial, false);
assert.equal(fakeBrowserPage.gotoCalls[0].url, "http://127.0.0.1:8090/play");

const browserAccepted = await browserAdapter.submitCommand({
  mode: "season_duel",
  command: " build farms, repair damage, fortify the wall, scout the rival "
});
assert.equal(browserAccepted.accepted, true);
assert.equal(fakeBrowserPage.fills[0].selector, BROWSER_IOCALC_SELECTORS.seasonCommand);
assert.equal(fakeBrowserPage.fills[0].value, "build farms, repair damage, fortify the wall, scout the rival");

const browserRejectedWallet = await browserAdapter.submitCommand({
  mode: "season_duel",
  command: "withdraw wallet tokens"
});
assert.equal(browserRejectedWallet.accepted, false);
assert.equal(browserRejectedWallet.boundary.allowed, false);
assert.equal(fakeBrowserPage.fills.length, 1);
assert.equal(fakeBrowserPage.clicks.length, 0);

const browserRejectedLink = await browserAdapter.submitCommand({
  mode: "season_duel",
  command: "repair wall then review https://example.invalid"
});
assert.equal(browserRejectedLink.accepted, false);
assert.equal(browserRejectedLink.warnings.some((warning) => warning.includes("must not fetch")), true);
assert.equal(fakeBrowserPage.fills.length, 1);
assert.equal(fakeBrowserPage.clicks.length, 0);

await assert.rejects(() => browserAdapter.resolveSeason({ seed: "browser-smoke-seed" }), /cannot apply seed/);
const browserResolution = await browserAdapter.resolveSeason();
assert.equal(browserResolution.resolved, true);
assert.equal(browserResolution.season, 1);
assert.equal(fakeBrowserPage.clicks.includes(BROWSER_IOCALC_SELECTORS.resolveSeason), true);

const browserReport = await browserAdapter.getReport();
assert.equal(browserReport.text.includes("Season 1"), true);
const browserLog = await browserAdapter.getLog();
assert.equal(browserLog.entries.some((entry) => entry.includes("fallback false")), true);
const browserHistory = await browserAdapter.getMatchHistory();
assert.equal(browserHistory.matches.length, 1);
const browserState = await browserAdapter.getState();
assert.equal(browserState.mode, "season_duel");
assert.equal(browserState.season, 1);
assert.equal(browserState.raw.walletActionsEnabled, false);
assert.equal(fakeBrowserPage.locatorCalls.some((selector) => /wallet|feedback|recommend/i.test(selector)), false);

const browserAggregatePage = createFakeBrowserPage();
const browserAggregateAdapter = new BrowserIocalcAdapter({
  page: browserAggregatePage,
  baseUrl: "http://127.0.0.1:8090/play"
});
const browserAggregateConformance = await runAdapterConformance(browserAggregateAdapter);
assert.equal(browserAggregateConformance.every((result) => result.passed), true);
assert.equal(browserAggregatePage.clicks.filter((selector) => selector === BROWSER_IOCALC_SELECTORS.resolveSeason).length, 1);
assert.equal(browserAggregatePage.locatorCalls.some((selector) => /wallet|feedback|recommend/i.test(selector)), false);
let browserAggregateAgentTrialCalls = 0;
const browserAggregateTrialAdapter = new BrowserIocalcAdapter({
  page: createFakeBrowserPage(),
  baseUrl: "http://127.0.0.1:8090/play"
});
browserAggregateTrialAdapter.runAgentTrial = async () => {
  browserAggregateAgentTrialCalls += 1;
  throw new Error("browser agent trial should not run");
};
const browserAggregateWithAgentTrial = await runAdapterConformance(browserAggregateTrialAdapter);
assert.equal(browserAggregateWithAgentTrial.every((result) => result.passed), true);
assert.equal(browserAggregateAgentTrialCalls, 0);

const browserPlayPage = createFakeBrowserPage();
const browserPlayAdapter = new BrowserIocalcAdapter({
  page: browserPlayPage,
  baseUrl: "http://127.0.0.1:8090/play"
});
const browserPlayConformance = await runBrowserPlayConformance(browserPlayAdapter);
assert.equal(browserPlayConformance.every((result) => result.passed), true);
assert.equal(browserPlayConformance.some((result) => result.name === "browser-wallet-out-of-scope"), true);
assert.equal(browserPlayPage.fills[0].value, "repair wall and gather wood");
assert.equal(browserPlayPage.clicks.filter((selector) => selector === BROWSER_IOCALC_SELECTORS.resolveSeason).length, 1);
assert.equal(browserPlayPage.locatorCalls.some((selector) => /wallet|feedback|recommend/i.test(selector)), false);

const missingBrowserRawConformance = await runBrowserPlayConformance({
  transport: "browser",
  async getCapabilities() {
    return { ...DEFAULT_SAFE_CAPABILITIES, canRunAgentTrial: false };
  },
  async getState() {
    return { mode: "season_duel", season: 0 };
  },
  async submitCommand(input) {
    return { accepted: true, command: input.command };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
  },
  async getReport() {
    return { text: "Season 1" };
  },
  async getLog() {
    return { entries: [] };
  },
  async getMatchHistory() {
    return { matches: [] };
  }
});
assert.equal(
  missingBrowserRawConformance.some((result) => result.name === "browser-wallet-out-of-scope" && result.passed === false),
  true
);
const emptyBrowserSelectorConformance = await runBrowserPlayConformance({
  transport: "browser",
  async getCapabilities() {
    return { ...DEFAULT_SAFE_CAPABILITIES, canRunAgentTrial: false };
  },
  async getState() {
    return {
      mode: "season_duel",
      season: 0,
      raw: {
        walletActionsEnabled: false,
        feedbackCanMutateGameplay: false,
        externalUrlFetchEnabled: false,
        codeExecutionEnabled: false,
        secretsAccessEnabled: false,
        productionMutationEnabled: false,
        selectors: {}
      }
    };
  },
  async submitCommand(input) {
    return { accepted: true, command: input.command };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
  },
  async getReport() {
    return { text: "Season 1" };
  },
  async getLog() {
    return { entries: [] };
  },
  async getMatchHistory() {
    return { matches: [] };
  }
});
assert.equal(
  emptyBrowserSelectorConformance.some((result) => result.name === "browser-wallet-out-of-scope" && result.passed === false),
  true
);
const walletNamedBrowserSelectorConformance = await runBrowserPlayConformance({
  transport: "browser",
  async getCapabilities() {
    return { ...DEFAULT_SAFE_CAPABILITIES, canRunAgentTrial: false };
  },
  async getState() {
    return {
      mode: "season_duel",
      season: 0,
      raw: {
        walletActionsEnabled: false,
        feedbackCanMutateGameplay: false,
        externalUrlFetchEnabled: false,
        codeExecutionEnabled: false,
        secretsAccessEnabled: false,
        productionMutationEnabled: false,
        selectors: {
          wallet: BROWSER_IOCALC_SELECTORS.seasonCommand
        }
      }
    };
  },
  async submitCommand(input) {
    return { accepted: true, command: input.command };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
  },
  async getReport() {
    return { text: "Season 1" };
  },
  async getLog() {
    return { entries: [] };
  },
  async getMatchHistory() {
    return { matches: [] };
  }
});
assert.equal(
  walletNamedBrowserSelectorConformance.some((result) => result.name === "browser-wallet-out-of-scope" && result.passed === false),
  true
);
let browserSelectorGetterReadCount = 0;
const getterBrowserRawConformance = await runBrowserPlayConformance({
  transport: "browser",
  async getCapabilities() {
    return { ...DEFAULT_SAFE_CAPABILITIES, canRunAgentTrial: false };
  },
  async getState() {
    const selectors = {};
    Object.defineProperty(selectors, "wallet", {
      enumerable: true,
      configurable: true,
      get() {
        browserSelectorGetterReadCount += 1;
        return '[data-testid="wallet"]';
      }
    });
    return {
      mode: "season_duel",
      season: 0,
      raw: {
        walletActionsEnabled: false,
        feedbackCanMutateGameplay: false,
        externalUrlFetchEnabled: false,
        codeExecutionEnabled: false,
        secretsAccessEnabled: false,
        productionMutationEnabled: false,
        selectors
      }
    };
  },
  async submitCommand(input) {
    return { accepted: true, command: input.command };
  },
  async resolveSeason() {
    return { resolved: true, season: 1 };
  },
  async getReport() {
    return { text: "Season 1" };
  },
  async getLog() {
    return { entries: [] };
  },
  async getMatchHistory() {
    return { matches: [] };
  }
});
assert.equal(browserSelectorGetterReadCount, 0);
assert.equal(
  getterBrowserRawConformance.some((result) => result.name === "browser-wallet-out-of-scope" && result.passed === false),
  true
);
const unsafeBrowserMessageConformance = await runBrowserPlayConformance({
  transport: "browser",
  async getCapabilities() {
    throw new Error("api_key_secret https://wallet.invalid");
  },
  async getState() {
    return { mode: "season_duel", season: 0 };
  },
  async submitCommand() {
    return {
      accepted: false,
      command: "repair wall",
      rejectedReason: "api_key_secret https://wallet.invalid"
    };
  },
  async resolveSeason() {
    throw new Error("private_key wallet leak");
  },
  async getReport() {
    throw new Error("secret report leak");
  },
  async getLog() {
    throw new Error("wallet log leak");
  },
  async getMatchHistory() {
    throw new Error("token history leak");
  }
});
const unsafeBrowserMessages = unsafeBrowserMessageConformance.map((result) => result.message ?? "").join("\n");
assert.equal(/api_key|private_key|https:\/\/|wallet\.invalid|token history/i.test(unsafeBrowserMessages), false);
assert.equal(unsafeBrowserMessages.includes("Browser conformance operation failed."), true);
assert.equal(unsafeBrowserMessages.includes("Browser command was rejected."), true);

const factoryBrowserPage = createFakeBrowserPage();
const factoryBrowserAdapter = createIocalcAdapter({
  transport: "browser",
  page: factoryBrowserPage,
  baseUrl: "https://play.iocalc.com/"
});
await factoryBrowserAdapter.getCapabilities();
assert.equal(factoryBrowserPage.gotoCalls[0].url, "https://play.iocalc.com/");

assert.throws(
  () => new BrowserIocalcAdapter({ page: createFakeBrowserPage(), baseUrl: "file:///tmp/iocalc.html" }),
  /http or https/
);
assert.throws(
  () => new BrowserIocalcAdapter({ page: createFakeBrowserPage(), baseUrl: "https://example.test/play" }),
  /localhost/
);
assert.throws(
  () => new BrowserIocalcAdapter({ page: createFakeBrowserPage(), baseUrl: "https://user:pass@example.test/play" }),
  /credentials/
);
assert.throws(
  () => new BrowserIocalcAdapter({ page: createFakeBrowserPage(), baseUrl: "https://example.test/wallet" }),
  /localhost/
);
assert.throws(
  () => new BrowserIocalcAdapter({ page: createFakeBrowserPage(), baseUrl: "https://play.iocalc.com/wallet" }),
  /sandbox play UI/
);
assert.throws(
  () => new BrowserIocalcAdapter({ page: createFakeBrowserPage(), baseUrl: "http://10.0.0.5:8090/play" }),
  /localhost/
);
assert.throws(
  () => new BrowserIocalcAdapter({ page: createFakeBrowserPage(), baseUrl: "http://play.iocalc.com/" }),
  /https/
);

const queryBrowserPage = createFakeBrowserPage();
const queryBrowserAdapter = new BrowserIocalcAdapter({
  page: queryBrowserPage,
  baseUrl: "https://play.iocalc.com/?next=/wallet#fragment"
});
await queryBrowserAdapter.getCapabilities();
assert.equal(queryBrowserPage.gotoCalls[0].url, "https://play.iocalc.com/");

const redirectBrowserPage = createFakeBrowserPage();
redirectBrowserPage.goto = function goto(url, options) {
  this.gotoCalls.push({ url, options });
  this.currentUrl = "https://play.iocalc.com/wallet";
};
const redirectBrowserAdapter = new BrowserIocalcAdapter({
  page: redirectBrowserPage,
  baseUrl: "https://play.iocalc.com/"
});
await assert.rejects(() => redirectBrowserAdapter.getCapabilities(), /sandbox play UI/);

const queryRedirectBrowserPage = createFakeBrowserPage();
queryRedirectBrowserPage.goto = function goto(url, options) {
  this.gotoCalls.push({ url, options });
  this.currentUrl = "https://play.iocalc.com/?next=/wallet";
};
const queryRedirectBrowserAdapter = new BrowserIocalcAdapter({
  page: queryRedirectBrowserPage,
  baseUrl: "https://play.iocalc.com/"
});
await assert.rejects(() => queryRedirectBrowserAdapter.getCapabilities(), /query or hash/);

const missingSelectorPage = createFakeBrowserPage();
const originalMissingLocator = missingSelectorPage.locator.bind(missingSelectorPage);
missingSelectorPage.locator = (selector) => {
  if (selector === BROWSER_IOCALC_SELECTORS.seasonCommand) {
    return { count: () => 0 };
  }
  return originalMissingLocator(selector);
};
const missingSelectorAdapter = new BrowserIocalcAdapter({ page: missingSelectorPage });
await assert.rejects(() => missingSelectorAdapter.getCapabilities(), /exactly one/);

assert.equal(IOCALC_SAFE_GAME_THEORY_PATTERNS.includes("setup"), true);
assert.equal(IOCALC_SAFE_GAME_THEORY_PATTERNS.includes("signaling game"), true);

const mcpCalls = [];
const fakeMcpAdapter = {
  transport: "http",
  async getManifest() {
    mcpCalls.push(["getManifest"]);
    return sampleGameApiManifest;
  },
  async getCapabilities() {
    mcpCalls.push(["getCapabilities"]);
    return { ...DEFAULT_SAFE_CAPABILITIES, canRunAgentTrial: true };
  },
  async getState() {
    mcpCalls.push(["getState"]);
    return {
      mode: "season_duel",
      season: 1,
      settings: {
        councilor: "quartermaster",
        feedbackTrustScore: 7,
        loginUrl: "local only",
        urlFetchResult: "ok",
        "t.r.u.s.tDelta": 1,
        "u.r.lTarget": "blocked",
        constructor: { polluted: true }
      },
      settingEffects: {
        food: 3,
        trustDelta: 1,
        paymentEnabled: 1,
        shellAccess: 1,
        codeExecution: 1,
        ["__proto__"]: { polluted: true }
      },
      settingsSummary: "Council Compact"
    };
  },
  async submitCommand(input) {
    mcpCalls.push(["submitCommand", input]);
    return { accepted: true, command: input.command, sandboxId: input.sandboxId };
  },
  async resolveSeason(input) {
    mcpCalls.push(["resolveSeason", input]);
    return {
      resolved: true,
      season: 2,
      raw: input,
      settings: {
        enterprise: "public-granaries",
        feedbackTrustScore: 7
      },
      settingEffects: {
        food: 3,
        urlFetchResult: 1
      },
      settingsSummary: "Public Granaries"
    };
  },
  async getReport() {
    mcpCalls.push(["getReport"]);
    return {
      text: "Season report",
      structured: {
        settings: {
          enterprise: "public-granaries",
          loginCookie: "blocked"
        },
        settingEffects: {
          food: 3,
          trustDelta: 1
        }
      }
    };
  },
  async getLog() {
    mcpCalls.push(["getLog"]);
    return { entries: ["System log"] };
  },
  async getMatchHistory() {
    mcpCalls.push(["getMatchHistory"]);
    return { matches: [{ season: 1 }] };
  },
  async getGovernanceLedger() {
    mcpCalls.push(["getGovernanceLedger"]);
    return mcpGovernanceLedger;
  },
  async runAgentTrial(input) {
    mcpCalls.push(["runAgentTrial", input]);
    return {
      scorecard: { winner: input.agentA },
      transcript: { transport: "mcp", startedAt: "2026-06-26T00:00:00Z", events: [] },
      serverTriadBracket: sampleServerTriadBracket()
    };
  }
};

assert.equal(IOCALC_MCP_TOOLS.some((tool) => tool.name === "iocalc.get_manifest"), true);
assert.equal(IOCALC_MCP_TOOLS.some((tool) => tool.name === "iocalc.submit_command"), true);
assert.equal(IOCALC_MCP_TOOLS.some((tool) => tool.name === "iocalc.get_governance_ledger"), true);
assert.equal(IOCALC_MCP_TOOLS.every((tool) => tool.inputSchema.additionalProperties === false), true);

const mcpBridge = createIocalcMcpToolBridge(fakeMcpAdapter);
const mcpManifest = await mcpBridge.callTool("iocalc.get_manifest");
assert.equal(mcpManifest.isError, undefined);
assertSandboxGameApiManifest(mcpManifest.structuredContent);
assert.equal(mcpManifest.content[0].text.includes("walletActionsEnabled"), true);
assert.notEqual(mcpManifest.structuredContent.commandRequest, sampleGameApiManifest.commandRequest);
assert.notEqual(mcpManifest.structuredContent.commandRequest.fields, sampleGameApiManifest.commandRequest.fields);
assert.deepEqual(mcpManifest.structuredContent.responses, sampleGameApiManifest.responses);
assert.notEqual(mcpManifest.structuredContent.responses, sampleGameApiManifest.responses);

let responseFieldReadCount = 0;
const getterManifest = {
  ...sampleGameApiManifest,
  responses: {
    ...sampleGameApiManifest.responses,
    "GET /api/game/state": {
      description: "Fields returned by state reads.",
      get fields() {
        responseFieldReadCount += 1;
        return responseFieldReadCount === 1 ? ["sandboxId"] : ["constructor.prototype.safe"];
      },
      optionalFields: ["settings", "u.r.lTarget"]
    }
  }
};
const getterManifestBridge = createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async getManifest() {
    return getterManifest;
  }
});
const getterManifestResult = await getterManifestBridge.callTool("iocalc.get_manifest");
assert.equal(getterManifestResult.isError, true);
assert.equal(getterManifestResult.content[0].text.includes("constructor.prototype.safe"), false);
assert.equal(responseFieldReadCount, 0);

const mcpCapabilities = await mcpBridge.callTool("iocalc.get_capabilities");
assert.equal(mcpCapabilities.isError, undefined);
assertSafeCapabilities(mcpCapabilities.structuredContent);

const mcpSettingsState = await mcpBridge.callTool("iocalc.get_state");
assert.equal(mcpSettingsState.isError, undefined);
assert.equal(mcpSettingsState.structuredContent.settings.councilor, "quartermaster");
assert.equal(mcpSettingsState.structuredContent.settingEffects.food, 3);
assert.equal(mcpSettingsState.structuredContent.settings.feedbackTrustScore, undefined);
assert.equal(mcpSettingsState.structuredContent.settings.loginUrl, undefined);
assert.equal(mcpSettingsState.structuredContent.settings.urlFetchResult, undefined);
assert.equal(mcpSettingsState.structuredContent.settings["t.r.u.s.tDelta"], undefined);
assert.equal(mcpSettingsState.structuredContent.settings["u.r.lTarget"], undefined);
assert.equal(Object.hasOwn(mcpSettingsState.structuredContent.settings, "constructor"), false);
assert.equal(mcpSettingsState.structuredContent.settings.polluted, undefined);
assert.equal(mcpSettingsState.structuredContent.settingEffects.trustDelta, undefined);
assert.equal(mcpSettingsState.structuredContent.settingEffects.paymentEnabled, undefined);
assert.equal(mcpSettingsState.structuredContent.settingEffects.shellAccess, undefined);
assert.equal(mcpSettingsState.structuredContent.settingEffects.codeExecution, undefined);
assert.equal(Object.hasOwn(mcpSettingsState.structuredContent.settingEffects, "__proto__"), false);
assert.equal(mcpSettingsState.structuredContent.settingEffects.polluted, undefined);

const mcpSettingsResolution = await mcpBridge.callTool("iocalc.resolve_season", { seed: "settings-seed" });
assert.equal(mcpSettingsResolution.isError, undefined);
assert.equal(mcpSettingsResolution.structuredContent.settings.enterprise, "public-granaries");
assert.equal(mcpSettingsResolution.structuredContent.settings.feedbackTrustScore, undefined);
assert.equal(mcpSettingsResolution.structuredContent.settingEffects.urlFetchResult, undefined);

const mcpSettingsReport = await mcpBridge.callTool("iocalc.get_report");
assert.equal(mcpSettingsReport.isError, undefined);
assert.equal(mcpSettingsReport.structuredContent.structured.settings.enterprise, "public-granaries");
assert.equal(mcpSettingsReport.structuredContent.structured.settings.loginCookie, undefined);
assert.equal(mcpSettingsReport.structuredContent.structured.settingEffects.trustDelta, undefined);

const extraCapabilityBridge = createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async getCapabilities() {
    return {
      ...DEFAULT_SAFE_CAPABILITIES,
      permissions: ["wallet-admin"],
      secret: "api_key=do-not-leak"
    };
  }
});
const extraCapabilityResult = await extraCapabilityBridge.callTool("iocalc.get_capabilities");
assert.equal(extraCapabilityResult.structuredContent.permissions, undefined);
assert.equal(extraCapabilityResult.content[0].text.includes("wallet-admin"), false);

const unsafeMcpCalls = [];
const unsafeAdapterBridge = createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async getCapabilities() {
    unsafeMcpCalls.push("getCapabilities");
    return { ...DEFAULT_SAFE_CAPABILITIES, walletActionsEnabled: true };
  },
  async getState() {
    unsafeMcpCalls.push("getState");
    return { mode: "season_duel", season: 1 };
  }
});
const unsafeStateResult = await unsafeAdapterBridge.callTool("iocalc.get_state");
assert.equal(unsafeStateResult.isError, true);
assert.deepEqual(unsafeMcpCalls, ["getCapabilities"]);

const disabledSubmitCalls = [];
const disabledSubmitBridge = createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async getCapabilities() {
    disabledSubmitCalls.push("getCapabilities");
    return { ...DEFAULT_SAFE_CAPABILITIES, canSubmitGameCommand: false };
  },
  async submitCommand() {
    disabledSubmitCalls.push("submitCommand");
    return { accepted: true, command: "repair wall" };
  }
});
const disabledSubmitResult = await disabledSubmitBridge.callTool("iocalc.submit_command", {
  mode: "season_duel",
  command: "repair wall"
});
assert.equal(disabledSubmitResult.isError, true);
assert.deepEqual(disabledSubmitCalls, ["getCapabilities"]);

const invalidArgCalls = [];
const invalidArgBridge = createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async getCapabilities() {
    invalidArgCalls.push("getCapabilities");
    return DEFAULT_SAFE_CAPABILITIES;
  }
});
const invalidArgResult = await invalidArgBridge.callTool("iocalc.submit_command", {
  mode: "season_duel",
  command: "   "
});
assert.equal(invalidArgResult.isError, true);
assert.deepEqual(invalidArgCalls, []);

const noisyStateBridge = createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async getState() {
    return {
      mode: "season_duel",
      season: 2,
      permissions: ["production-admin"],
      raw: { wallet: "do-not-return" },
      visibleText: "Season 2 wallet approval should be redacted.",
      agents: [
        {
          canonicalAgentId: "iocalc-agent-0001",
          controllerType: "production-admin",
          capabilityScope: ["canReadState", "walletActionsEnabled"],
          commandSource: "wallet-session"
        }
      ]
    };
  }
});
const noisyStateResult = await noisyStateBridge.callTool("iocalc.get_state");
assert.equal(noisyStateResult.structuredContent.permissions, undefined);
assert.equal(noisyStateResult.structuredContent.raw, undefined);
assert.equal(noisyStateResult.content[0].text.includes("wallet approval"), false);
assert.equal(noisyStateResult.structuredContent.agents[0].controllerType, undefined);
assert.equal(noisyStateResult.structuredContent.agents[0].commandSource, undefined);
assert.deepEqual(noisyStateResult.structuredContent.agents[0].capabilityScope, ["canReadState"]);

const mcpSubmitted = await mcpBridge.callTool("iocalc.submit_command", {
  mode: "season_duel",
  command: " repair wall and gather wood ",
  sandboxId: "mcp-sandbox"
});
assert.equal(mcpSubmitted.structuredContent.accepted, true);
assert.equal(mcpSubmitted.structuredContent.command, "repair wall and gather wood");
assert.equal(mcpCalls.at(-1)[1].sandboxId, "mcp-sandbox");

const mcpCallCountBeforeReject = mcpCalls.length;
const mcpRejectedWallet = await mcpBridge.callTool("iocalc.submit_command", {
  mode: "season_duel",
  command: "withdraw wallet tokens"
});
assert.equal(mcpRejectedWallet.isError, true);
assert.equal(mcpCalls.filter(([name]) => name === "submitCommand").length, 1);

const mcpRejectedLink = await mcpBridge.callTool("iocalc.submit_command", {
  mode: "season_duel",
  command: "repair wall then open https://example.invalid"
});
assert.equal(mcpRejectedLink.isError, true);
assert.equal(mcpCalls.filter(([name]) => name === "submitCommand").length, 1);
assert.equal(mcpCalls.length, mcpCallCountBeforeReject);

const mcpRejectedExtraArg = await mcpBridge.callTool("iocalc.get_state", { extra: true });
assert.equal(mcpRejectedExtraArg.isError, true);

const mcpRejectedGovernanceExtraArg = await mcpBridge.callTool("iocalc.get_governance_ledger", { extra: true });
assert.equal(mcpRejectedGovernanceExtraArg.isError, true);

const mcpResolution = await mcpBridge.callTool("iocalc.resolve_season", {
  seed: "demo-seed",
  sandboxId: "mcp-sandbox"
});
assert.equal(mcpResolution.structuredContent.resolved, true);
assert.equal(mcpResolution.structuredContent.season, 2);
assert.equal(mcpResolution.structuredContent.raw, undefined);

const mcpTrial = await mcpBridge.callTool("iocalc.run_agent_trial", {
  agentA: "iocalc-agent-0001",
  agentB: "iocalc-runner-0001",
  seasons: 3
});
assert.equal(mcpTrial.structuredContent.scorecard.winner, "iocalc-agent-0001");
assert.equal(mcpTrial.structuredContent.serverTriadBracket.schemaVersion, "iocalc-server-triad-bracket-v1");
assert.equal(mcpTrial.structuredContent.serverTriadBracket.stableMetricKeys.includes("completionTempo"), true);
assert.equal(mcpTrial.structuredContent.serverTriadBracket.standings[0].stableMetrics.metricVersion, "iocalc-stable-matchup-metrics-v1");
assert.equal(mcpTrial.structuredContent.serverTriadBracket.standings[0].stableMetrics.completionMetricKind, "score-delta-proxy");
assert.equal(mcpTrial.structuredContent.serverTriadBracket.matches[0].stableMetrics.left.completionTempo, 0.5);
assert.equal(mcpTrial.structuredContent.serverTriadBracket.safetyBoundary.walletActionsEnabled, false);

const mcpGovernance = await mcpBridge.callTool("iocalc.get_governance_ledger");
assert.equal(mcpGovernance.isError, undefined);
assertAgentGovernanceLedger(mcpGovernance.structuredContent);
assert.equal(mcpGovernance.structuredContent.ledgerId, "ledger-mcp-0001");

const mcpCallCountBeforeBadAgent = mcpCalls.length;
const mcpRejectedAgentUrl = await mcpBridge.callTool("iocalc.run_agent_trial", {
  agentA: "https://example.invalid/agent",
  agentB: "iocalc-runner-0001",
  seasons: 1
});
assert.equal(mcpRejectedAgentUrl.isError, true);
assert.equal(mcpCalls.filter(([name]) => name === "runAgentTrial").length, 1);

const mcpRejectedAgentCode = await mcpBridge.callTool("iocalc.run_agent_trial", {
  agentA: "<script>alert(1)</script>",
  agentB: "iocalc-runner-0001",
  seasons: 1
});
assert.equal(mcpRejectedAgentCode.isError, true);
assert.equal(mcpCalls.filter(([name]) => name === "runAgentTrial").length, 1);
assert.equal(mcpCalls.length, mcpCallCountBeforeBadAgent);

const noisyTrialBridge = createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async runAgentTrial() {
    return {
      winner: "wallet-session",
      scorecard: { score: 1, permissions: ["production-admin"] },
      transcript: {
        transport: "production-admin",
        startedAt: "2026-06-26T00:00:00Z",
        events: [{ type: "wallet-session", at: "2026-06-26T00:00:00Z", data: { safe: "ok", secret: "do-not-return" } }]
      },
      serverTriadBracket: {
        schemaVersion: "wrong",
        source: "server-local-sandbox",
        standings: [{ stableMetrics: { metricVersion: "wrong" } }]
      }
    };
  }
});
const noisyTrial = await noisyTrialBridge.callTool("iocalc.run_agent_trial", {
  agentA: "iocalc-agent-0001",
  agentB: "iocalc-runner-0001",
  seasons: 1
});
assert.equal(noisyTrial.structuredContent.winner, undefined);
assert.equal(noisyTrial.structuredContent.scorecard.permissions, undefined);
assert.equal(noisyTrial.structuredContent.transcript.transport, "mcp");
assert.equal(noisyTrial.structuredContent.transcript.events[0].type, "error");
assert.equal(noisyTrial.structuredContent.transcript.events[0].data.secret, undefined);
assert.equal(noisyTrial.structuredContent.serverTriadBracket, undefined);

const mcpUnsupportedTrial = await createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  runAgentTrial: undefined
}).callTool("iocalc.run_agent_trial", {
  agentA: "iocalc-agent-0001",
  agentB: "iocalc-runner-0001",
  seasons: 1
});
assert.equal(mcpUnsupportedTrial.isError, true);

const mcpUnsupportedManifest = await createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  getManifest: undefined
}).callTool("iocalc.get_manifest");
assert.equal(mcpUnsupportedManifest.isError, true);

const mcpUnsupportedGovernanceLedger = await createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  getGovernanceLedger: undefined
}).callTool("iocalc.get_governance_ledger");
assert.equal(mcpUnsupportedGovernanceLedger.isError, true);

const mcpUnsafeManifest = await createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      inputPolicy: {
        ...sampleGameApiManifest.inputPolicy,
        submittedTextIsExecuted: true
      }
    };
  }
}).callTool("iocalc.get_manifest");
assert.equal(mcpUnsafeManifest.isError, true);
assert.equal(mcpUnsafeManifest.content[0].text.includes("Unsafe game API manifest"), true);
assert.equal(mcpUnsafeManifest.content[0].text.includes("execute"), false);

const mcpUnsafeRouteManifest = await createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      routes: [
        ...sampleGameApiManifest.routes,
        {
          method: "GET",
          path: "/api/game/../wallet?api_key=leak",
          purpose: "Leak unsafe route",
          body: "none",
          sideEffects: "none"
        }
      ]
    };
  }
}).callTool("iocalc.get_manifest");
assert.equal(mcpUnsafeRouteManifest.isError, true);
assert.equal(mcpUnsafeRouteManifest.content[0].text.includes("api_key"), false);

const mcpSecretTextManifest = await createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      description: "password hunter2"
    };
  }
}).callTool("iocalc.get_manifest");
assert.equal(mcpSecretTextManifest.isError, true);
assert.equal(mcpSecretTextManifest.content[0].text.includes("hunter2"), false);

const mcpUnsafeBoundaryManifest = await createIocalcMcpToolBridge({
  ...fakeMcpAdapter,
  async getManifest() {
    return {
      ...sampleGameApiManifest,
      boundary: {
        ...makeSandboxBoundaryDecision("read_manifest", "Read sandbox manifest"),
        action: "api.key=leak"
      }
    };
  }
}).callTool("iocalc.get_manifest");
assert.equal(mcpUnsafeBoundaryManifest.isError, true);
assert.equal(mcpUnsafeBoundaryManifest.content[0].text.includes("api.key"), false);

const unknownMcpTool = await mcpBridge.callTool("iocalc.approve_wallet_transaction");
assert.equal(unknownMcpTool.isError, true);
assert.equal(unknownMcpTool.content[0].text.includes("approve_wallet"), false);
assert.equal(unknownMcpTool.content[0].text.includes("wallet_transaction"), false);

const mcpUnsafeExtraArg = await mcpBridge.callTool("iocalc.get_state", {
  api_key_secret: "hunter2",
  walletUrl: "https://wallet.invalid"
});
assert.equal(mcpUnsafeExtraArg.isError, true);
assert.equal(mcpUnsafeExtraArg.content[0].text.includes("api_key_secret"), false);
assert.equal(mcpUnsafeExtraArg.content[0].text.includes("hunter2"), false);
assert.equal(mcpUnsafeExtraArg.content[0].text.includes("wallet.invalid"), false);

const mcpBridgeConformance = await runIocalcMcpToolBridgeConformance(mcpBridge);
assert.deepEqual(
  mcpBridgeConformance.filter((result) => !result.passed),
  []
);

const stdioInitialize = await handleIocalcMcpJsonRpcRequest(mcpBridge, {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: IOCALC_MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "smoke", version: "0.0.0" }
  }
});
assert.equal(stdioInitialize.result.protocolVersion, IOCALC_MCP_PROTOCOL_VERSION);
assert.equal(stdioInitialize.result.capabilities.tools.listChanged, false);
assert.equal(stdioInitialize.result.instructions.includes("wallet"), true);

const stdioTools = await handleIocalcMcpJsonRpcRequest(mcpBridge, {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {
    _meta: {
      progressToken: "stdio-smoke"
    }
  }
});
assert.equal(stdioTools.result.tools.some((tool) => tool.name === "iocalc.submit_command"), true);
assert.equal(stdioTools.result.tools.some((tool) => tool.name === "iocalc.get_governance_ledger"), true);
assert.equal(stdioTools.result.tools.every((tool) => tool.inputSchema.additionalProperties === false), true);

const stdioToolCall = await handleIocalcMcpJsonRpcRequest(mcpBridge, {
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "iocalc.submit_command",
    arguments: {
      mode: "season_duel",
      command: "repair wall and gather wood"
    },
    _meta: {
      progressToken: "stdio-smoke"
    }
  }
});
assert.equal(stdioToolCall.result.isError, false);
assert.equal(stdioToolCall.result.structuredContent.accepted, true);

const stdioUnsafeTool = await handleIocalcMcpJsonRpcRequest(mcpBridge, {
  jsonrpc: "2.0",
  id: 4,
  method: "tools/call",
  params: {
    name: "iocalc.wallet_withdraw_api_key_https://wallet.invalid",
    arguments: {}
  }
});
assert.equal(stdioUnsafeTool.result.isError, true);
assert.equal(stdioUnsafeTool.result.content[0].text.includes("wallet_withdraw"), false);
assert.equal(stdioUnsafeTool.result.content[0].text.includes("api_key"), false);
assert.equal(stdioUnsafeTool.result.content[0].text.includes("wallet.invalid"), false);

const stdioUnsupportedMethod = await handleIocalcMcpJsonRpcRequest(mcpBridge, {
  jsonrpc: "2.0",
  id: 5,
  method: "wallet.approve_https://wallet.invalid",
  params: { api_key: "hunter2" }
});
assert.equal(stdioUnsupportedMethod.error.code, -32601);
assert.equal(stdioUnsupportedMethod.error.message.includes("wallet"), false);
assert.equal(stdioUnsupportedMethod.error.message.includes("hunter2"), false);

const stdioBadJson = await handleIocalcMcpJsonRpcMessage(mcpBridge, "{wallet:");
assert.equal(stdioBadJson.error.code, -32700);
assert.equal(stdioBadJson.error.message.includes("wallet"), false);

const stdioOversizedJson = await handleIocalcMcpJsonRpcMessage(mcpBridge, "x".repeat(70000));
assert.equal(stdioOversizedJson.error.code, -32700);

const mcpOriginalFetch = globalThis.fetch;
const mcpHttpRequests = [];
globalThis.fetch = async (url) => {
  mcpHttpRequests.push(String(url));
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => DEFAULT_SAFE_CAPABILITIES
  };
};
const httpMcpBridge = createIocalcHttpMcpToolBridge({
  baseUrl: "http://127.0.0.1:8090",
  sandboxId: "mcp-http-sandbox"
});
const httpMcpCapabilities = await httpMcpBridge.callTool("iocalc.get_capabilities");
assertSafeCapabilities(httpMcpCapabilities.structuredContent);
assert.equal(mcpHttpRequests[0].includes("/api/game/capabilities"), true);
assert.equal(mcpHttpRequests[0].includes("sandboxId=mcp-http-sandbox"), true);
globalThis.fetch = mcpOriginalFetch;
globalThis.fetch = async (url) => ({
  ok: false,
  status: 500,
  statusText: "Server Error",
  json: async () => ({})
});
const failingHttpMcpBridge = createIocalcHttpMcpToolBridge({
  baseUrl: "http://127.0.0.1:8090",
  sandboxId: "mcp-http-sandbox"
});
const failingHttpMcpResult = await failingHttpMcpBridge.callTool("iocalc.get_capabilities");
assert.equal(failingHttpMcpResult.isError, true);
assert.equal(failingHttpMcpResult.content[0].text.includes("127.0.0.1"), false);
assert.equal(failingHttpMcpResult.content[0].text.includes("mcp-http-sandbox"), false);
globalThis.fetch = mcpOriginalFetch;
assert.throws(
  () => createIocalcHttpMcpToolBridge({ baseUrl: "http://example.test", sandboxId: "mcp-http-sandbox" }),
  /localhost/
);
assert.throws(
  () => createIocalcHttpMcpToolBridge({ baseUrl: "http://play.iocalc.com", sandboxId: "mcp-http-sandbox" }),
  /https/
);
assert.throws(
  () => createIocalcHttpMcpToolBridge({ baseUrl: "https://play.iocalc.com/wallet", sandboxId: "mcp-http-sandbox" }),
  /host root/
);
assert.throws(
  () => createIocalcHttpMcpToolBridge({ baseUrl: "http://127.0.0.1:8090", sandboxId: "api_key" }),
  /sandboxId/
);

const stdioSandbox = await startLocalMcpSandboxServer();
const stdioChild = spawn(
  process.execPath,
  [
    "packages/mcp-server/dist/stdio.js",
    "--base-url",
    stdioSandbox.baseUrl,
    "--sandbox-id",
    "stdio-smoke"
  ],
  {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"]
  }
);
const stdioLines = createStdioLineReader(stdioChild.stdout);
const stdioExit = createChildExitWatcher(stdioChild);
let stdioStderr = "";
stdioChild.stderr.setEncoding("utf8");
stdioChild.stderr.on("data", (chunk) => {
  stdioStderr += chunk;
});

try {
  sendJsonRpcLine(stdioChild, 11, "initialize", {
    protocolVersion: IOCALC_MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "stdio-smoke", version: "0.0.0" }
  });
  const spawnedInitialize = JSON.parse(await stdioLines.nextLine());
  assert.equal(spawnedInitialize.result.serverInfo.name, "iocalc-mcp-server");

  sendJsonRpcLine(stdioChild, 12, "tools/list", {});
  const spawnedTools = JSON.parse(await stdioLines.nextLine());
  assert.equal(spawnedTools.result.tools.some((tool) => tool.name === "iocalc.get_capabilities"), true);
  assert.equal(spawnedTools.result.tools.some((tool) => tool.name === "iocalc.get_governance_ledger"), true);

  sendJsonRpcLine(stdioChild, 13, "tools/call", {
    name: "iocalc.get_capabilities",
    arguments: {}
  });
  const spawnedCapabilities = JSON.parse(await stdioLines.nextLine());
  assertSafeCapabilities(spawnedCapabilities.result.structuredContent);

  sendJsonRpcLine(stdioChild, 14, "tools/call", {
    name: "iocalc.submit_command",
    arguments: {
      mode: "season_duel",
      command: "repair wall and gather wood"
    }
  });
  const spawnedCommand = JSON.parse(await stdioLines.nextLine());
  assert.equal(spawnedCommand.result.structuredContent.accepted, true);
  assert.equal(spawnedCommand.result.structuredContent.command, "repair wall and gather wood");

  sendJsonRpcLine(stdioChild, 15, "tools/call", {
    name: "iocalc.get_governance_ledger",
    arguments: {}
  });
  const spawnedGovernanceLedger = JSON.parse(await stdioLines.nextLine());
  assert.equal(spawnedGovernanceLedger.result.isError, false);
  assertAgentGovernanceLedger(spawnedGovernanceLedger.result.structuredContent);

  sendJsonRpcLine(stdioChild, 16, "tools/call", {
    name: "iocalc.wallet_withdraw_api_key_https://wallet.invalid",
    arguments: {}
  });
  const spawnedUnsafeTool = JSON.parse(await stdioLines.nextLine());
  assert.equal(spawnedUnsafeTool.result.isError, true);
  assert.equal(spawnedUnsafeTool.result.content[0].text.includes("wallet_withdraw"), false);
  assert.equal(spawnedUnsafeTool.result.content[0].text.includes("api_key"), false);
  assert.equal(spawnedUnsafeTool.result.content[0].text.includes("wallet.invalid"), false);

  sendJsonRpcLine(stdioChild, 17, "wallet.approve_https://wallet.invalid", { api_key: "hunter2" });
  const spawnedUnsafeMethod = JSON.parse(await stdioLines.nextLine());
  assert.equal(spawnedUnsafeMethod.error.code, -32601);
  assert.equal(spawnedUnsafeMethod.error.message.includes("wallet"), false);
  assert.equal(spawnedUnsafeMethod.error.message.includes("hunter2"), false);
} finally {
  stdioChild.stdin.end();
  const exitResult = await stdioExit.wait(2000);
  assert.equal(exitResult.timedOut, false);
  assert.equal(exitResult.code, 0);
  assert.equal(exitResult.signal, null);
  await stdioSandbox.close();
}

assert.equal(stdioStderr, "");
assert.equal(stdioSandbox.requests.every((request) => request.startsWith("GET /api/game/") || request.startsWith("POST /api/game/")), true);
assert.equal(stdioSandbox.requests.some((request) => request.includes("/wallet")), false);

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

const governanceBoundary = makeSandboxBoundaryDecision("read_state", "Read sandbox state for local conformance.");
const governanceEntryA = {
  sequence: 1,
  id: "agl-entry-0001",
  at: "2026-06-27T00:00:01Z",
  eventType: "session-started",
  sessionId: "gov-run-0001",
  actor: {
    canonicalAgentId: "iocalc-guide-0001",
    displayName: "IOCALC Guide 001",
    controllerType: "advisor-fallback",
    commandSource: "fallback"
  },
  transport: "local-core",
  sandboxId: "governance-smoke",
  action: "read_state",
  summary: "Local sandbox state was read for governance smoke.",
  verdict: "allow",
  verdictWeight: 1,
  boundary: governanceBoundary,
  riskBand: {
    method: "deterministic-estimate",
    samples: 1,
    p05: 0,
    p50: 0,
    p95: 0,
    metric: "scope_delta",
    notes: "No scope change expected."
  },
  metadata: { season: 1, check: "smoke" }
};
const governanceEvidenceA = makeAgentGovernanceEntryEvidence(governanceEntryA);
const governanceEntryB = {
  sequence: 2,
  id: "agl-entry-0002",
  at: "2026-06-27T00:00:02Z",
  eventType: "failure-state",
  sessionId: "gov-run-0001",
  actor: {
    canonicalAgentId: "iocalc-guide-0001",
    displayName: "IOCALC Guide 001",
    controllerType: "advisor-fallback",
    commandSource: "fallback"
  },
  transport: "local-core",
  sandboxId: "governance-smoke",
  action: "failure_state",
  summary: "Local verifier selected a narrower route.",
  verdict: "review",
  verdictWeight: 0.75,
  boundary: governanceBoundary,
  failureState: {
    kind: "query-evidence-mismatch",
    route: "focus",
    confidence: 0.75,
    notes: "Command needed narrower evidence."
  },
  contamination: {
    sourceSessionId: "gov-run-0001",
    sourceAgentId: "iocalc-guide-0001",
    topologyHop: 0,
    signal: "none",
    quarantineRecommended: false,
    notes: "No cross agent drift observed."
  },
  metadata: { route: "focus", check: "smoke" }
};
const governanceEvidenceB = makeAgentGovernanceEntryEvidence(governanceEntryB, governanceEvidenceA.entryDigest);
const sampleGovernanceLedger = {
  schemaVersion: "iocalc-agent-governance-v1",
  project: "IOCALC",
  ledgerId: "ledger-local-0001",
  generatedAt: "2026-06-27T00:00:00Z",
  policy: DEFAULT_AGENT_GOVERNANCE_POLICY,
  sessions: [
    {
      sessionId: "gov-run-0001",
      canonicalAgentId: "iocalc-guide-0001",
      displayName: "IOCALC Guide 001",
      controllerType: "advisor-fallback",
      commandSource: "fallback",
      transport: "local-core",
      sandboxId: "governance-smoke",
      owner: "local-test",
      status: "active",
      startedAt: "2026-06-27T00:00:00Z",
      expiresAt: "2026-06-28T00:00:00Z",
      capabilityScope: ["canReadState", "canSubmitGameCommand", "canReadReport"],
      blockedCapabilities: [...IOCALC_FORBIDDEN_CAPABILITIES],
      policy: DEFAULT_AGENT_GOVERNANCE_POLICY
    }
  ],
  entries: [
    {
      ...governanceEntryA,
      evidence: governanceEvidenceA
    },
    {
      ...governanceEntryB,
      evidence: governanceEvidenceB
    }
  ],
  latestDigest: governanceEvidenceB.entryDigest
};
assertAgentGovernanceLedger(sampleGovernanceLedger);
assert.equal(makeIocalcGovernanceDigest({ b: 2, a: 1 }), makeIocalcGovernanceDigest({ a: 1, b: 2 }));
assert.deepEqual(
  runAgentGovernanceLedgerConformance(sampleGovernanceLedger).filter((result) => !result.passed),
  []
);
const brokenGovernanceLedger = {
  ...sampleGovernanceLedger,
  entries: [
    sampleGovernanceLedger.entries[0],
    {
      ...sampleGovernanceLedger.entries[1],
      evidence: {
        ...sampleGovernanceLedger.entries[1].evidence,
        previousDigest: "fnv1a64:0000000000000000",
        entryDigest: makeIocalcGovernanceDigest({
          previousDigest: "fnv1a64:0000000000000000",
          payloadDigest: sampleGovernanceLedger.entries[1].evidence.payloadDigest,
          canonicalization: "iocalc-stable-json-v1",
          digestAlgorithm: "fnv1a64-noncryptographic"
        })
      }
    }
  ]
};
assert.throws(() => assertAgentGovernanceLedger(brokenGovernanceLedger), /digest chain/);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      latestDigest: undefined
    }),
  /latest digest/
);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [
        {
          ...sampleGovernanceLedger.entries[0],
          evidence: {
            ...sampleGovernanceLedger.entries[0].evidence,
            payloadDigest: "fnv1a64:0000000000000000",
            entryDigest: makeIocalcGovernanceDigest({
              payloadDigest: "fnv1a64:0000000000000000",
              canonicalization: "iocalc-stable-json-v1",
              digestAlgorithm: "fnv1a64-noncryptographic"
            })
          }
        }
      ],
      latestDigest: makeIocalcGovernanceDigest({
        payloadDigest: "fnv1a64:0000000000000000",
        canonicalization: "iocalc-stable-json-v1",
        digestAlgorithm: "fnv1a64-noncryptographic"
      })
    }),
  /payload digest/
);
const unsafeGovernanceLedger = {
  ...sampleGovernanceLedger,
  entries: [
    {
      ...sampleGovernanceLedger.entries[0],
      summary: "api_key hunter2"
    }
  ],
  latestDigest: sampleGovernanceLedger.entries[0].evidence.entryDigest
};
assert.equal(runAgentGovernanceLedgerConformance(unsafeGovernanceLedger)[0].passed, false);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [
        {
          ...sampleGovernanceLedger.entries[0],
          summary: "open ftp://example.invalid"
        }
      ],
      latestDigest: sampleGovernanceLedger.entries[0].evidence.entryDigest
    }),
  /unsafe text/
);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [
        {
          ...sampleGovernanceLedger.entries[0],
          unexpectedAuthority: true
        }
      ],
      latestDigest: sampleGovernanceLedger.entries[0].evidence.entryDigest
    }),
  /unsupported key/
);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [
        {
          ...sampleGovernanceLedger.entries[0],
          summary: "wallet approval requested"
        }
      ],
      latestDigest: sampleGovernanceLedger.entries[0].evidence.entryDigest
    }),
  /unsafe text/
);
const unsafeSchemeGovernanceEntry = {
  ...governanceEntryA,
  summary: "open ssh:host"
};
const unsafeSchemeEvidence = makeAgentGovernanceEntryEvidence(unsafeSchemeGovernanceEntry);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [{ ...unsafeSchemeGovernanceEntry, evidence: unsafeSchemeEvidence }],
      latestDigest: unsafeSchemeEvidence.entryDigest
    }),
  /unsafe text/
);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      ledgerId: "walletAuthority"
    }),
  /unsafe text/
);
const unsafeIdGovernanceEntry = {
  ...governanceEntryA,
  id: "ssh:host"
};
const unsafeIdEvidence = makeAgentGovernanceEntryEvidence(unsafeIdGovernanceEntry);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [{ ...unsafeIdGovernanceEntry, evidence: unsafeIdEvidence }],
      latestDigest: unsafeIdEvidence.entryDigest
    }),
  /unsafe text/
);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      sessions: [
        {
          ...sampleGovernanceLedger.sessions[0],
          canonicalAgentId: "iocalc-wallet-lab-0001"
        }
      ]
    }),
  /canonical agent ID/
);
const unsafeWalletActorEntry = {
  ...governanceEntryA,
  actor: {
    ...governanceEntryA.actor,
    canonicalAgentId: "iocalc-wallet-lab-0001"
  }
};
const unsafeWalletActorEvidence = makeAgentGovernanceEntryEvidence(unsafeWalletActorEntry);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [{ ...unsafeWalletActorEntry, evidence: unsafeWalletActorEvidence }],
      latestDigest: unsafeWalletActorEvidence.entryDigest
    }),
  /canonical agent ID/
);
const unsafeContaminationSourceEntry = {
  ...governanceEntryB,
  contamination: {
    ...governanceEntryB.contamination,
    sourceAgentId: "iocalc-wallet-lab-0001"
  }
};
const unsafeContaminationSourceEvidence = makeAgentGovernanceEntryEvidence(
  unsafeContaminationSourceEntry,
  governanceEvidenceA.entryDigest
);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [
        { ...governanceEntryA, evidence: governanceEvidenceA },
        { ...unsafeContaminationSourceEntry, evidence: unsafeContaminationSourceEvidence }
      ],
      latestDigest: unsafeContaminationSourceEvidence.entryDigest
    }),
  /canonical agent ID/
);
const unsafeAuthorizationTextEntry = {
  ...governanceEntryA,
  summary: "authorization granted"
};
const unsafeAuthorizationTextEvidence = makeAgentGovernanceEntryEvidence(unsafeAuthorizationTextEntry);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [{ ...unsafeAuthorizationTextEntry, evidence: unsafeAuthorizationTextEvidence }],
      latestDigest: unsafeAuthorizationTextEvidence.entryDigest
    }),
  /unsafe text/
);
const unsafeAuthGrantMetadataEntry = {
  ...governanceEntryA,
  metadata: { authGrant: true }
};
const unsafeAuthGrantMetadataEvidence = makeAgentGovernanceEntryEvidence(unsafeAuthGrantMetadataEntry);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [{ ...unsafeAuthGrantMetadataEntry, evidence: unsafeAuthGrantMetadataEvidence }],
      latestDigest: unsafeAuthGrantMetadataEvidence.entryDigest
    }),
  /unsafe text/
);
const unsafeActionGovernanceEntry = {
  ...governanceEntryA,
  action: "approve_wallet_transaction"
};
const unsafeActionEvidence = makeAgentGovernanceEntryEvidence(unsafeActionGovernanceEntry);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [{ ...unsafeActionGovernanceEntry, evidence: unsafeActionEvidence }],
      latestDigest: unsafeActionEvidence.entryDigest
    }),
  /unsafe text/
);
const unsafeBoundaryGovernanceEntry = {
  ...governanceEntryA,
  boundary: {
    ...governanceBoundary,
    productionAuthority: true
  }
};
const unsafeBoundaryEvidence = makeAgentGovernanceEntryEvidence(unsafeBoundaryGovernanceEntry);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [{ ...unsafeBoundaryGovernanceEntry, evidence: unsafeBoundaryEvidence }],
      latestDigest: unsafeBoundaryEvidence.entryDigest
    }),
  /unsupported key/
);
const unsafeBoundaryReasonEntry = {
  ...governanceEntryA,
  boundary: {
    ...governanceBoundary,
    reason: "wallet_authority granted"
  }
};
const unsafeBoundaryReasonEvidence = makeAgentGovernanceEntryEvidence(unsafeBoundaryReasonEntry);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [{ ...unsafeBoundaryReasonEntry, evidence: unsafeBoundaryReasonEvidence }],
      latestDigest: unsafeBoundaryReasonEvidence.entryDigest
    }),
  /unsafe text/
);
const unsafeMetadataKeyEntry = {
  ...governanceEntryA,
  metadata: { walletAuthority: true }
};
const unsafeMetadataKeyEvidence = makeAgentGovernanceEntryEvidence(unsafeMetadataKeyEntry);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [{ ...unsafeMetadataKeyEntry, evidence: unsafeMetadataKeyEvidence }],
      latestDigest: unsafeMetadataKeyEvidence.entryDigest
    }),
  /unsafe text/
);
const unsafeContaminationFlagEntry = {
  ...governanceEntryB,
  contamination: {
    ...governanceEntryB.contamination,
    quarantineRecommended: "wallet_authority"
  }
};
const unsafeContaminationFlagEvidence = makeAgentGovernanceEntryEvidence(
  unsafeContaminationFlagEntry,
  governanceEvidenceA.entryDigest
);
assert.throws(
  () =>
    assertAgentGovernanceLedger({
      ...sampleGovernanceLedger,
      entries: [
        { ...governanceEntryA, evidence: governanceEvidenceA },
        { ...unsafeContaminationFlagEntry, evidence: unsafeContaminationFlagEvidence }
      ],
      latestDigest: unsafeContaminationFlagEvidence.entryDigest
    }),
  /quarantine flag/
);
const arrayExtraGovernanceLedger = {
  ...sampleGovernanceLedger,
  sessions: [...sampleGovernanceLedger.sessions]
};
Object.defineProperty(arrayExtraGovernanceLedger.sessions, "walletAuthority", {
  enumerable: true,
  value: true
});
assert.throws(() => assertAgentGovernanceLedger(arrayExtraGovernanceLedger), /array key/);
const nonEnumerableEntryLedger = {
  ...sampleGovernanceLedger,
  entries: [
    {
      ...governanceEntryA,
      evidence: governanceEvidenceA
    }
  ],
  latestDigest: governanceEvidenceA.entryDigest
};
Object.defineProperty(nonEnumerableEntryLedger.entries[0], "summary", {
  enumerable: false,
  value: governanceEntryA.summary
});
assert.throws(() => assertAgentGovernanceLedger(nonEnumerableEntryLedger), /non-enumerable/);
assert.throws(
  () =>
    makeIocalcGovernanceDigest(
      Object.defineProperty({}, "unsafe", {
        enumerable: true,
        get() {
          throw new Error("accessor should not run");
        }
      })
    ),
  /accessor/
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

async function startLocalMcpSandboxServer() {
  const requests = [];
  let season = 1;
  let command = "";
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    requests.push(`${request.method} ${requestUrl.pathname}`);

    try {
      if (request.method === "GET" && requestUrl.pathname === "/api/game/manifest") {
        sendJson(response, 200, sampleGameApiManifest);
        return;
      }
      if (request.method === "GET" && requestUrl.pathname === "/api/game/capabilities") {
        sendJson(response, 200, { ...DEFAULT_SAFE_CAPABILITIES, canRunAgentTrial: true });
        return;
      }
      if (request.method === "GET" && requestUrl.pathname === "/api/game/state") {
        sendJson(response, 200, {
          mode: "season_duel",
          season,
          pendingCommand: command,
          sandboxId: requestUrl.searchParams.get("sandboxId") ?? undefined
        });
        return;
      }
      if (request.method === "POST" && requestUrl.pathname === "/api/game/command") {
        const body = await readJsonBody(request);
        command = String(body.command ?? "").trim();
        sendJson(response, 200, {
          accepted: true,
          command,
          sandboxId: body.sandboxId
        });
        return;
      }
      if (request.method === "POST" && requestUrl.pathname === "/api/game/resolve") {
        season += 1;
        sendJson(response, 200, { resolved: true, season });
        return;
      }
      if (request.method === "GET" && requestUrl.pathname === "/api/game/report") {
        sendJson(response, 200, { text: `Season ${season} report`, structured: { season } });
        return;
      }
      if (request.method === "GET" && requestUrl.pathname === "/api/game/log") {
        sendJson(response, 200, { entries: [`Season ${season} log`] });
        return;
      }
      if (request.method === "GET" && requestUrl.pathname === "/api/game/match-history") {
        sendJson(response, 200, { matches: [{ season }] });
        return;
      }
      if (request.method === "GET" && requestUrl.pathname === "/api/game/governance-ledger") {
        sendJson(response, 200, mcpGovernanceLedger);
        return;
      }
      if (request.method === "POST" && requestUrl.pathname === "/api/game/agent-trial") {
        sendJson(response, 200, {
          scorecard: { winner: "iocalc-agent-0001" },
          transcript: { transport: "mcp", startedAt: "2026-06-27T00:00:00Z", events: [] },
          serverTriadBracket: sampleServerTriadBracket()
        });
        return;
      }
      sendJson(response, 404, { error: "not found" });
    } catch {
      sendJson(response, 500, { error: "sandbox server error" });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  assert.equal(typeof address, "object");
  assert.notEqual(address, null);
  assert.equal(typeof address.port, "number");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      })
  };
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 8192) {
      throw new Error("body too large");
    }
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function createStdioLineReader(stream) {
  let buffer = "";
  let ended = false;
  const queue = [];
  const waiters = [];

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const waiter = waiters.shift();
      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.resolve(line);
      } else {
        queue.push(line);
      }
      newlineIndex = buffer.indexOf("\n");
    }
  });
  stream.on("end", () => {
    ended = true;
    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("MCP stdio process ended before a response line was available."));
    }
  });

  return {
    nextLine(timeoutMs = 3000) {
      if (queue.length > 0) {
        return Promise.resolve(queue.shift());
      }
      if (ended) {
        return Promise.reject(new Error("MCP stdio process ended before a response line was available."));
      }
      return new Promise((resolve, reject) => {
        const waiter = {
          resolve,
          reject,
          timer: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
            reject(new Error("Timed out waiting for an MCP stdio response line."));
          }, timeoutMs)
        };
        waiters.push(waiter);
      });
    }
  };
}

function sendJsonRpcLine(child, id, method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
}

function createChildExitWatcher(child) {
  const exit = new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      resolve({ code, signal, timedOut: false });
    });
  });
  return {
    async wait(timeoutMs) {
      let timeout;
      const expired = new Promise((resolve) => {
        timeout = setTimeout(() => {
          child.kill("SIGKILL");
          resolve({ code: null, signal: "SIGKILL", timedOut: true });
        }, timeoutMs);
      });
      const result = await Promise.race([exit, expired]);
      clearTimeout(timeout);
      if (result.timedOut) {
        await exit;
      }
      return result;
    }
  };
}
