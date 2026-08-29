# Use as an MCP server

The server speaks MCP over **stdio**: the host launches it as a child process
and exchanges JSON-RPC on stdin/stdout. All diagnostics go to stderr, so log
output can never corrupt the protocol stream.

## Wiring it into a client

::: code-group

```json [npx (recommended)]
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

```json [local build]
{
  "mcpServers": {
    "tmdb": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "env": { "TMDB_API_KEY": "your_key_here" }
    }
  }
}
```

```json [Docker]
{
  "mcpServers": {
    "tmdb": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "TMDB_API_KEY",
        "ghcr.io/juanmandev/hispashare-ts-api:latest"
      ],
      "env": { "TMDB_API_KEY": "your_key_here" }
    }
  }
}
```

:::

::: warning Docker needs `-i`, never `-t`
stdio transport means the container's stdin **is** the protocol channel.
`-i` keeps it open; adding `-t` allocates a TTY that mangles the stream.
:::

In Claude Code you can register it per-project instead of editing JSON by hand:

```bash
claude mcp add tmdb -- npx -y tmdb-mcp
```

A project-scoped `.mcp.json` at the repository root applies to that directory
only, which is usually what you want for a key-bearing server.

## Tools

All three are read-only and annotated as such (`readOnlyHint`), so hosts that
gate write-capable tools will not prompt for these.

### `search_titles`

Find films and series by name. This is the entry point: it returns the numeric
`id` that `get_title` needs.

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `query` | string, 1–100 chars | yes | Title to search for. |
| `kind` | `movie` \| `series` | no | Omit to search **both** and get one blended ranking. |
| `year` | integer 1870–2200 | no | Release year (films) or first-air year (series). |
| `page` | integer 1–500 | no | Defaults to 1. |

When `kind` is omitted the server queries films and series concurrently and
merges them, ranking by rating weighted against vote count so a 9.5 with twelve
votes does not outrank an 8.2 with twenty thousand.

### `get_title`

Full record for one title.

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `movie` \| `series` | yes | Must match the kind from search. |
| `id` | positive integer | yes | TMDB id. |

Returns synopsis, tagline, status, runtime (per-episode for series), genres,
top-billed cast, key crew (director, writers, producers), season list for
series, and links to TMDB plus IMDb when an IMDb id exists.

### `discover_titles`

Browse without a text query — "well-rated science fiction from the nineties".

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `movie` \| `series` | yes | |
| `genre` | string | no | Genre **name**, e.g. `Science Fiction`. |
| `yearMin` / `yearMax` | integer | no | Inclusive bounds. |
| `ratingMin` | number 0–10 | no | Also applies a minimum vote count so obscure entries with one perfect score do not dominate. |
| `sort` | `popularity` \| `rating` \| `newest` | no | Defaults to `popularity`. |
| `page` | integer 1–500 | no | |

Genre matching ignores case and accents, so `ciencia ficcion` resolves against
`Ciencia ficción` when `TMDB_LANGUAGE=es-ES`. An unrecognised genre is rejected
with the full list of valid values for that kind — the model can correct itself
without a second round trip.

## Resources

Rendered HTML views are also exposed as resources under `ui://tmdb/…`:

- `ui://tmdb/movie/78` — the last-rendered detail view for that title
- `ui://tmdb/list/<slug>` — the last-rendered result list

This exists for hosts that prefer `resources/read` over inline embedded
resources. The cache holds the 50 most recent views and is purely a display
artefact — nothing depends on it.

## Errors

Failures come back as tool errors with a short, actionable message rather than a
stack trace:

| Situation | Message |
| --- | --- |
| Bad or missing key | `TMDB rejected the API key. Check TMDB_API_KEY.` |
| Rate limited | `Rate limited by TMDB. Retry in ~Ns.` |
| Unknown id | `Not found: /movie/999999999` |
| Unknown genre | `Unknown genre "X" for movie. Available: …` |
| Timeout | `Request timed out after 15000ms` |

Timeouts, 429s and 5xx responses are retried automatically with backoff before
an error is ever surfaced; a `Retry-After` header is honoured when present.
