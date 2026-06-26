import type { IocalcPlayerAdapter } from "@iocalc/protocol";

export interface IocalcMcpToolSpec {
  name: string;
  description: string;
}

export const IOCALC_MCP_TOOLS: IocalcMcpToolSpec[] = [
  {
    name: "iocalc.get_capabilities",
    description: "Read sandbox IOCALC adapter capabilities. Must report wallet and production actions disabled."
  },
  {
    name: "iocalc.get_state",
    description: "Read sandbox IOCALC game state."
  },
  {
    name: "iocalc.submit_command",
    description: "Submit a sandbox seasonal game command. Does not touch wallets, secrets, feedback trust, or production state."
  },
  {
    name: "iocalc.resolve_season",
    description: "Resolve a deterministic sandbox IOCALC season."
  },
  {
    name: "iocalc.get_report",
    description: "Read the current sandbox season report."
  },
  {
    name: "iocalc.get_log",
    description: "Read the sandbox system log."
  },
  {
    name: "iocalc.get_match_history",
    description: "Read sandbox match history."
  },
  {
    name: "iocalc.run_agent_trial",
    description: "Run a sandbox-only IOCALC agent trial when the target adapter supports it."
  }
];

export function createIocalcMcpServerScaffold(_adapter: IocalcPlayerAdapter) {
  return {
    status: "scaffold",
    tools: IOCALC_MCP_TOOLS,
    note: "Wire these tool specs to an MCP SDK in a follow-up slice. Keep all tools sandbox-only."
  };
}
