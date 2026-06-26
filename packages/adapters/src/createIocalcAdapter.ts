import type { IocalcPlayerAdapter, IocalcTransport } from "@iocalc/protocol";
import { HttpIocalcAdapter } from "./HttpIocalcAdapter.js";
import { ManualTranscriptAdapter } from "./ManualTranscriptAdapter.js";

export interface CreateIocalcAdapterConfig {
  transport: IocalcTransport;
  baseUrl?: string;
}

export function createIocalcAdapter(config: CreateIocalcAdapterConfig): IocalcPlayerAdapter {
  switch (config.transport) {
    case "http":
      if (!config.baseUrl) throw new Error("baseUrl is required for HTTP adapter.");
      return new HttpIocalcAdapter(config.baseUrl);
    case "manual":
      return new ManualTranscriptAdapter();
    case "browser":
    case "mcp":
    case "local-core":
      throw new Error(`${config.transport} adapter is not implemented in this initial scaffold.`);
    default:
      return new ManualTranscriptAdapter();
  }
}
