import { DEFAULT_SAFE_CAPABILITIES, type IocalcPlayerAdapter } from "@iocalc/protocol";

class DeferredAdapter implements IocalcPlayerAdapter {
  constructor(public readonly transport: "mcp" | "local-core") {}

  async getCapabilities() {
    return {
      ...DEFAULT_SAFE_CAPABILITIES,
      canSubmitGameCommand: false,
      canResolveSeason: false
    };
  }

  async getState(): Promise<never> {
    throw new Error(`${this.transport} adapter is deferred in this scaffold.`);
  }

  async submitCommand(): Promise<never> {
    throw new Error(`${this.transport} adapter is deferred in this scaffold.`);
  }

  async resolveSeason(): Promise<never> {
    throw new Error(`${this.transport} adapter is deferred in this scaffold.`);
  }

  async getReport(): Promise<never> {
    throw new Error(`${this.transport} adapter is deferred in this scaffold.`);
  }

  async getLog(): Promise<never> {
    throw new Error(`${this.transport} adapter is deferred in this scaffold.`);
  }

  async getMatchHistory() {
    return { matches: [] };
  }
}

export class McpIocalcAdapter extends DeferredAdapter {
  constructor() {
    super("mcp");
  }
}

export class LocalCoreIocalcAdapter extends DeferredAdapter {
  constructor() {
    super("local-core");
  }
}
