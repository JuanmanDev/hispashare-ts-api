# Rich results

Tool results carry two representations of the same data. Which ones a client
receives depends on what it can display.

## The compatibility contract

1. **A text block is always first.** It is complete Markdown — headings,
   ratings, cast, links. A client that understands nothing else still shows a
   useful answer. This is the path every pre-existing host takes, and it is
   never degraded to make room for the rich view.
2. **An embedded `text/html` resource is appended when the client can render
   it.** Same data, laid out as cards with posters, rating bars and genre chips.

So the rich view is strictly additive. Nothing is moved into it, and removing it
loses no information.

## How support is detected

::: warning Honest status
MCP does **not** yet have a ratified capability flag meaning "I can render an
HTML resource inline". While that settles, hosts advertise it under
`capabilities.experimental` using vendor-specific keys.
:::

`auto` mode — the default — looks for any of the experimental keys currently
seen in the wild (`ui`, `htmlResources`, `html`, `resourceUi`, `mcpUi`,
`mcp-ui`, `openai/outputTemplate`), matched case-insensitively. If none is
present, the server sends **text only**.

That default is deliberately conservative: guessing wrong in the other
direction dumps raw markup into a transcript, which is worse than a plain
answer. Override it when you know your client better than the sniffing does:

| `TMDB_MCP_UI` | Behaviour |
| --- | --- |
| `auto` (default) | HTML only when the client advertises a recognised UI capability. |
| `always` | HTML unconditionally. Use when your client renders HTML but does not advertise it. |
| `never` | Text only. Use for logs, pipes, or a host that shows resources as raw source. |

When the standard lands, `auto` is the only thing that needs to change — one
list of keys in `src/mcp/capabilities.ts`.

## What the HTML contains

- **Self-contained.** Inline `<style>`, no external stylesheet, no CDN script,
  no web font. It survives a strict sandbox or CSP.
- **Server-rendered.** The markup is produced in TypeScript and arrives
  complete. If the host blocks scripts entirely, the result is still fully
  readable — nothing is drawn by client-side JavaScript.
- **Progressively enhanced.** A small script registers a `tmdb-result` custom
  element and adds behaviour to markup that already exists: click or press Enter
  to expand a clamped synopsis. It never re-renders content, which is why there
  is no duplicated template on the client side.
- **Theme-aware.** Honours `prefers-color-scheme`.
- **Responsive.** Single column on narrow viewports, two-up above 620px.
- **Escaped.** All interpolated text passes through one escaper, with a separate
  attribute-context variant for URLs. Covered by tests that inject
  `<img src=x onerror=…>` through a title and assert it comes out inert.

Only remote references are TMDB poster images, which degrade to `alt` text if
blocked.

## Resource URIs

Rendered views are cached and readable as resources:

```
ui://tmdb/movie/78
ui://tmdb/series/95396
ui://tmdb/list/films-matching-blade-runner
```

For hosts that fetch resources rather than consume embedded ones. The cache
keeps the 50 most recent renders.
