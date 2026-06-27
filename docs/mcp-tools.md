# MCP Tools

The MCP bridge should be a thin wrapper around the same sandbox protocol used by HTTP, browser, manual, and local-core adapters.

## Proposed tools

```text
iocalc.get_manifest
iocalc.get_capabilities
iocalc.get_state
iocalc.submit_command
iocalc.resolve_season
iocalc.get_report
iocalc.get_log
iocalc.get_match_history
iocalc.run_agent_trial
```

## Tool boundary

MCP tools may only operate on sandbox game state. They must not expose wallet actions, private keys, secrets, production mutation, deployment mutation, arbitrary URL fetching, code execution, feedback trust mutation, or financial functionality.

## Current Implementation

`@iocalc/mcp-server` exports SDK-adaptable tool specs plus
`createIocalcMcpToolBridge(adapter)`. The bridge can wrap any
`IocalcPlayerAdapter`, including the HTTP adapter through
`createIocalcHttpMcpToolBridge(options)`.

```ts
const bridge = createIocalcHttpMcpToolBridge({
  baseUrl: "http://127.0.0.1:8090",
  sandboxId: "local-agent-001"
});

const result = await bridge.callTool("iocalc.submit_command", {
  mode: "season_duel",
  command: "repair wall and gather wood"
});
```

Tool arguments are strict objects. Read tools accept no arguments. Every tool
preflights the wrapped adapter's capabilities before calling into gameplay.
`get_manifest` additionally requires the wrapped adapter to expose
`getManifest()` and returns only sanitized sandbox contract metadata.
`submit_command` rejects empty command text, link-like text, code-like text,
secret-like text, wallet/account/production/deployment/financial terms, and
unexpected argument fields before calling the adapter. `run_agent_trial` accepts
only canonical IOCALC agent IDs such as `iocalc-agent-0001` and returns an
MCP-style error result if the wrapped adapter does not support sandbox agent
trials.

Tool results are canonical sanitized shapes. The bridge does not return adapter
`raw` payloads, permission-like fields, wallet/account/session fields, secret
fields, production/deployment fields, or arbitrary extra authority metadata.
Unknown tools and unexpected argument fields return generic MCP error results
instead of reflecting caller-controlled text.

Use `runIocalcMcpToolBridgeConformance(bridge)` to check an MCP bridge for the
fixed sandbox tool list, closed input schemas, unsafe tool rejection, and
non-reflection of URL, wallet-like, or key-like probe strings in error output.
The helper calls only MCP tool methods and does not grant any additional
adapter, wallet, account, feedback, deployment, or production authority.

The HTTP bridge factory accepts only localhost/127.0.0.1/[::1] roots for local
development or HTTPS `iocalc.com` / `play.iocalc.com` roots. It rejects
credentials, query strings, hashes, nested paths, and non-approved hosts.

The package intentionally does not start a process, bind a port, hold secrets,
or create account/session/wallet authority. A follow-up slice can wire this
bridge to the official MCP SDK transport without changing the sandbox boundary.
