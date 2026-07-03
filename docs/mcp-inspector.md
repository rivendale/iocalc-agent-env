# MCP Inspector Workflow

MCP Inspector is useful as the next dev tool because it checks the existing
stdio bridge through the same surface an MCP client will use. This workflow is
local-only and does not add runtime authority to IOCALC.

## Run locally

Start the local game server from `iso-ai-game` first:

```bash
make game-serve
```

Then run the inspector from this repo:

```bash
IOCALC_BASE_URL=http://127.0.0.1:8090 IOCALC_SANDBOX_ID=mcp-inspector-local pnpm mcp:inspect
```

The script builds `@iocalc/mcp-server` and starts:

```bash
npx @modelcontextprotocol/inspector node packages/mcp-server/dist/stdio.js
```

Use the inspector UI to call `initialize`, `tools/list`, and selected
`tools/call` requests.

## Expected tools

The inspector should show only sandbox IOCALC tools:

- `iocalc.get_manifest`
- `iocalc.get_capabilities`
- `iocalc.get_state`
- `iocalc.submit_command`
- `iocalc.resolve_season`
- `iocalc.get_report`
- `iocalc.get_log`
- `iocalc.get_match_history`
- `iocalc.get_governance_ledger`
- `iocalc.run_agent_trial`

Safe command text such as `repair wall and gather wood` should be accepted.
Unsafe probes for URLs, wallets, private keys, deployment, shell execution,
secrets, or financial advice should be rejected by the bridge.

## Boundary notes

The inspector starts a local proxy and can spawn the stdio process, so keep it
on localhost and close it when finished. Do not expose the inspector proxy,
paste secrets into requests, or point it at production-like state. The wrapped
server still validates `IOCALC_BASE_URL`, uses a sandbox ID, and delegates every
tool call to `createIocalcHttpMcpToolBridge`.
