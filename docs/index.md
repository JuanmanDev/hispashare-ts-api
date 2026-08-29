---
layout: home

hero:
  name: tmdb-mcp
  text: Film and TV metadata for MCP clients
  tagline: A typed TMDB client that plugs into any MCP host over npx or Docker — with rich HTML results where supported and plain text everywhere else.
  actions:
    - theme: brand
      text: Getting started
      link: /guide/getting-started
    - theme: alt
      text: Use as an MCP server
      link: /guide/mcp
    - theme: alt
      text: En español
      link: /es/

features:
  - title: Three focused tools
    details: search_titles to find something and get its id, get_title for full metadata including cast, crew and seasons, discover_titles to browse by genre, year range and rating.
  - title: Rich when possible, readable always
    details: Every result carries a complete Markdown block. Clients that can render an embedded text/html resource additionally get a self-contained card view — no external CSS, fonts or scripts.
  - title: One command to run
    details: npx -y tmdb-mcp, or a multi-arch container from GHCR. No global install, no build step, no config file beyond your API key.
  - title: Ports and adapters
    details: The domain layer knows nothing about TMDB; the TMDB adapter knows nothing about MCP. Adding a provider or a transport means adding a file, not editing one.
---

## What it is

An MCP server that answers questions about films and television using
[TMDB](https://www.themoviedb.org/) as its source, plus the typed client library
underneath it — usable on its own if you would rather import a module than run a
server.

```bash
npx -y tmdb-mcp
```

## What it is not

It does not locate, index or download media files. It returns metadata:
titles, years, synopses, ratings, genres, runtimes, cast, crew, seasons and
links to TMDB and IMDb.

## Quick taste

```
> search_titles { "query": "blade runner", "kind": "movie" }

# films matching "blade runner"
2 results · page 1 of 1

1. **Blade Runner** (1982 · Film)
   ★ 8.1/10 (14,231 votes) · Science Fiction, Drama, Thriller · movie id 78
   <the synopsis TMDB returns for this title, truncated to 240 chars>…
```

Then feed that id straight into `get_title` for the full record.
