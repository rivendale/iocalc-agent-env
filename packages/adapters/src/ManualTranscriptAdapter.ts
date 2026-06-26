import {
  DEFAULT_SAFE_CAPABILITIES,
  normalizeGameCommand,
  type IocalcGameState,
  type IocalcSeasonReport,
  type IocalcSystemLog,
  type IocalcPlayerAdapter,
  type ResolveSeasonInput,
  type SeasonResolution,
  type SubmitCommandInput,
  type SubmitCommandResult
} from "@iocalc/protocol";

export class ManualTranscriptAdapter implements IocalcPlayerAdapter {
  transport = "manual" as const;

  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  }

  async getState(): Promise<IocalcGameState> {
    throw new Error("Manual mode requires the user to paste current game state.");
  }

  async submitCommand(input: SubmitCommandInput): Promise<SubmitCommandResult> {
    const result = normalizeGameCommand(input.command);
    if (!result.accepted) {
      return {
        accepted: false,
        command: result.command,
        rejectedReason: result.rejectedReason,
        warnings: result.warnings
      };
    }

    return {
      accepted: true,
      command: result.command,
      warnings: ["Manual mode: submit this command in the IOCALC UI.", ...result.warnings]
    };
  }

  async resolveSeason(_input?: ResolveSeasonInput): Promise<SeasonResolution> {
    throw new Error("Manual mode requires the user to resolve the season in the UI.");
  }

  async getReport(): Promise<IocalcSeasonReport> {
    throw new Error("Manual mode requires the user to paste the season report.");
  }

  async getLog(): Promise<IocalcSystemLog> {
    throw new Error("Manual mode requires the user to paste the system log.");
  }

  async getMatchHistory() {
    return { matches: [] };
  }
}
