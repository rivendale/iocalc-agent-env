export type IocalcTransport = "manual" | "browser" | "http" | "mcp" | "local-core";

export type IocalcMode = "season_duel" | "agent_trials";

export interface IocalcCapabilities {
  canReadState: boolean;
  canSubmitGameCommand: boolean;
  canResolveSeason: boolean;
  canReadReport: boolean;
  canRunAgentTrial: boolean;
  walletActionsEnabled: false;
  feedbackCanMutateGameplay: false;
  externalUrlFetchEnabled: false;
  codeExecutionEnabled: false;
  secretsAccessEnabled: false;
  productionMutationEnabled: false;
}

export interface IocalcGameState {
  mode: IocalcMode;
  season: number;
  seed?: string;
  settlement?: Record<string, unknown>;
  resources?: Record<string, number>;
  risk?: Record<string, number>;
  visibleText?: string;
  raw?: unknown;
}

export interface SubmitCommandInput {
  mode: IocalcMode;
  command: string;
  agentName?: string;
  seed?: string;
}

export interface SubmitCommandResult {
  accepted: boolean;
  command: string;
  rejectedReason?: string;
  warnings?: string[];
}

export interface ResolveSeasonInput {
  seed?: string;
}

export interface SeasonResolution {
  resolved: boolean;
  season: number;
  changes?: Record<string, unknown>;
  score?: number;
  visibleText?: string;
  raw?: unknown;
}

export interface IocalcSeasonReport {
  text: string;
  structured?: Record<string, unknown>;
}

export interface IocalcSystemLog {
  entries: string[];
  text?: string;
}

export interface IocalcMatchHistory {
  matches: Array<Record<string, unknown>>;
}

export interface RunAgentTrialInput {
  agentA: string;
  agentB: string;
  seasons: number;
  seed?: string;
}

export interface AgentTrialResult {
  winner?: string;
  scorecard: Record<string, unknown>;
  transcript: IocalcTranscript;
}

export interface IocalcTranscriptEvent {
  type: "state" | "command" | "resolution" | "report" | "log" | "error";
  at: string;
  data: unknown;
}

export interface IocalcTranscript {
  transport: IocalcTransport;
  startedAt: string;
  completedAt?: string;
  events: IocalcTranscriptEvent[];
}

export interface IocalcPlayerAdapter {
  transport: IocalcTransport;
  getCapabilities(): Promise<IocalcCapabilities>;
  getState(): Promise<IocalcGameState>;
  submitCommand(input: SubmitCommandInput): Promise<SubmitCommandResult>;
  resolveSeason(input?: ResolveSeasonInput): Promise<SeasonResolution>;
  getReport(): Promise<IocalcSeasonReport>;
  getLog(): Promise<IocalcSystemLog>;
  getMatchHistory(): Promise<IocalcMatchHistory>;
  runAgentTrial?(input: RunAgentTrialInput): Promise<AgentTrialResult>;
}
