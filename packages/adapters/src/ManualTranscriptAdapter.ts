import {
  DEFAULT_SAFE_CAPABILITIES,
  type IocalcPlayerAdapter,
  type SubmitCommandInput
} from "@iocalc/protocol";

export class ManualTranscriptAdapter implements IocalcPlayerAdapter {
  transport = "manual" as const;

  async getCapabilities() {
    return DEFAULT_SAFE_CAPABILITIES;
  }

  async getState() {
    throw new Error("Manual mode requires the user to paste current game state.");
  }

  async submitCommand(input: SubmitCommandInput) {
    return {
      accepted: true,
      command: input.command,
      warnings: ["Manual mode: submit this command in the IOCALC UI."]
    };
  }

  async resolveSeason() {
    throw new Error("Manual mode requires the user to resolve the season in the UI.");
  }

  async getReport() {
    throw new Error("Manual mode requires the user to paste the season report.");
  }

  async getLog() {
    throw new Error("Manual mode requires the user to paste the system log.");
  }

  async getMatchHistory() {
    return { matches: [] };
  }
}
