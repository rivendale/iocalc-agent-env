import { HttpIocalcAdapter } from "@iocalc/adapters";

const baseUrl = process.env.IOCALC_BASE_URL ?? "http://localhost:3000";
const adapter = new HttpIocalcAdapter(baseUrl);

const capabilities = await adapter.getCapabilities();
console.log("capabilities", capabilities);

const state = await adapter.getState();
console.log("state", state);

const submitted = await adapter.submitCommand({
  mode: "season_duel",
  agentName: "Example HTTP Player",
  command: "repair wall and gather wood"
});
console.log("submitted", submitted);

const resolution = await adapter.resolveSeason({ seed: "example-seed" });
console.log("resolution", resolution);

console.log("report", await adapter.getReport());
console.log("log", await adapter.getLog());
