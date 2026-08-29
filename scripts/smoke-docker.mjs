#!/usr/bin/env node
/**
 * Same handshake as scripts/smoke-mcp.mjs, but against the container image —
 * so the image's entrypoint, its pruned node_modules and its non-root user are
 * all exercised, not just the TypeScript build.
 *
 * The image must exist already (`npm run docker:build`, or a `docker pull`).
 * Credentials are dummies: tools/list makes no request to HispaShare.
 *
 * Usage: node scripts/smoke-docker.mjs [image-tag]
 */
import process from "node:process";
import { handshake, assertTools } from "./lib/mcpHandshake.mjs";

const image = process.argv[2] ?? process.env.HISPASHARE_IMAGE ?? "hispashare-mcp";
const EXPECTED_TOOLS = ["search_hispashare", "get_hispashare_links"];

let result;
try {
  result = await handshake({
    command: "docker",
    // -i, never -t: stdin carries the protocol and a TTY corrupts the framing.
    args: [
      "run",
      "-i",
      "--rm",
      "-e",
      "HISPASHARE_USERNAME=dummy",
      "-e",
      "HISPASHARE_PASSWORD=dummy",
      image,
    ],
    timeoutMs: 60_000, // first run may still be pulling
  });
} catch (error) {
  process.stderr.write(`smoke: FAIL ${error.message}\n`);
  process.exit(1);
}

assertTools(result, EXPECTED_TOOLS, image);
