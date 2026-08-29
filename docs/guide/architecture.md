# Architecture

The layout follows ports and adapters. Dependencies point inward only: the
domain knows nothing about TMDB, and the TMDB adapter knows nothing about MCP.

```
src/
  domain/            types.ts · ports.ts · errors.ts
  app/               useCases.ts · container.ts
  infra/
    http/            FetchHttpClient.ts
    tmdb/            TmdbTitleRepository.ts · mappers.ts · kindSpec.ts
                     GenreDirectory.ts · images.ts · dto.ts
  mcp/               server.ts · tools.ts · capabilities.ts
    render/          viewmodel.ts · text.ts · html.ts · renderer.ts
  cli.ts  index.ts  config.ts
```

## Layer by layer

**`domain/`** — Provider-neutral models (`Title`, `TitleDetails`, `Page<T>`),
the port interfaces (`HttpClient`, `TitleRepository`, `Logger`), and one error
taxonomy. No imports from outer layers.

**`app/`** — Use cases (`SearchTitles`, `GetTitleDetails`, `DiscoverTitles`)
holding rules that must hold regardless of caller, plus `container.ts`, the
single place where concrete classes are wired to interfaces.

**`infra/`** — Adapters. `FetchHttpClient` is the only code that performs
network I/O or interprets a status code. `TmdbTitleRepository` translates
domain queries into TMDB requests and payloads back into domain objects.

**`mcp/`** — Protocol and presentation. Tool schemas, capability sniffing,
rendering.

## How SOLID shows up

Not as a label — as specific decisions you can point at.

### Single responsibility

Retry, backoff and timeout live in `FetchHttpClient` and nowhere else. Status
codes become typed errors in exactly one method. Configuration is parsed in
`config.ts`; nothing else reads `process.env`. HTML escaping has one
implementation.

### Open/closed

Adding a second provider means writing one class that implements
`TitleRepository` and registering it in the container. No use case, renderer or
tool changes. Adding a transport (say, streamable HTTP) reuses the use cases
untouched — the CLI already demonstrates a second consumer.

### Liskov

`TitleRepository` implementations are substitutable because the contract is
stated in domain terms: validation errors are thrown before any request, and
upstream failures always arrive as the shared `AppError` subclasses. Tests swap
in a stub repository and the tools behave identically.

### Interface segregation

`HttpClient` exposes a single `getJson`, because that is all any adapter needs —
no unused `post`/`put` surface to implement in a fake. `Logger` is one method.
`ClientDisplayProfile` carries one boolean rather than a whole capabilities
object, so the renderer cannot grow a dependency on protocol internals.

### Dependency inversion

Every collaborator arrives through a constructor. `FetchHttpClient` accepts
`fetchImpl` and `sleep`; the container accepts overrides for `config`, `http`,
`repository`, `logger`. The test suite needs no module mocking, no `nock`, and
no network.

## Where duplication was specifically designed out

The most instructive case is TMDB's split between films and series. The same
concepts carry different field names: `title` vs `name`, `release_date` vs
`first_air_date`, `runtime` vs `episode_run_time`, `primary_release_year` vs
`first_air_date_year`. The obvious implementation is two mappers and two query
builders that drift apart.

Instead the differences are declared once, in `kindSpec.ts`:

```ts
export const KIND_SPECS: Readonly<Record<MediaKind, KindSpec>> = {
  movie: {
    segment: "movie",
    titleField: "title",
    dateField: "release_date",
    searchYearParam: "primary_release_year",
    discoverDateGte: "primary_release_date.gte",
    /* … */
  },
  series: {
    segment: "tv",
    titleField: "name",
    dateField: "first_air_date",
    searchYearParam: "first_air_date_year",
    discoverDateGte: "first_air_date.gte",
    /* … */
  },
};
```

`mapTitle`, `mapDetails` and every query builder read the table. There is one
mapper, not two.

::: tip A caveat learned the hard way
An earlier version derived `searchYearParam` from `dateField` by string
substitution. It produced `release_year` and `first_air_year` — neither of which
TMDB accepts, so the year filter was silently ignored while every hand-written
fixture test still passed. Clever derivation of an external API's vocabulary is
a bug waiting to happen; the names are spelled out now.
:::

Other deliberate de-duplications:

| Concern | Single home |
| --- | --- |
| View content | `render/viewmodel.ts`, with `text.ts` and `html.ts` as serializers over it |
| Tool error handling | one `run()` wrapper in `tools.ts`, shared by all three tools |
| Genre id → name | `GenreDirectory`, cached per kind, concurrent misses collapsed |
| Image URLs | `ImageUrlBuilder` |
| Optional-field omission | the `maybe()` helper in `mappers.ts` |
| CI checks at release time | `release.yml` calls `ci.yml` rather than repeating it |

## Request flow

```
MCP client
  → tools.ts        validate against zod schema
  → useCases.ts     apply rules (page bounds, year sanity, empty query)
  → TmdbTitleRepository
        ├ GenreDirectory.load(kind)   cached after first call
        └ FetchHttpClient.getJson     timeout · retry · error mapping
  → mappers.ts      DTO → domain, via KindSpec
  → viewmodel.ts    domain → view
  → text.ts (always) + html.ts (when the client can render it)
```
