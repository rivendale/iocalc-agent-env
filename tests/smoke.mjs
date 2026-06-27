import assert from "node:assert/strict";
import {
  DEFAULT_SAFE_CAPABILITIES,
  IOCALC_FORBIDDEN_CAPABILITIES,
  IOCALC_SAFE_GAME_THEORY_PATTERNS,
  assertSafeCapabilities,
  assertSandboxGameApiManifest,
  assertSandboxBoundaryDecision,
  makeSandboxBoundaryDecision,
  normalizeGameCommand
} from "../packages/protocol/dist/index.js";
import {
  runAgentTrialConformance,
  runManifestConformance,
  runReadConformance,
  runResolveSeasonConformance,
  runSubmitCommandConformance
} from "../packages/conformance/dist/index.js";
import {
  IOCALC_MCP_TOOLS,
  createIocalcHttpMcpToolBridge,
  createIocalcMcpToolBridge
} from "../packages/mcp-server/dist/index.js";
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
      method: "POST",
      path: "/api/game/agent-trial",
      purpose: "Run local sandbox agent trial.",
      contentType: "application/json",
      maxBytes: 8192,
      sideEffects: "sandbox-trial-state-only"
    }
  ],
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
  const payload = pathname.endsWith("/manifest")
    ? sampleGameApiManifest
    : pathname.endsWith("/capabilities")
    ? DEFAULT_SAFE_CAPABILITIES
    : pathname.endsWith("/state")
      ? { sandboxId, mode: "season_duel", season: 0 }
      : pathname.endsWith("/command")
        ? { accepted: true, sandboxId, command: "repair wall and gather wood", warnings: [] }
        : pathname.endsWith("/resolve")
          ? { resolved: true, sandboxId, season: 1 }
          : pathname.endsWith("/report")
            ? { sandboxId, text: "report" }
            : pathname.endsWith("/log")
              ? { sandboxId, entries: [] }
              : pathname.endsWith("/match-history")
                ? { sandboxId, matches: [] }
                : { sandboxId, scorecard: {}, transcript: { transport: "http", startedAt: "2026-06-26T00:00:00Z", events: [] } };
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
await httpAdapter.runAgentTrial({
  agentA: "iocalc-agent-0001",
  agentB: "iocalc-runner-0001",
  seasons: 1
});

assert.equal(capturedRequests[0].url.includes("sandboxId=smoke-sandbox"), true);
assert.equal(capturedRequests[1].url.includes("sandboxId=override-sandbox"), true);
assert.equal(capturedRequests[1].body.sandboxId, "override-sandbox");
assert.equal(capturedRequests[2].body.sandboxId, "smoke-sandbox");
assert.equal(capturedRequests[3].body.sandboxId, "smoke-sandbox");
const httpManifest = await httpAdapter.getManifest();
assertSandboxGameApiManifest(httpManifest);
assert.equal(capturedRequests.at(-1).url.endsWith("/api/game/manifest"), true);
assert.equal(capturedRequests.at(-1).url.includes("sandboxId="), false);
assert.deepEqual(capturedRequests.at(-1).headers, {});
const manifestConformance = await runManifestConformance(httpAdapter);
assert.equal(manifestConformance.every((result) => result.passed), true);
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
    return { mode: "season_duel", season: 1 };
  },
  async submitCommand(input) {
    mcpCalls.push(["submitCommand", input]);
    return { accepted: true, command: input.command, sandboxId: input.sandboxId };
  },
  async resolveSeason(input) {
    mcpCalls.push(["resolveSeason", input]);
    return { resolved: true, season: 2, raw: input };
  },
  async getReport() {
    mcpCalls.push(["getReport"]);
    return { text: "Season report" };
  },
  async getLog() {
    mcpCalls.push(["getLog"]);
    return { entries: ["System log"] };
  },
  async getMatchHistory() {
    mcpCalls.push(["getMatchHistory"]);
    return { matches: [{ season: 1 }] };
  },
  async runAgentTrial(input) {
    mcpCalls.push(["runAgentTrial", input]);
    return {
      scorecard: { winner: input.agentA },
      transcript: { transport: "mcp", startedAt: "2026-06-26T00:00:00Z", events: [] }
    };
  }
};

assert.equal(IOCALC_MCP_TOOLS.some((tool) => tool.name === "iocalc.get_manifest"), true);
assert.equal(IOCALC_MCP_TOOLS.some((tool) => tool.name === "iocalc.submit_command"), true);
assert.equal(IOCALC_MCP_TOOLS.every((tool) => tool.inputSchema.additionalProperties === false), true);

const mcpBridge = createIocalcMcpToolBridge(fakeMcpAdapter);
const mcpManifest = await mcpBridge.callTool("iocalc.get_manifest");
assert.equal(mcpManifest.isError, undefined);
assertSandboxGameApiManifest(mcpManifest.structuredContent);
assert.equal(mcpManifest.content[0].text.includes("walletActionsEnabled"), true);
assert.notEqual(mcpManifest.structuredContent.commandRequest, sampleGameApiManifest.commandRequest);
assert.notEqual(mcpManifest.structuredContent.commandRequest.fields, sampleGameApiManifest.commandRequest.fields);

const mcpCapabilities = await mcpBridge.callTool("iocalc.get_capabilities");
assert.equal(mcpCapabilities.isError, undefined);
assertSafeCapabilities(mcpCapabilities.structuredContent);

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
