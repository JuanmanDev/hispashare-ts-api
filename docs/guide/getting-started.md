# Getting started

## Requirements

- **Node.js 20 or newer.** The server uses `process.loadEnvFile`, native
  `fetch` and `AbortSignal`, all available from Node 20.12 onward.
- **A TMDB API key.** Free: create an account, then open
  [Settings → API](https://www.themoviedb.org/settings/api). Either credential
  works:
  - a **v3 API key** — 32 hex characters, sent as an `api_key` query parameter;
  - a **v4 read access token** — a long JWT starting with `eyJ`, sent as an
    `Authorization: Bearer` header.

  You do not choose: the client inspects the value and picks the right scheme.

## Install

Nothing to install for the common case:

```bash
npx -y tmdb-mcp
```

For library use, or to hack on it:

```bash
npm install tmdb-mcp
```

## Configure

The only required setting is the key. Provide it however suits your host:

::: code-group

```bash [shell]
export TMDB_API_KEY=your_key_here
```

```ini [.env]
TMDB_API_KEY=your_key_here
```

```json [MCP client config]
{
  "mcpServers": {
    "tmdb": {
      "command": "npx",
      "args": ["-y", "tmdb-mcp"],
      "env": { "TMDB_API_KEY": "your_key_here" }
    }
  }
}
```

:::

A `.env` in the working directory is read automatically if present. It is
**gitignored** — keep real keys out of commits.

### All settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `TMDB_API_KEY` | — | **Required.** v3 key or v4 token. |
| `TMDB_LANGUAGE` | `en-US` | Language for titles, synopses and genre names. Try `es-ES`. |
| `TMDB_MCP_UI` | `auto` | Rich HTML results: `auto`, `always`, `never`. See [Rich results](./rich-ui). |
| `TMDB_TIMEOUT_MS` | `15000` | Per-request timeout. |
| `TMDB_RETRIES` | `2` | Retries for timeouts, 429s and 5xx, with backoff. |
| `TMDB_POSTER_SIZE` | `w342` | Poster width from TMDB's image CDN. |
| `TMDB_BACKDROP_SIZE` | `w780` | Backdrop width. |
| `TMDB_PROFILE_SIZE` | `w185` | Cast photo width. |
| `TMDB_BASE_URL` | TMDB v3 | Override for testing against a mock. |
| `TMDB_IMAGE_BASE_URL` | TMDB CDN | Override for testing against a mock. |

An invalid value fails fast at startup with a message naming the variable,
rather than misbehaving later.

## Verify it works

Build from a clone and run the protocol smoke test — it starts the real
compiled server, completes an MCP handshake over a stdio pipe and checks the
advertised tool list. It needs no valid key, because listing tools makes no
upstream call:

```bash
npm ci
npm run build
node scripts/smoke-mcp.mjs
# smoke: OK tmdb-mcp@0.1.0 protocol=2024-11-05 tools=[search_titles, get_title, discover_titles]
```

To confirm your key is actually good, make a real request with the CLI:

```bash
npm run cli -- search "blade runner" --kind movie
```

An invalid key surfaces as `TMDB rejected the API key. Check TMDB_API_KEY.`

## Next steps

- [Use as an MCP server](./mcp) — tool reference and client wiring.
- [CLI and library](./cli-and-library) — the same use cases without MCP.
- [Rich results](./rich-ui) — how the HTML view is negotiated.
