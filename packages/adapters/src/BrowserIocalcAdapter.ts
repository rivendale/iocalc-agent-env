import {
  DEFAULT_SAFE_CAPABILITIES,
  makeSandboxBoundaryDecision,
  normalizeGameCommand,
  type IocalcCapabilities,
  type IocalcGameState,
  type IocalcMatchHistory,
  type IocalcPlayerAdapter,
  type IocalcSeasonReport,
  type IocalcSystemLog,
  type ResolveSeasonInput,
  type SeasonResolution,
  type SubmitCommandInput,
  type SubmitCommandResult
} from "@iocalc/protocol";

export interface BrowserIocalcLocator {
  fill?(value: string): Promise<void> | void;
  click?(): Promise<void> | void;
  innerText?(options?: Record<string, unknown>): Promise<string> | string;
  textContent?(options?: Record<string, unknown>): Promise<string | null> | string | null;
  count?(): Promise<number> | number;
}

export interface BrowserIocalcPage {
  goto?(url: string, options?: Record<string, unknown>): Promise<unknown> | unknown;
  waitForLoadState?(state?: string, options?: Record<string, unknown>): Promise<unknown> | unknown;
  locator(selector: string): BrowserIocalcLocator;
  url?(): string;
}

export interface BrowserIocalcAdapterOptions {
  page: BrowserIocalcPage;
  baseUrl?: string;
}

export const BROWSER_IOCALC_SELECTORS = {
  seasonCommand: '[data-testid="season-command"]',
  resolveSeason: '[data-testid="resolve-season"]',
  seasonReport: '[data-testid="season-report"]',
  systemLog: '[data-testid="system-log"]',
  matchHistory: '[data-testid="match-history"]',
  agentTrialsPanel: '[data-testid="agent-trials-panel"]'
} as const;

const MAX_BROWSER_COMMAND_LENGTH = 320;

const SAFE_SETTLEMENT_WORDS = new Set([
  "a",
  "an",
  "and",
  "balanced",
  "bastion",
  "build",
  "building",
  "cautious",
  "citadel",
  "coin",
  "coins",
  "compare",
  "damage",
  "defend",
  "defense",
  "defenses",
  "expand",
  "explore",
  "farm",
  "farms",
  "field",
  "fields",
  "food",
  "for",
  "forge",
  "fortification",
  "fortify",
  "foundry",
  "gather",
  "grow",
  "harvest",
  "hold",
  "improve",
  "in",
  "keep",
  "map",
  "mine",
  "morale",
  "observe",
  "of",
  "or",
  "ore",
  "plan",
  "prepare",
  "pressure",
  "protect",
  "quarry",
  "raise",
  "ration",
  "reduce",
  "reinforce",
  "relay",
  "repair",
  "reserve",
  "resources",
  "revise",
  "rival",
  "rivals",
  "route",
  "scout",
  "scouting",
  "settlement",
  "settlements",
  "signal",
  "signals",
  "spire",
  "stone",
  "store",
  "storehouse",
  "survey",
  "the",
  "then",
  "to",
  "trade",
  "upgrade",
  "wall",
  "walls",
  "watch",
  "while",
  "with",
  "wood",
  "workers"
]);

const FORBIDDEN_BROWSER_COMMAND_TERMS =
  /\b(?:account|api[_ -]?key|auth|base|bearer|bitcoin|broker|coinbase|contract|crypto|deploy|deployment|eval|execute|fetch|financial|login|mnemonic|oauth|password|private[_ -]?key|production|secret|seed phrase|shell|sudo|token|transaction|transfer|wallet|withdraw)\b/i;
const ASCII_PRINTABLE_PATTERN = /^[\x20-\x7E]+$/;
const OFFICIAL_PLAY_HOSTS = new Set(["play.iocalc.com"]);
const ALLOWED_PLAY_PATHS = new Set(["/", "/index.html", "/play", "/play/"]);

function normalizeBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Browser adapter baseUrl must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("Browser adapter baseUrl must not include credentials.");
  }
  if (!isAllowedPlayHost(url.hostname)) {
    throw new Error("Browser adapter baseUrl must target localhost, 127.0.0.1, [::1], or play.iocalc.com.");
  }
  if (OFFICIAL_PLAY_HOSTS.has(url.hostname.toLowerCase()) && url.protocol !== "https:") {
    throw new Error("Browser adapter baseUrl must use https for play.iocalc.com.");
  }
  if (!ALLOWED_PLAY_PATHS.has(url.pathname)) {
    throw new Error("Browser adapter baseUrl must target the sandbox play UI root or /play path.");
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function validateFinalUrl(finalUrl: string): void {
  const url = new URL(finalUrl);
  if (url.search || url.hash) {
    throw new Error("Browser adapter final URL must not include query or hash values.");
  }
  normalizeBaseUrl(finalUrl);
}

function isAllowedPlayHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1" || OFFICIAL_PLAY_HOSTS.has(host);
}

function normalizeVisibleText(value: string | null | undefined): string {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function textLines(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSeason(value: string): number {
  const match = /\bseason\s+(\d+)\b/i.exec(value);
  if (!match) return 0;
  return Number.parseInt(match[1], 10);
}

function tokensFor(command: string): string[] {
  return command.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function findUnsafeSettlementTerms(command: string): string[] {
  const unsafe = new Set<string>();
  for (const token of tokensFor(command)) {
    if (/^\d+$/.test(token)) continue;
    if (!SAFE_SETTLEMENT_WORDS.has(token)) unsafe.add(token);
  }
  return [...unsafe].sort();
}

function rejectResult(command: string, rejectedReason: string, warnings: string[] = []): SubmitCommandResult {
  return {
    accepted: false,
    command,
    rejectedReason,
    warnings,
    boundary: makeSandboxBoundaryDecision("reject_request", rejectedReason, false)
  };
}

export class BrowserIocalcAdapter implements IocalcPlayerAdapter {
  transport = "browser" as const;
  private readonly page: BrowserIocalcPage;
  private readonly baseUrl?: string;
  private navigated = false;
  private selectorsVerified = false;

  constructor(options: BrowserIocalcAdapterOptions) {
    this.page = options.page;
    this.baseUrl = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : undefined;
  }

  async getCapabilities(): Promise<IocalcCapabilities> {
    await this.ensureReady();
    return {
      ...DEFAULT_SAFE_CAPABILITIES,
      canRunAgentTrial: false,
      boundary: makeSandboxBoundaryDecision(
        "read_capabilities",
        "Browser adapter exposes only fixed-selector sandbox gameplay capabilities."
      )
    };
  }

  async getState(): Promise<IocalcGameState> {
    await this.ensureReady();
    const [reportText, logText, matchHistoryText, agentTrialsText] = await Promise.all([
      this.readText(BROWSER_IOCALC_SELECTORS.seasonReport),
      this.readText(BROWSER_IOCALC_SELECTORS.systemLog),
      this.readText(BROWSER_IOCALC_SELECTORS.matchHistory),
      this.readText(BROWSER_IOCALC_SELECTORS.agentTrialsPanel)
    ]);
    const visibleText = [reportText, logText, matchHistoryText, agentTrialsText].filter(Boolean).join("\n\n");

    return {
      mode: "season_duel",
      season: parseSeason(visibleText),
      visibleText,
      boundary: makeSandboxBoundaryDecision("read_state", "Read visible sandbox game state through fixed selectors."),
      raw: {
        selectors: BROWSER_IOCALC_SELECTORS,
        seasonReport: reportText,
        systemLog: logText,
        matchHistory: matchHistoryText,
        agentTrialsPanel: agentTrialsText,
        walletActionsEnabled: false,
        feedbackCanMutateGameplay: false,
        externalUrlFetchEnabled: false,
        codeExecutionEnabled: false,
        secretsAccessEnabled: false,
        productionMutationEnabled: false
      }
    };
  }

  async submitCommand(input: SubmitCommandInput): Promise<SubmitCommandResult> {
    await this.ensureReady();
    const result = normalizeGameCommand(input.command, { maxLength: MAX_BROWSER_COMMAND_LENGTH });
    if (!result.accepted) {
      return rejectResult(result.command, result.rejectedReason ?? "Invalid IOCALC game command.", result.warnings);
    }

    if (!ASCII_PRINTABLE_PATTERN.test(result.command)) {
      return rejectResult(result.command, "Browser commands must use printable ASCII text only.", result.warnings);
    }

    if (result.warnings.length > 0 || FORBIDDEN_BROWSER_COMMAND_TERMS.test(result.command)) {
      return rejectResult(
        result.command,
        "Browser adapter rejected non-gameplay, link-like, code-like, secret-like, wallet, account, production, or financial command text.",
        result.warnings
      );
    }

    const unsafeTerms = findUnsafeSettlementTerms(result.command);
    if (unsafeTerms.length > 0) {
      return rejectResult(
        result.command,
        `Browser adapter accepted only settlement gameplay terms; rejected: ${unsafeTerms.join(", ")}.`,
        result.warnings
      );
    }

    const commandBox = this.page.locator(BROWSER_IOCALC_SELECTORS.seasonCommand);
    if (!commandBox.fill) {
      throw new Error("Browser page locator does not support filling the season command control.");
    }
    await commandBox.fill(result.command);

    return {
      accepted: true,
      command: result.command,
      warnings: result.warnings,
      boundary: makeSandboxBoundaryDecision("submit_command", "Typed inert sandbox gameplay command into fixed UI selector.")
    };
  }

  async resolveSeason(input?: ResolveSeasonInput): Promise<SeasonResolution> {
    if (input?.seed || input?.sandboxId) {
      throw new Error("Browser adapter cannot apply seed or sandboxId through UI; use HTTP or local-core adapters.");
    }
    await this.ensureReady();
    const resolveButton = this.page.locator(BROWSER_IOCALC_SELECTORS.resolveSeason);
    if (!resolveButton.click) {
      throw new Error("Browser page locator does not support clicking the resolve-season control.");
    }
    await resolveButton.click();
    const reportText = await this.readText(BROWSER_IOCALC_SELECTORS.seasonReport);

    return {
      resolved: true,
      season: parseSeason(reportText),
      visibleText: reportText,
      boundary: makeSandboxBoundaryDecision("resolve_season", "Clicked fixed sandbox resolve-season selector."),
      raw: {
        selector: BROWSER_IOCALC_SELECTORS.resolveSeason
      }
    };
  }

  async getReport(): Promise<IocalcSeasonReport> {
    await this.ensureReady();
    const text = await this.readText(BROWSER_IOCALC_SELECTORS.seasonReport);
    return {
      text,
      boundary: makeSandboxBoundaryDecision("read_report", "Read visible season report through fixed selector.")
    };
  }

  async getLog(): Promise<IocalcSystemLog> {
    await this.ensureReady();
    const text = await this.readText(BROWSER_IOCALC_SELECTORS.systemLog);
    return {
      entries: textLines(text),
      text,
      boundary: makeSandboxBoundaryDecision("read_log", "Read visible system log through fixed selector.")
    };
  }

  async getMatchHistory(): Promise<IocalcMatchHistory> {
    await this.ensureReady();
    const text = await this.readText(BROWSER_IOCALC_SELECTORS.matchHistory);
    return {
      matches: textLines(text).map((line) => ({ text: line })),
      boundary: makeSandboxBoundaryDecision("read_match_history", "Read visible match history through fixed selector.")
    };
  }

  private async ensureReady(): Promise<void> {
    if (this.navigated || !this.baseUrl) {
      await this.verifyFixedSelectors();
      return;
    }
    if (!this.page.goto) {
      throw new Error("Browser adapter baseUrl was supplied, but page.goto is unavailable.");
    }
    if (!this.page.url) {
      throw new Error("Browser adapter baseUrl requires page.url so navigation redirects can be verified.");
    }
    await this.page.goto(this.baseUrl, { waitUntil: "domcontentloaded" });
    if (this.page.waitForLoadState) {
      await this.page.waitForLoadState("domcontentloaded", { timeout: 5000 });
    }
    validateFinalUrl(this.page.url());
    this.navigated = true;
    await this.verifyFixedSelectors();
  }

  private async readText(selector: string): Promise<string> {
    const locator = this.page.locator(selector);
    if (locator.count && (await locator.count()) !== 1) {
      throw new Error(`Browser page must expose exactly one ${selector} control.`);
    }
    if (locator.innerText) return normalizeVisibleText(await locator.innerText({ timeout: 5000 }));
    if (locator.textContent) return normalizeVisibleText(await locator.textContent({ timeout: 5000 }));
    throw new Error(`Browser page locator cannot read text for ${selector}.`);
  }

  private async verifyFixedSelectors(): Promise<void> {
    if (this.selectorsVerified) return;
    for (const selector of Object.values(BROWSER_IOCALC_SELECTORS)) {
      const locator = this.page.locator(selector);
      if (!locator.count) {
        throw new Error("Browser page locator must support count() for fixed selector verification.");
      }
      const count = await locator.count();
      if (count !== 1) {
        throw new Error(`Browser page must expose exactly one ${selector} control.`);
      }
    }
    this.selectorsVerified = true;
  }
}

export class PlaywrightIocalcAdapter extends BrowserIocalcAdapter {}
