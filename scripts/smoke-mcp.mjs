#!/usr/bin/env node
/**
 * Protocol smoke test for the *built* server (dist/), driven over a real stdio
 * pipe with hand-written JSON-RPC. It verifies the shipped bin entry actually
 * starts, completes the MCP handshake and advertises its tools — the things a
 * unit test cannot prove.
 *
 * Needs no real credentials: tools/list performs no upstream call, so dummy
 * values are enough to get past construction.
 *
 * Usage: node scripts/smoke-mcp.mjs [path-to-server.js]
 */
import process from "node:process";
import { handshake, assertTools } from "./lib/mcpHandshake.mjs";

const serverPath = process.argv[2] ?? "dist/mcp/server.js";
const EXPECTED_TOOLS = ["search_hispashare", "get_hispashare_links"];

let result;
try {
  result = await handshake({
    command: process.execPath,
    args: [serverPath],
    env: {
      HISPASHARE_USERNAME: process.env.HISPASHARE_USERNAME ?? "dummy",
      HISPASHARE_PASSWORD: process.env.HISPASHARE_PASSWORD ?? "dummy",
    },
  });
} catch (error) {
  process.stderr.write(`smoke: FAIL ${error.message}\n`);
  process.exit(1);
}

assertTools(result, EXPECTED_TOOLS, serverPath);
