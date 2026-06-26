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
  const payload = pathname.endsWith("/capabilities")
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
