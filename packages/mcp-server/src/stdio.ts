#!/usr/bin/env node
import { createInterface } from "node:readline";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { HttpIocalcAdapterOptions } from "@iocalc/adapters";
import { createIocalcHttpMcpToolBridge, type IocalcMcpToolBridge, type IocalcMcpToolResult } from "./index.js";

export const IOCALC_MCP_PROTOCOL_VERSION = "2025-06-18";

export interface IocalcMcpJsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface IocalcMcpJsonRpcSuccess {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
}

export interface IocalcMcpJsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
  };
}

export type IocalcMcpJsonRpcResponse = IocalcMcpJsonRpcSuccess | IocalcMcpJsonRpcError;

export interface IocalcMcpStdioServerOptions {
  bridge: IocalcMcpToolBridge;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export interface IocalcMcpStdioCliOptions extends Pick<HttpIocalcAdapterOptions, "baseUrl" | "sandboxId"> {
  help?: boolean;
}

const JSON_RPC_VERSION = "2.0";
const MAX_STDIO_MESSAGE_CHARS = 65536;
const SAFE_SERVER_INSTRUCTIONS =
  "IOCALC MCP exposes sandbox game tools only: read state, submit inert commands, resolve seasons, read reports/logs/history, and run sandbox trials. It grants no wallet, secret, account, feedback-trust, deployment, production, code-execution, arbitrary URL, or financial authority.";

export async function runIocalcMcpStdioServer(options: IocalcMcpStdioServerOptions): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const lines = createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line.trim()) continue;
    const response = await handleIocalcMcpJsonRpcMessage(options.bridge, line);
    if (response) {
      output.write(`${JSON.stringify(response)}\n`);
    }
  }
}

export async function handleIocalcMcpJsonRpcMessage(
  bridge: IocalcMcpToolBridge,
  message: string
): Promise<IocalcMcpJsonRpcResponse | undefined> {
  if (message.length > MAX_STDIO_MESSAGE_CHARS) {
    return jsonRpcError(null, -32700, "Invalid JSON-RPC message.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch {
    return jsonRpcError(null, -32700, "Invalid JSON-RPC message.");
  }
  return handleIocalcMcpJsonRpcRequest(bridge, parsed);
}

export async function handleIocalcMcpJsonRpcRequest(
  bridge: IocalcMcpToolBridge,
  request: unknown
): Promise<IocalcMcpJsonRpcResponse | undefined> {
  if (!isPlainObject(request)) {
    return jsonRpcError(null, -32600, "Invalid JSON-RPC request.");
  }

  const id = readJsonRpcId(request.id);
  const isNotification = !Object.hasOwn(request, "id");

  if (request.jsonrpc !== JSON_RPC_VERSION || typeof request.method !== "string") {
    return isNotification ? undefined : jsonRpcError(id, -32600, "Invalid JSON-RPC request.");
  }

  try {
    switch (request.method) {
      case "initialize":
        return isNotification ? undefined : jsonRpcSuccess(id, createInitializeResult());
      case "ping":
        return isNotification ? undefined : jsonRpcSuccess(id, {});
      case "notifications/initialized":
        return undefined;
      case "tools/list":
        return isNotification ? undefined : jsonRpcSuccess(id, createToolsListResult(bridge, request.params));
      case "tools/call":
        return isNotification ? undefined : jsonRpcSuccess(id, await callToolFromJsonRpc(bridge, request.params));
      default:
        return isNotification ? undefined : jsonRpcError(id, -32601, "Unsupported MCP stdio method.");
    }
  } catch {
    return isNotification ? undefined : jsonRpcError(id, -32602, "Invalid MCP stdio parameters.");
  }
}

export function parseIocalcMcpStdioCliOptions(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): IocalcMcpStdioCliOptions {
  let baseUrl = env.IOCALC_BASE_URL ?? "http://127.0.0.1:8090";
  let sandboxId = env.IOCALC_SANDBOX_ID ?? "mcp-stdio-local";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      return { baseUrl, sandboxId, help: true };
    }
    if (arg === "--base-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing MCP stdio CLI option value.");
      baseUrl = value;
      index += 1;
      continue;
    }
    if (arg === "--sandbox-id") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing MCP stdio CLI option value.");
      sandboxId = value;
      index += 1;
      continue;
    }
    throw new Error("Unsupported MCP stdio CLI option.");
  }

  return { baseUrl, sandboxId };
}

export function createIocalcMcpStdioHttpBridge(options: IocalcMcpStdioCliOptions): IocalcMcpToolBridge {
  return createIocalcHttpMcpToolBridge({
    baseUrl: options.baseUrl,
    sandboxId: options.sandboxId
  });
}

function createInitializeResult(): Record<string, unknown> {
  return {
    protocolVersion: IOCALC_MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: {
        listChanged: false
      }
    },
    serverInfo: {
      name: "iocalc-mcp-server",
      title: "IOCALC MCP Server",
      version: "0.1.0"
    },
    instructions: SAFE_SERVER_INSTRUCTIONS
  };
}

function createToolsListResult(bridge: IocalcMcpToolBridge, params: unknown): Record<string, unknown> {
  assertOptionalObjectWithKeys(params, ["cursor", "_meta"]);
  if (isPlainObject(params) && params.cursor !== undefined && typeof params.cursor !== "string") {
    throw new Error("Invalid MCP stdio parameters.");
  }
  assertOptionalMeta(params);
  return {
    tools:
      isPlainObject(params) && typeof params.cursor === "string" && params.cursor.length > 0
        ? []
        : bridge.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
  };
}

async function callToolFromJsonRpc(bridge: IocalcMcpToolBridge, params: unknown): Promise<Record<string, unknown>> {
  assertOptionalObjectWithKeys(params, ["name", "arguments", "_meta"]);
  if (!isPlainObject(params) || typeof params.name !== "string") {
    throw new Error("Invalid MCP stdio parameters.");
  }
  if (params.arguments !== undefined && (!isPlainObject(params.arguments) || Array.isArray(params.arguments))) {
    throw new Error("Invalid MCP stdio parameters.");
  }
  assertOptionalMeta(params);
  return serializeMcpToolResult(await bridge.callTool(params.name, params.arguments));
}

export function serializeMcpToolResult(result: IocalcMcpToolResult): Record<string, unknown> {
  const output: Record<string, unknown> = {
    content: result.content.map((item) => ({
      type: "text",
      text: item.text
    })),
    isError: Boolean(result.isError)
  };
  if (result.structuredContent !== undefined) {
    output.structuredContent = result.structuredContent;
  }
  return output;
}

function assertOptionalObjectWithKeys(value: unknown, allowedKeys: readonly string[]): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    throw new Error("Invalid MCP stdio parameters.");
  }
  const allowed = new Set(allowedKeys);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) {
      throw new Error("Invalid MCP stdio parameters.");
    }
  }
}

function assertOptionalMeta(value: unknown): void {
  if (!isPlainObject(value) || value._meta === undefined) return;
  if (!isPlainObject(value._meta) || Array.isArray(value._meta)) {
    throw new Error("Invalid MCP stdio parameters.");
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJsonRpcId(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" || value === null ? value : null;
}

function jsonRpcSuccess(id: string | number | null, result: unknown): IocalcMcpJsonRpcSuccess {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    result
  };
}

function jsonRpcError(id: string | number | null, code: number, message: string): IocalcMcpJsonRpcError {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: {
      code,
      message
    }
  };
}

function cliHelpText(): string {
  return [
    "IOCALC MCP stdio server",
    "",
    "Usage: iocalc-mcp-server [--base-url http://127.0.0.1:8090] [--sandbox-id mcp-stdio-local]",
    "",
    "Environment:",
    "  IOCALC_BASE_URL     Localhost or approved HTTPS IOCALC host root.",
    "  IOCALC_SANDBOX_ID   Sandbox game-state identifier, not an account or session.",
    "",
    "Boundary: sandbox gameplay only; no wallet, secrets, account, deployment, production, arbitrary URL, code execution, or financial authority."
  ].join("\n");
}

function isDirectRun(): boolean {
  return Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

async function runCli(): Promise<void> {
  try {
    const options = parseIocalcMcpStdioCliOptions();
    if (options.help) {
      process.stdout.write(`${cliHelpText()}\n`);
      return;
    }
    const bridge = createIocalcMcpStdioHttpBridge(options);
    await runIocalcMcpStdioServer({ bridge });
  } catch {
    process.stderr.write("IOCALC MCP stdio server failed inside the sandbox boundary.\n");
    process.exitCode = 1;
  }
}

if (isDirectRun()) {
  void runCli();
}
