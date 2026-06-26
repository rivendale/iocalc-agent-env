import type {
  IocalcCapabilities,
  IocalcGameState,
  IocalcMatchHistory,
  IocalcPlayerAdapter,
  IocalcSeasonReport,
  IocalcSystemLog,
  ResolveSeasonInput,
  RunAgentTrialInput,
  SeasonResolution,
  SubmitCommandInput,
  SubmitCommandResult,
  AgentTrialResult
} from "@iocalc/protocol";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json() as Promise<T>;
}

export class HttpIocalcAdapter implements IocalcPlayerAdapter {
  transport = "http" as const;

  constructor(private readonly baseUrl: string) {}

  getCapabilities(): Promise<IocalcCapabilities> {
    return getJson(`${this.baseUrl}/api/game/capabilities`);
  }

  getState(): Promise<IocalcGameState> {
    return getJson(`${this.baseUrl}/api/game/state`);
  }

  submitCommand(input: SubmitCommandInput): Promise<SubmitCommandResult> {
    return postJson(`${this.baseUrl}/api/game/command`, input);
  }

  resolveSeason(input?: ResolveSeasonInput): Promise<SeasonResolution> {
    return postJson(`${this.baseUrl}/api/game/resolve`, input ?? {});
  }

  getReport(): Promise<IocalcSeasonReport> {
    return getJson(`${this.baseUrl}/api/game/report`);
  }

  getLog(): Promise<IocalcSystemLog> {
    return getJson(`${this.baseUrl}/api/game/log`);
  }

  getMatchHistory(): Promise<IocalcMatchHistory> {
    return getJson(`${this.baseUrl}/api/game/match-history`);
  }

  runAgentTrial(input: RunAgentTrialInput): Promise<AgentTrialResult> {
    return postJson(`${this.baseUrl}/api/game/agent-trial`, input);
  }
}
