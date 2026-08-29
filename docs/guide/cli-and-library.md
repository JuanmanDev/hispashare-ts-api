# CLI and library

MCP is one transport, not the whole product. The same use cases are reachable
from a command line and from your own TypeScript.

## CLI

```bash
npm run cli -- search "blade runner" --kind movie
npm run cli -- get movie 78
npm run cli -- discover movie --genre "Science Fiction" --year-min 1990 --year-max 1999 --sort rating
```

| Command | Flags |
| --- | --- |
| `search <query>` | `--kind movie\|series`, `--year N`, `--page N` |
| `get <movie\|series> <id>` | — |
| `discover <movie\|series>` | `--genre G`, `--year-min N`, `--year-max N`, `--rating-min N`, `--sort popularity\|rating\|newest` |

Output is the same Markdown the MCP server sends as its text block, so what you
see locally is what a model sees.

The CLI exists partly as a design check: if a use case needed MCP-specific
plumbing to work, it would not run here.

## Library

```ts
import { createContainer } from "tmdb-mcp";

const { searchTitles, getTitleDetails, discoverTitles } = createContainer();

const results = await searchTitles.execute({ query: "severance", kind: "series" });
const first = results.items[0];

if (first) {
  const details = await getTitleDetails.execute({ kind: first.kind, id: first.id });
  console.log(details.seasons?.map((s) => `${s.name}: ${s.episodeCount} eps`));
}
```

`createContainer()` is the composition root. It reads configuration once, wires
the HTTP client and repository, and hands back ready use cases.

### Injecting your own pieces

Every dependency is an interface, so you can substitute any of them — this is
exactly how the test suite avoids the network:

```ts
import { createContainer, type HttpClient } from "tmdb-mcp";

const fakeHttp: HttpClient = {
  async getJson<T>(path: string): Promise<T> {
    return { page: 1, results: [], total_pages: 0, total_results: 0 } as T;
  },
};

const container = createContainer({
  config: { /* …your Config… */ } as never,
  http: fakeHttp,
});
```

Available overrides: `config`, `http`, `repository`, `logger`, `fetchImpl`,
`sleep`. The last two are useful when you want the real client but deterministic
timing — the suite passes a no-op `sleep` so retry tests run instantly.

### Rendering

The renderers are exported too, if you want the same output in your own UI:

```ts
import { renderText, renderHtml, toListView, toDetailView } from "tmdb-mcp";

const view = toListView(page, "Results");
const markdown = renderText(view);
const html = renderHtml(view); // self-contained: inline CSS, no external assets
```

`toListView` / `toDetailView` build the single view model; `renderText` and
`renderHtml` are two serializers over it. Change what a card shows once and both
outputs follow.

### Types

Domain types are exported and provider-neutral: `Title`, `TitleDetails`,
`Credit`, `Season`, `Page<T>`, `MediaKind`, `SearchQuery`, `DiscoverQuery`.
Errors are a closed taxonomy — `AuthError`, `NotFoundError`, `RateLimitError`,
`TimeoutError`, `UpstreamError`, `ValidationError`, `ConfigError` — all
extending `AppError` with a `code` and a `userMessage` safe to show a user.

```ts
import { AuthError, toUserMessage } from "tmdb-mcp";

try {
  await searchTitles.execute({ query: "x" });
} catch (error) {
  if (error instanceof AuthError) process.exit(1);
  console.error(toUserMessage(error));
}
```
