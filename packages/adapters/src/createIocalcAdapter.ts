import type { IocalcPlayerAdapter, IocalcTransport } from "@iocalc/protocol";
import { BrowserIocalcAdapter, type BrowserIocalcPage } from "./BrowserIocalcAdapter.js";
import { HttpIocalcAdapter } from "./HttpIocalcAdapter.js";
import { ManualTranscriptAdapter } from "./ManualTranscriptAdapter.js";

export interface CreateIocalcAdapterConfig {
  transport: IocalcTransport;
  baseUrl?: string;
  page?: BrowserIocalcPage;
  sandboxId?: string;
}

export function createIocalcAdapter(config: CreateIocalcAdapterConfig): IocalcPlayerAdapter {
  switch (config.transport) {
    case "http":
      if (!config.baseUrl) throw new Error("baseUrl is required for HTTP adapter.");
      return new HttpIocalcAdapter({ baseUrl: config.baseUrl, sandboxId: config.sandboxId });
    case "manual":
      return new ManualTranscriptAdapter();
    case "browser":
      if (!config.page) throw new Error("page is required for browser adapter.");
      return new BrowserIocalcAdapter({ page: config.page, baseUrl: config.baseUrl });
    case "mcp":
    case "local-core":
      throw new Error(`${config.transport} adapter is not implemented in this initial scaffold.`);
    default:
      return new ManualTranscriptAdapter();
  }
}
