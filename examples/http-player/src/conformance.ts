import { HttpIocalcAdapter } from "@iocalc/adapters";
import { runAdapterConformance } from "@iocalc/conformance";

const baseUrl = process.env.IOCALC_BASE_URL ?? "http://localhost:3000";
const sandboxId = process.env.IOCALC_SANDBOX_ID ?? `conformance-${Date.now()}`;

const adapter = new HttpIocalcAdapter({ baseUrl, sandboxId });
const results = await runAdapterConformance(adapter);
const failed = results.filter((result) => !result.passed);

console.log(JSON.stringify({
  ok: failed.length === 0,
  baseUrl,
  sandboxId,
  results
}, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}
