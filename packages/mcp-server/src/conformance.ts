export interface IocalcMcpBridgeConformanceResult {
  name: string;
  passed: boolean;
  message?: string;
}

interface IocalcMcpConformanceTool {
  name: string;
  inputSchema?: {
    additionalProperties?: unknown;
  };
}

interface IocalcMcpConformanceToolResult {
  isError?: boolean;
  content?: unknown;
  structuredContent?: unknown;
}

export interface IocalcMcpConformanceBridge {
  tools: IocalcMcpConformanceTool[];
  callTool(name: string, args?: unknown): Promise<IocalcMcpConformanceToolResult>;
}

const EXPECTED_MCP_TOOL_NAMES = [
  "iocalc.get_manifest",
  "iocalc.get_capabilities",
  "iocalc.get_state",
  "iocalc.submit_command",
  "iocalc.resolve_season",
  "iocalc.get_report",
  "iocalc.get_log",
  "iocalc.get_match_history",
  "iocalc.run_agent_trial"
];

const UNSAFE_ECHO_FRAGMENTS = [
  "api_key",
  "api-key",
  "api.key",
  "apikey",
  "api key",
  "private_key",
  "private-key",
  "private.key",
  "privatekey",
  "private key",
  "seed_phrase",
  "seed-phrase",
  "seed.phrase",
  "seedphrase",
  "seed phrase",
  "wallet_url",
  "wallet-url",
  "wallet.url",
  "walleturl",
  "wallet.invalid",
  "wallet_withdraw",
  "approve_wallet",
  "hunter2",
  "https://"
];

export async function runIocalcMcpToolBridgeConformance(
  bridge: IocalcMcpConformanceBridge
): Promise<IocalcMcpBridgeConformanceResult[]> {
  const results: IocalcMcpBridgeConformanceResult[] = [];
  results.push(checkToolList(bridge.tools));
  results.push(checkToolSchemasClosed(bridge.tools));
  results.push(
    await checkUnsafeCallRejected(
      "mcp-unknown-tool-rejects-without-echo",
      bridge,
      "iocalc.wallet_withdraw_api_key_https://wallet.invalid",
      {}
    )
  );
  results.push(
    await checkUnsafeCallRejected("mcp-extra-arg-rejects-without-echo", bridge, "iocalc.get_state", {
      api_key_secret: "hunter2",
      walletUrl: "https://wallet.invalid"
    })
  );
  results.push(
    await checkUnsafeCallRejected("mcp-unsafe-command-rejects-without-echo", bridge, "iocalc.submit_command", {
      mode: "season_duel",
      command: "repair wall then open https://wallet.invalid with api_key=hunter2"
    })
  );
  results.push(
    await checkUnsafeCallRejected("mcp-unsafe-agent-id-rejects-without-echo", bridge, "iocalc.run_agent_trial", {
      agentA: "https://wallet.invalid/api_key",
      agentB: "iocalc-runner-0001",
      seasons: 1
    })
  );
  return results;
}

function checkToolList(tools: IocalcMcpConformanceTool[]): IocalcMcpBridgeConformanceResult {
  const names = tools.map((tool) => tool.name);
  const uniqueNames = new Set(names);
  const missing = EXPECTED_MCP_TOOL_NAMES.filter((name) => !uniqueNames.has(name));
  const extra = names.filter((name) => !EXPECTED_MCP_TOOL_NAMES.includes(name));
  if (names.length !== uniqueNames.size || missing.length > 0 || extra.length > 0) {
    return {
      name: "mcp-tool-list",
      passed: false,
      message: "MCP bridge must expose exactly the IOCALC sandbox tool set."
    };
  }
  return { name: "mcp-tool-list", passed: true };
}

function checkToolSchemasClosed(tools: IocalcMcpConformanceTool[]): IocalcMcpBridgeConformanceResult {
  const openTool = tools.find((tool) => tool.inputSchema?.additionalProperties !== false);
  if (openTool) {
    return {
      name: "mcp-tool-schemas-closed",
      passed: false,
      message: "MCP tool input schemas must reject additional properties."
    };
  }
  return { name: "mcp-tool-schemas-closed", passed: true };
}

async function checkUnsafeCallRejected(
  name: string,
  bridge: IocalcMcpConformanceBridge,
  toolName: string,
  args: unknown
): Promise<IocalcMcpBridgeConformanceResult> {
  let result: IocalcMcpConformanceToolResult;
  try {
    result = await bridge.callTool(toolName, args);
  } catch {
    return {
      name,
      passed: false,
      message: "MCP tool calls must return safe error results instead of throwing."
    };
  }
  if (result.isError !== true) {
    return {
      name,
      passed: false,
      message: "Unsafe MCP probe was not rejected."
    };
  }
  if (containsUnsafeEcho(result)) {
    return {
      name,
      passed: false,
      message: "MCP error result reflected unsafe caller-controlled text."
    };
  }
  return { name, passed: true };
}

function containsUnsafeEcho(result: IocalcMcpConformanceToolResult): boolean {
  const text = safeJson(result).toLowerCase();
  return UNSAFE_ECHO_FRAGMENTS.some((fragment) => text.includes(fragment));
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}
