#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemasDir = path.join(root, "schemas");
fs.mkdirSync(schemasDir, { recursive: true });

const protocol = await import(pathToFileURL(path.join(root, "packages/protocol/dist/index.js")).href);
const mcp = await import(pathToFileURL(path.join(root, "packages/mcp-server/dist/index.js")).href);

function writeJson(relPath, value) {
  fs.writeFileSync(path.join(root, relPath), `${JSON.stringify(value, null, 2)}\n`);
}

const contract = {
  schemaVersion: "iocalc-agent-env-contract-snapshot-v1",
  source: "generated-from-workspace-build",
  packageLicense: "MIT-0 OR Apache-2.0",
  protocol: {
    transports: ["manual", "browser", "http", "mcp", "local-core"],
    modes: ["season_duel", "agent_trials"],
    controllerTypes: [...protocol.IOCALC_CONTROLLER_TYPES],
    commandSources: [...protocol.IOCALC_COMMAND_SOURCES],
    commandRequestFieldKeys: [...protocol.IOCALC_COMMAND_REQUEST_FIELD_KEYS],
    safeCapabilities: Object.entries(protocol.DEFAULT_SAFE_CAPABILITIES)
      .filter(([, value]) => value === true)
      .map(([key]) => key),
    forbiddenCapabilities: [...protocol.IOCALC_FORBIDDEN_CAPABILITIES],
    boundaryActions: [...protocol.IOCALC_BOUNDARY_ACTIONS],
    auditEventTypes: [...protocol.IOCALC_AUDIT_EVENT_TYPES],
    recommendedGameTheoryPatterns: [...protocol.IOCALC_RECOMMENDED_GAME_THEORY_PATTERNS]
  },
  mcp: {
    toolNames: mcp.IOCALC_MCP_TOOLS.map((tool) => tool.name),
    tools: mcp.IOCALC_MCP_TOOLS
  },
  outOfScope: [
    "wallet actions",
    "private-key handling",
    "secrets access",
    "feedback-to-gameplay mutation",
    "arbitrary URL fetching",
    "arbitrary code execution",
    "deployment or production mutation",
    "accounts or sessions",
    "financial functionality or advice"
  ]
};

const openapiLite = {
  openapi: "3.1.0",
  info: {
    title: "IOCALC Sandbox Game API",
    version: "0.1.0",
    summary: "Sandbox-only API shape expected by iocalc-agent-env adapters."
  },
  paths: {
    "/api/game/manifest": { get: { summary: "Read sandbox game API manifest", responses: { "200": { description: "Manifest" } } } },
    "/api/game/capabilities": { get: { summary: "Read safe sandbox capabilities", responses: { "200": { description: "Capabilities" } } } },
    "/api/game/state": { get: { summary: "Read sandbox game state", parameters: [{ name: "sandboxId", in: "query", required: false, schema: { type: "string" } }], responses: { "200": { description: "Game state" } } } },
    "/api/game/command": { post: { summary: "Submit sandbox game command", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CommandRequest" } } } }, responses: { "200": { description: "Command result" } } } },
    "/api/game/resolve": { post: { summary: "Resolve deterministic sandbox season", requestBody: { required: false, content: { "application/json": { schema: { $ref: "#/components/schemas/ResolveRequest" } } } }, responses: { "200": { description: "Season resolution" } } } },
    "/api/game/report": { get: { summary: "Read current sandbox report", parameters: [{ name: "sandboxId", in: "query", required: false, schema: { type: "string" } }], responses: { "200": { description: "Season report" } } } },
    "/api/game/log": { get: { summary: "Read sandbox system log", parameters: [{ name: "sandboxId", in: "query", required: false, schema: { type: "string" } }], responses: { "200": { description: "System log" } } } },
    "/api/game/match-history": { get: { summary: "Read sandbox match history", parameters: [{ name: "sandboxId", in: "query", required: false, schema: { type: "string" } }], responses: { "200": { description: "Match history" } } } },
    "/api/game/governance-ledger": { get: { summary: "Read optional sandbox governance ledger evidence", parameters: [{ name: "sandboxId", in: "query", required: false, schema: { type: "string" } }], responses: { "200": { description: "Governance ledger" } } } },
    "/api/game/agent-trial": { post: { summary: "Run optional sandbox agent trial", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AgentTrialRequest" } } } }, responses: { "200": { description: "Agent trial result" } } } }
  },
  components: {
    schemas: {
      CommandRequest: {
        type: "object",
        additionalProperties: false,
        properties: {
          sandboxId: { type: "string" },
          mode: { type: "string", enum: ["season_duel", "agent_trials"] },
          agentName: { type: "string" },
          command: { type: "string", minLength: 1 },
          seed: { type: "string" },
          scenarioId: { type: "string" }
        },
        required: ["mode", "command"]
      },
      ResolveRequest: {
        type: "object",
        additionalProperties: false,
        properties: {
          sandboxId: { type: "string" },
          seed: { type: "string" }
        }
      },
      AgentTrialRequest: {
        type: "object",
        additionalProperties: false,
        properties: {
          sandboxId: { type: "string" },
          agentA: { type: "string" },
          agentB: { type: "string" },
          seasons: { type: "integer", minimum: 1, maximum: 100 },
          seed: { type: "string" }
        },
        required: ["agentA", "agentB", "seasons"]
      }
    }
  },
  "x-iocalc-boundary": {
    sandboxOnly: true,
    packageLicense: "MIT-0 OR Apache-2.0",
    forbiddenCapabilities: [...protocol.IOCALC_FORBIDDEN_CAPABILITIES]
  }
};

writeJson("schemas/iocalc-agent-env-contract-v1.json", contract);
writeJson("schemas/iocalc-agent-env-openapi-lite-v1.json", openapiLite);
console.log("contract snapshots generated");
