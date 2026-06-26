import type { IocalcCapabilities } from "./types.js";

export const DEFAULT_SAFE_CAPABILITIES: IocalcCapabilities = {
  canReadState: true,
  canSubmitGameCommand: true,
  canResolveSeason: true,
  canReadReport: true,
  canRunAgentTrial: false,
  walletActionsEnabled: false,
  feedbackCanMutateGameplay: false,
  externalUrlFetchEnabled: false,
  codeExecutionEnabled: false,
  secretsAccessEnabled: false,
  productionMutationEnabled: false
};

export function assertSafeCapabilities(capabilities: IocalcCapabilities): void {
  if (capabilities.walletActionsEnabled) throw new Error("Unsafe capability: walletActionsEnabled");
  if (capabilities.feedbackCanMutateGameplay) throw new Error("Unsafe capability: feedbackCanMutateGameplay");
  if (capabilities.externalUrlFetchEnabled) throw new Error("Unsafe capability: externalUrlFetchEnabled");
  if (capabilities.codeExecutionEnabled) throw new Error("Unsafe capability: codeExecutionEnabled");
  if (capabilities.secretsAccessEnabled) throw new Error("Unsafe capability: secretsAccessEnabled");
  if (capabilities.productionMutationEnabled) throw new Error("Unsafe capability: productionMutationEnabled");
}
