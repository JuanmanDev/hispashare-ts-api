#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import { HispaShareClient } from "../infra/HispaShareClient.js";
import { setDefaultResultOrder } from "node:dns";

setDefaultResultOrder("ipv4first");

const PKG_NAME = "hispashare-mcp";
const PKG_VERSION = "0.1.0";

async function main(): Promise<void> {
  const server = new McpServer(
    { name: PKG_NAME, version: PKG_VERSION },
    {
      instructions:
        "HispaShare MCP server for searching films/series and fetching ed2k links. " +
        "Use search_hispashare to find titles, then get_hispashare_links to fetch ed2k links.",
    },
  );

  const client = new HispaShareClient();
  registerTools(server, client);

  await server.connect(new StdioServerTransport());
  process.stderr.write(`[${PKG_NAME}] server ready\n`);
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[${PKG_NAME}] fatal: ${msg}\n`);
  process.exit(1);
});
