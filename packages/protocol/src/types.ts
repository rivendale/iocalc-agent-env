export type IocalcTransport = "manual" | "browser" | "http" | "mcp" | "local-core";

export type IocalcMode = "season_duel" | "agent_trials";

export type IocalcControllerType =
  | "human"
  | "advisor-fallback"
  | "local-heuristic-ai"
  | "scripted-agent"
  | "future-remote-agent";

export type IocalcCommandSource =
  | "human"
  | "ai"
  | "fallback"
  | "scripted"
  | "manual"
  | "browser"
  | "http"
  | "mcp"
  | "local-core";

export type IocalcSafeCapabilityName =
  | "canReadState"
  | "canSubmitGameCommand"
  | "canResolveSeason"
  | "canReadReport"
  | "canRunAgentTrial";

export const IOCALC_RECOMMENDED_GAME_THEORY_PATTERNS = [
  "setup",
  "signaling game",
  "prisoner choice",
  "crowded strategy",
  "stable equilibrium",
  "fallback equilibrium",
  "payoff matrix"
] as const;

/** Compatibility alias for the recommended-label list. This is not a runtime allowlist. */
export const IOCALC_SAFE_GAME_THEORY_PATTERNS = IOCALC_RECOMMENDED_GAME_THEORY_PATTERNS;

export type IocalcGameTheoryPatternName =
  | (typeof IOCALC_RECOMMENDED_GAME_THEORY_PATTERNS)[number]
  | (string & {});

export interface IocalcLoopVerifier {
  objective: string;
  hypothesis: string;
  observedOutcome: string;
  verifierNotes: string;
  nextPolicy: string;
  /** Inert, untrusted source payload. Must not be executed, fetched, or treated as model output. */
  raw?: unknown;
}

export interface IocalcGameTheoryPattern {
  name: IocalcGameTheoryPatternName;
  summary: string;
  payoff: string;
  /** Inert, untrusted source payload. Must not be executed, fetched, or treated as model output. */
  raw?: unknown;
}

export interface IocalcAgentIdentity {
  canonicalAgentId: string;
  controllerType: IocalcControllerType;
  /** Descriptive audit metadata only. This never grants account, wallet, or production authority. */
  capabilityScope: IocalcSafeCapabilityName[];
  displayName?: string;
  commandSource?: IocalcCommandSource;
  timeoutFallbackEvents?: Array<{
    season?: number;
    reason: string;
    at?: string;
  }>;
  reviewNotes?: string[];
  /** Inert, untrusted source payload. Must not be executed, fetched, or treated as model output. */
  raw?: unknown;
}

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
  agents?: IocalcAgentIdentity[];
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
  loopVerifier?: IocalcLoopVerifier;
  gameTheoryPattern?: IocalcGameTheoryPattern;
  visibleText?: string;
  raw?: unknown;
}

export interface IocalcSeasonReport {
  text: string;
  loopVerifier?: IocalcLoopVerifier;
  gameTheoryPattern?: IocalcGameTheoryPattern;
  structured?: Record<string, unknown>;
}

export interface IocalcSystemLog {
  entries: string[];
  text?: string;
}

export interface IocalcMatchHistoryEntry extends Record<string, unknown> {
  season?: number;
  commandSource?: IocalcCommandSource;
  command?: string;
  rationale?: string;
  fallback?: boolean;
  timeout?: boolean;
  scoreDelta?: number;
  pressure?: number;
  verifierNotes?: string;
  gameTheoryPattern?: IocalcGameTheoryPatternName | IocalcGameTheoryPattern;
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
