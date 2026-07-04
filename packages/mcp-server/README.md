# @iocalc/mcp-server

Sandbox-only MCP bridge and stdio wrapper for IOCALC game tools.

## Includes

- `createIocalcMcpToolBridge` for wrapping any `IocalcPlayerAdapter`.
- `createIocalcHttpMcpToolBridge` for HTTP `/api/game/*` targets.
- `IOCALC_MCP_TOOLS` closed-schema tool metadata.
- `iocalc-mcp-server` stdio binary after build.

## Boundary

The MCP bridge exposes only sandbox game tools: read manifest/capabilities/state,
submit game command, resolve season, read report/log/history/governance ledger,
and run sandbox agent trials when supported. It rejects wallet, private key,
secret, production deployment, arbitrary URL fetch, code execution, feedback
trust, account, session, and financial requests.

## License

`MIT-0 OR Apache-2.0`
