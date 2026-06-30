import {
  normalizeGameCommand,
  type AgentTrialResult,
  type IocalcAgentGovernanceLedger,
  type IocalcCapabilities,
  type IocalcGameApiManifest,
  type IocalcGameState,
  type IocalcMatchHistory,
  type IocalcPlayerAdapter,
  type IocalcSeasonReport,
  type IocalcSystemLog,
  type ResolveSeasonInput,
  type RunAgentTrialInput,
  type SeasonResolution,
  type SubmitCommandInput,
  type SubmitCommandResult
} from "@iocalc/protocol";

export interface HttpIocalcAdapterOptions {
  baseUrl: string;
  sandboxId?: string;
}

const SANDBOX_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,78}[A-Za-z0-9])?$/;
const SECRET_SANDBOX_PATTERN = /(?:api[._-]*key|private[._-]*key|seed[._-]*phrase|mnemonic|password|(?:access|auth|bearer|oauth|refresh)[._-]*token|token|secret|credential|passwd)/i;

async function getJson<T>(url: string, sandboxId?: string): Promise<T> {
  const res = await fetch(url, {
    redirect: "error",
    headers: sandboxId ? { "x-iocalc-sandbox": sandboxId } : undefined
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown, sandboxId?: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sandboxId ? { "x-iocalc-sandbox": sandboxId } : {})
    },
    redirect: "error",
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json() as Promise<T>;
}

function normalizeBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("HTTP adapter baseUrl must use http or https.");
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function normalizeSandboxId(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !SANDBOX_ID_PATTERN.test(value) || SECRET_SANDBOX_PATTERN.test(value)) {
    throw new Error("sandboxId must be 1-80 ASCII characters using letters, numbers, underscore, hyphen, or dot.");
  }
  return value;
}

function endpointUrl(baseUrl: string, path: string, sandboxId?: string): string {
  const url = new URL(path, `${baseUrl}/`);
  if (sandboxId) {
    url.searchParams.set("sandboxId", sandboxId);
  }
  return url.toString();
}

function effectiveSandboxId(defaultSandboxId: string | undefined, inputSandboxId?: unknown): string | undefined {
  if (inputSandboxId !== undefined) {
    return normalizeSandboxId(inputSandboxId);
  }
  return normalizeSandboxId(defaultSandboxId);
}

function bodyWithSandbox<T extends object>(body: T, sandboxId?: string): T & { sandboxId?: string } {
  if (!sandboxId) return body;
  return { ...body, sandboxId };
}

export class HttpIocalcAdapter implements IocalcPlayerAdapter {
  transport = "http" as const;
  private readonly baseUrl: string;
  private readonly sandboxId?: string;

  constructor(baseUrlOrOptions: string | HttpIocalcAdapterOptions) {
    if (typeof baseUrlOrOptions === "string") {
      this.baseUrl = normalizeBaseUrl(baseUrlOrOptions);
      this.sandboxId = undefined;
      return;
    }
    this.baseUrl = normalizeBaseUrl(baseUrlOrOptions.baseUrl);
    this.sandboxId = normalizeSandboxId(baseUrlOrOptions.sandboxId);
  }

  getCapabilities(): Promise<IocalcCapabilities> {
    return getJson(endpointUrl(this.baseUrl, "api/game/capabilities", this.sandboxId), this.sandboxId);
  }

  getManifest(): Promise<IocalcGameApiManifest> {
    return getJson(endpointUrl(this.baseUrl, "api/game/manifest"));
  }

  getState(): Promise<IocalcGameState> {
    return getJson(endpointUrl(this.baseUrl, "api/game/state", this.sandboxId), this.sandboxId);
  }

  submitCommand(input: SubmitCommandInput): Promise<SubmitCommandResult> {
    const sandboxId = effectiveSandboxId(this.sandboxId, input.sandboxId);
    const result = normalizeGameCommand(input.command);
    if (!result.accepted) {
      return Promise.resolve({
        accepted: false,
        command: result.command,
        sandboxId,
        rejectedReason: result.rejectedReason,
        warnings: result.warnings
      });
    }

    return postJson(
      endpointUrl(this.baseUrl, "api/game/command", sandboxId),
      bodyWithSandbox(
        {
          ...input,
          command: result.command
        },
        sandboxId
      ),
      sandboxId
    );
  }

  resolveSeason(input?: ResolveSeasonInput): Promise<SeasonResolution> {
    const sandboxId = effectiveSandboxId(this.sandboxId, input?.sandboxId);
    return postJson(
      endpointUrl(this.baseUrl, "api/game/resolve", sandboxId),
      bodyWithSandbox(input ?? {}, sandboxId),
      sandboxId
    );
  }

  getReport(): Promise<IocalcSeasonReport> {
    return getJson(endpointUrl(this.baseUrl, "api/game/report", this.sandboxId), this.sandboxId);
  }

  getLog(): Promise<IocalcSystemLog> {
    return getJson(endpointUrl(this.baseUrl, "api/game/log", this.sandboxId), this.sandboxId);
  }

  getMatchHistory(): Promise<IocalcMatchHistory> {
    return getJson(endpointUrl(this.baseUrl, "api/game/match-history", this.sandboxId), this.sandboxId);
  }

  getGovernanceLedger(): Promise<IocalcAgentGovernanceLedger> {
    return getJson(endpointUrl(this.baseUrl, "api/game/governance-ledger", this.sandboxId), this.sandboxId);
  }

  runAgentTrial(input: RunAgentTrialInput): Promise<AgentTrialResult> {
    const sandboxId = effectiveSandboxId(this.sandboxId, input.sandboxId);
    return postJson(
      endpointUrl(this.baseUrl, "api/game/agent-trial", sandboxId),
      bodyWithSandbox(input, sandboxId),
      sandboxId
    );
  }
}
