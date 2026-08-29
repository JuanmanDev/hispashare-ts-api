# Docker, Compose and CI

## Container image

Multi-stage build: dependencies and `tsc` live in the build stage, and only
`dist/`, pruned production `node_modules` and `package.json` reach the runtime
stage. It runs as the unprivileged `node` user, and no credential is ever baked
in — they arrive at run time.

```bash
docker build -t hispashare-mcp .
docker run -i --rm \
  -e HISPASHARE_USERNAME=your_user \
  -e HISPASHARE_PASSWORD=your_password \
  hispashare-mcp
```

An `--env-file` works too, and keeps the password out of your shell history:

```bash
docker run -i --rm --env-file .env hispashare-mcp
```

Published images are multi-arch (`linux/amd64`, `linux/arm64`):

```bash
docker pull ghcr.io/juanmandev/hispashare-ts-api:latest
```

| Tag | Points at |
| --- | --- |
| `latest` | the newest `v*` release tag |
| `1.2.3`, `1.2` | that exact release |
| `edge` | the current `main` |
| `main-<sha>` | one specific commit on `main` |

::: warning `-i` yes, `-t` no
The MCP stdio transport uses the container's stdin/stdout as the protocol
channel. `-i` keeps stdin open; `-t` allocates a TTY and corrupts the stream.
:::

## Compose

`docker-compose.yml` wraps the same image with the credential wiring, a
read-only root filesystem, all capabilities dropped and `no-new-privileges`.

Because an MCP server is not a daemon — it reads stdin and exits when the client
closes the pipe — the command to use is `run`, not `up`:

```bash
docker compose run --rm -T hispashare-mcp
```

`-T` disables TTY allocation, for the reason above. `docker compose up` would
start the container with nothing attached to its stdin, and it would just sit
there.

Credentials come from `./.env` via `env_file` (declared `required: false`, so the
file may be absent), and an already-exported shell variable of the same name
wins. To build from your working tree instead of pulling, comment out the
`image:` key or pass `--build`:

```bash
docker compose run --rm -T --build hispashare-mcp
```

To point an MCP client at Compose, give it that command:

```json
{
  "mcpServers": {
    "hispashare": {
      "command": "docker",
      "args": [
        "compose",
        "-f", "/absolute/path/to/hispashare-ts-api/docker-compose.yml",
        "run", "--rm", "-T", "hispashare-mcp"
      ]
    }
  }
}
```

The path must be absolute: the client is not running in the repo directory.

## Pipelines

Three workflows. The later two reuse the first through `workflow_call` rather
than repeating its checks, so a release runs *the same* CI, not a copy that can
drift.

### `ci.yml` — on every push and pull request

| Step | What it proves |
| --- | --- |
| `npm run typecheck` | No type errors. |
| `npm test` | The unit suite. Never touches the live site. Currently runs with `--passWithNoTests`: no spec files exist yet, and an empty run must not be mistaken for a failing pipeline. |
| `npm run build` | The published artefact compiles. |
| `node scripts/smoke-mcp.mjs` | The **built** bin entry starts, completes an MCP handshake over a real stdio pipe and advertises both tools. |
| `docker compose config --quiet` | The Compose file is valid, before anyone else discovers otherwise. |
| `node scripts/smoke-docker.mjs` | Same handshake through the **image**, so the entrypoint, the pruned `node_modules` and the non-root user are exercised too. |
| `docker compose run` + `grep` | The Compose service answers `tools/list` with `search_hispashare`. |

The matrix covers Node 20, 22 and 24, so an accidental dependency on a newer
built-in gets caught.

No step needs a HispaShare account: `tools/list` performs no upstream request, so
dummy credentials suffice. Both smoke scripts share one driver
(`scripts/lib/mcpHandshake.mjs`) so the local and containerised checks cannot
diverge.

### `docker.yml` — on `main`, on `v*` tags, or manually

Gated on `ci.yml`, then builds `linux/amd64` and `linux/arm64`, pushes to GHCR
with the tag set above, attaches a build provenance attestation, and finally
pulls one of the pushed tags back to smoke-test what was actually published.
Auth is the job's own `GITHUB_TOKEN` with `packages: write` — no secret to
configure.

### `release.yml` — on a `v*` tag

Gated on `ci.yml`, verifies the tag matches `package.json#version` (a mismatch
fails the release), then publishes to **GitHub Packages**
(`npm.pkg.github.com`), again with `GITHUB_TOKEN`. GitHub's npm registry requires
the package name to be scoped to the repository owner, which is why it is
`@juanmandev/hispashare-mcp`.

There is no `--provenance` flag: the GitHub Packages npm registry does not accept
provenance attestations. The container image is attested instead.

Releasing is therefore:

```bash
npm version patch      # or minor / major — commits and tags
git push --follow-tags
```

### `pages.yml` — documentation

Builds this VitePress site and deploys to GitHub Pages on pushes to `main` that
touch `docs/`. Enable Pages once, with **Source: GitHub Actions**.

## Installing from GitHub Packages

Consumers must be told where the scope lives, and be authenticated — GitHub
Packages requires a token even for public packages. Copy `.npmrc.example` to
`.npmrc`, or append it to `~/.npmrc`:

```ini
@juanmandev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Export a classic PAT with the `read:packages` scope as `GITHUB_TOKEN`, then:

```bash
npm install @juanmandev/hispashare-mcp
# or run the server straight from the registry
npx @juanmandev/hispashare-mcp
```

## What the smoke tests cannot prove

They prove the protocol wiring, not the scraping. Both tools parse HispaShare's
HTML with cheerio, and `tools/list` never fetches a page — so CI stays green even
if the site restructures its markup tomorrow. The only check for that is the live
script, run by hand with real credentials:

```bash
node --env-file=.env scripts/smoke-hispashare.ts
```
