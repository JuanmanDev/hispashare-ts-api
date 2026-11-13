/**
 * Minimal MCP client: spawns a command, completes the handshake over stdio with
 * hand-written JSON-RPC and returns what the server advertises. Deliberately
 * uses no SDK — it must be able to fail when the SDK wiring is what is broken.
 *
 * Shared by scripts/smoke-mcp.mjs (built server) and scripts/smoke-docker.mjs
 * (the container image), so the two smoke tests cannot drift apart.
 */
import { spawn } from "node:child_process";

const REQUESTS = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0.0.0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
];

/**
 * @param {object} options
 * @param {string} options.command       executable to spawn
 * @param {string[]} [options.args]      its arguments
 * @param {Record<string,string>} [options.env]  extra environment variables
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{serverInfo: object, protocolVersion: string, tools: string[]}>}
 */
export async function handshake({ command, args = [], env = {}, timeoutMs = 20_000 }) {
  const child = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });

  let stdout = "";
  let stderr = "";
  const responses = new Map();

  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${timeoutMs}ms\nstderr:\n${stderr}`)),
      timeoutMs,
    );

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      // Responses are newline-delimited JSON on the stdio transport.
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          clearTimeout(timer);
          reject(new Error(`server wrote non-JSON to stdout: ${line}`));
          return;
        }
        if (message.id !== undefined) responses.set(message.id, message);
      }
      if (responses.has(2)) {
        clearTimeout(timer);
        resolve();
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      if (!responses.has(2)) {
        clearTimeout(timer);
        reject(new Error(`server exited early (code ${code})\nstderr:\n${stderr}`));
      }
    });
  });

  for (const request of REQUESTS) {
    child.stdin.write(`${JSON.stringify(request)}\n`);
  }

  try {
    await done;
  } finally {
    // Close our ends too: a child that outlives the kill (a docker CLI waiting on
    // its container) must not keep this process alive through its open pipes.
    child.stdin.end();
    child.stdout.destroy();
    child.stderr.destroy();
    child.kill();
    child.unref();
  }

  const initialize = responses.get(1);
  if (!initialize?.result?.serverInfo?.name) {
    throw new Error(`initialize did not return serverInfo: ${JSON.stringify(initialize)}`);
  }

  return {
    serverInfo: initialize.result.serverInfo,
    protocolVersion: initialize.result.protocolVersion,
    tools: (responses.get(2)?.result?.tools ?? []).map((tool) => tool.name),
  };
}

/** Exits non-zero with a readable message unless every expected tool is advertised. */
export function assertTools(result, expected, label) {
  const missing = expected.filter((name) => !result.tools.includes(name));
  if (missing.length > 0) {
    process.stderr.write(
      `smoke: FAIL ${label} is missing ${missing.join(", ")} ` +
        `(got: ${result.tools.join(", ") || "none"})\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `smoke: OK ${label} ${result.serverInfo.name}@${result.serverInfo.version} ` +
      `protocol=${result.protocolVersion} tools=[${result.tools.join(", ")}]\n`,
  );
}
