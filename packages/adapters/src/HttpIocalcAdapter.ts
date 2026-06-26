import {
  normalizeGameCommand,
  type AgentTrialResult,
  type IocalcCapabilities,
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

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { redirect: "error" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
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

function endpointUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl}/`).toString();
}

export class HttpIocalcAdapter implements IocalcPlayerAdapter {
  transport = "http" as const;
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  getCapabilities(): Promise<IocalcCapabilities> {
    return getJson(endpointUrl(this.baseUrl, "api/game/capabilities"));
  }

  getState(): Promise<IocalcGameState> {
    return getJson(endpointUrl(this.baseUrl, "api/game/state"));
  }

  submitCommand(input: SubmitCommandInput): Promise<SubmitCommandResult> {
    const result = normalizeGameCommand(input.command);
    if (!result.accepted) {
      return Promise.resolve({
        accepted: false,
        command: result.command,
        rejectedReason: result.rejectedReason,
        warnings: result.warnings
      });
    }

    return postJson(endpointUrl(this.baseUrl, "api/game/command"), {
      ...input,
      command: result.command
    });
  }

  resolveSeason(input?: ResolveSeasonInput): Promise<SeasonResolution> {
    return postJson(endpointUrl(this.baseUrl, "api/game/resolve"), input ?? {});
  }

  getReport(): Promise<IocalcSeasonReport> {
    return getJson(endpointUrl(this.baseUrl, "api/game/report"));
  }

  getLog(): Promise<IocalcSystemLog> {
    return getJson(endpointUrl(this.baseUrl, "api/game/log"));
  }

  getMatchHistory(): Promise<IocalcMatchHistory> {
    return getJson(endpointUrl(this.baseUrl, "api/game/match-history"));
  }

  runAgentTrial(input: RunAgentTrialInput): Promise<AgentTrialResult> {
    return postJson(endpointUrl(this.baseUrl, "api/game/agent-trial"), input);
  }
}
