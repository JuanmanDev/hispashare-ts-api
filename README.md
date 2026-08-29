# @juanmandev/hispashare-mcp

<br>

## 💖 Support this project
If you found this project helpful, please consider supporting it!

[![GitHub Sponsor](https://img.shields.io/badge/Sponsor-JuanmanDev-ea4aaa?style=for-the-badge&logo=github)](https://github.com/sponsors/JuanmanDev) [![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/juanmandev) [![PayPal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/juanmandev)

<br>


**MCP server and typed TypeScript client for [HispaShare](https://www.hispashare.org).**
Search films and series, read their metadata, and pull the `ed2k` links a title
page lists. Markdown results everywhere, plus an interactive card view on clients
that support MCP Apps.

[English](#english) · [Español](#español)

> Needs your own HispaShare account: the site serves nothing useful to anonymous
> visitors, so the client logs in with your credentials and keeps the session
> cookie.

---

## English

### What it does

Two MCP tools:

| Tool | Purpose |
| --- | --- |
| `search_hispashare` | Find titles by name via the site's advanced search. Optional `imdb_min`, `imdb_max`, `year_min`, `year_max` filters. Returns title, year and the page URL the other tool needs. |
| `get_hispashare_links` | Full record for one title URL: poster, original title, director, genres, cast, synopsis, IMDb/user ratings, IMDb id, comments, related titles, and the table of `ed2k` links with size, download count, audio and subtitle tracks. |

It returns **metadata and link URIs only**. It does not connect to the eD2k
network, and it does not download anything.

There is no public API: both tools scrape HispaShare's HTML with
[cheerio](https://cheerio.js.org/). Markup changes upstream can break parsing —
see [Development](#development) for the smoke script that checks against the
live site.

### Quick start

The package is published to **GitHub Packages**, not to npmjs.com, so npm needs
to be told where the `@juanmandev` scope lives — and authenticated, which GitHub
Packages requires even for public packages. Copy `.npmrc.example` to `.npmrc`
(gitignored) or append it to `~/.npmrc`:

```ini
@juanmandev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Export a classic PAT with the `read:packages` scope as `GITHUB_TOKEN`, then:

```bash
npx @juanmandev/hispashare-mcp
```

Or build from source, which needs no token:

```bash
git clone https://github.com/JuanmanDev/hispashare-ts-api.git
cd hispashare-ts-api
npm ci
npm run build
```

Put your credentials in `.env` (gitignored):

```
HISPASHARE_USERNAME=your_user
HISPASHARE_PASSWORD=your_password
```

Then register the server with your MCP client. The repo's own `.mcp.json`:

```json
{
  "mcpServers": {
    "hispashare": {
      "command": "node",
      "args": ["--dns-result-order=ipv4first", "--env-file=.env", "dist/mcp/server.js"]
    }
  }
}
```

`--env-file` is what loads `.env`; pass the variables in the client's `env`
block instead if you prefer. `--dns-result-order=ipv4first` is belt-and-braces —
`server.ts` already calls `setDefaultResultOrder("ipv4first")`, because the host
resolves to an unreachable AAAA record on some networks.

### Docker

Multi-arch images (`linux/amd64`, `linux/arm64`) are published to GHCR on every
push to `main` (`:edge`) and every release tag (`:latest`, `:1.2.3`). Note `-i`,
and never `-t` — stdin is the protocol channel:

```bash
docker run -i --rm --env-file .env ghcr.io/juanmandev/hispashare-ts-api:latest
```

`docker-compose.yml` is included, with the credential wiring plus a read-only
root filesystem, dropped capabilities and `no-new-privileges`. An MCP server is
not a daemon — it reads stdin and exits when the client closes the pipe — so the
command is `run`, not `up`:

```bash
docker compose run --rm -T hispashare-mcp        # add --build to use your working tree
```

Point a client at it with an absolute path to the file:

```json
{
  "mcpServers": {
    "hispashare": {
      "command": "docker",
      "args": ["compose", "-f", "/abs/path/hispashare-ts-api/docker-compose.yml",
               "run", "--rm", "-T", "hispashare-mcp"]
    }
  }
}
```

Full details, including the tag table and the CI pipelines, in
[docs/guide/deploy.md](./docs/guide/deploy.md).

### Rich results, without breaking plain clients

Every tool result carries a **complete Markdown text block**, so any client shows
a usable answer. Both tools also declare a UI resource
(`ui://hispashare/view.html`) through
[`@modelcontextprotocol/ext-apps`](https://www.npmjs.com/package/@modelcontextprotocol/ext-apps),
and return the parsed data as JSON alongside the text. Hosts that implement MCP
Apps render that data in an iframe: a dark card view with poster, ratings and
clickable `ed2k` buttons. The HTML is a single self-contained string in
`src/ui/viewHtml.ts` — inline CSS, no external stylesheet, script or font, so it
survives a strict CSP. Hosts that ignore the resource simply show the Markdown.

### Library use

The scraping client is exported on its own, no MCP involved:

```ts
import { HispaShareClient } from "@juanmandev/hispashare-mcp";

const client = new HispaShareClient();
await client.login(); // reads HISPASHARE_USERNAME / HISPASHARE_PASSWORD

const results = await client.search("matrix", { year_min: "1990" });
const details = await client.getTitleDetails(results[0].url);

for (const link of details.links) {
  console.log(link.title, link.size, link.url);
}
```

`search` and `getTitleDetails` both re-login automatically when the response
comes back as the login form, so the explicit `login()` call is optional.
`search` also accepts `duration_min` / `duration_max`, which the MCP tool does
not currently expose.

Exported types: `SearchResult`, `LinkData`, `TitleDetails`.

### Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `HISPASHARE_USERNAME` | yes | HispaShare account name. `login()` throws without it. |
| `HISPASHARE_PASSWORD` | yes | Its password. |

Copy `.env.example` to `.env` and fill in your own values. Node 20+ is required.

### Development

```bash
npm ci
npm run typecheck
npm run build
npm run smoke          # build, then a real MCP handshake over stdio (no credentials needed)
npm run docker:build   # docker build -t hispashare-mcp .
npm run docker:smoke   # the same handshake, through the container
```

`scripts/smoke-mcp.mjs` spawns the built `dist/mcp/server.js`, writes
hand-written JSON-RPC to its stdin and asserts that both tool names come back
from `tools/list`. It uses no SDK and no test runner, so it proves the shipped
bin entry actually starts and speaks MCP. `scripts/smoke-docker.mjs` drives the
image the same way, through the shared driver in `scripts/lib/mcpHandshake.mjs`.

For the parts a protocol check cannot cover — that HispaShare's markup still
matches the selectors — run the live script with real credentials:

```bash
node --env-file=.env scripts/smoke-hispashare.ts
```

It logs in, searches for "matrix" and dumps the first title's links. Node strips
the types natively from 22.18 onward; on older Node 20/22 add
`--experimental-strip-types`. (`scripts/smoke-hispashare.js` is a stale compiled
copy — ignore it.)

Vitest is configured (`vitest.config.ts`, `test/**/*.test.ts`) but no test files
exist yet, so `npm test` runs with `--passWithNoTests` and reports nothing. Drop
that flag from the `test` script as soon as the first spec lands, so an empty
suite fails loudly instead of quietly.

### Architecture

```
src/index.ts                    public library surface (client + types)
src/infra/HispaShareClient.ts   login, advanced search, title parsing (cheerio + fetch-cookie)
src/mcp/server.ts               stdio server, bin entry
src/mcp/tools.ts                tool registration + Markdown formatting
src/ui/viewHtml.ts              the self-contained MCP Apps card view
```

The session lives in a module-level `tough-cookie` jar wrapped around global
`fetch` by `fetch-cookie`, so one process shares one login.

---

## Español

### Qué hace

Dos herramientas MCP:

| Herramienta | Para qué |
| --- | --- |
| `search_hispashare` | Busca títulos por nombre con la búsqueda avanzada del sitio. Filtros opcionales `imdb_min`, `imdb_max`, `year_min`, `year_max`. Devuelve título, año y la URL de la página que necesita la otra herramienta. |
| `get_hispashare_links` | Registro completo de una URL: cartel, título original, director, géneros, reparto, sinopsis, valoraciones IMDb/usuarios, id de IMDb, comentarios, títulos relacionados y la tabla de enlaces `ed2k` con tamaño, descargas, audios y subtítulos. |

Devuelve **solo metadatos y URIs de enlaces**: no se conecta a la red eD2k ni
descarga nada.

No hay API pública: las dos herramientas parsean el HTML de HispaShare con
[cheerio](https://cheerio.js.org/). Si el sitio cambia su marcado, el parseo se
rompe — ver [Desarrollo](#desarrollo) para el script que comprueba contra el
sitio real.

### Inicio rápido

El paquete se publica en **GitHub Packages**, no en npmjs.com, así que hay que
decirle a npm dónde vive el scope `@juanmandev` y autenticarse — GitHub Packages
pide token incluso para paquetes públicos. Copia `.npmrc.example` a `.npmrc`
(está en `.gitignore`) o añade sus líneas a `~/.npmrc`:

```ini
@juanmandev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Exporta como `GITHUB_TOKEN` un PAT clásico con el scope `read:packages` y:

```bash
npx @juanmandev/hispashare-mcp
```

O compila desde el código, que no necesita token:

```bash
git clone https://github.com/JuanmanDev/hispashare-ts-api.git
cd hispashare-ts-api
npm ci
npm run build
```

Credenciales en `.env` (está en `.gitignore`):

```
HISPASHARE_USERNAME=tu_usuario
HISPASHARE_PASSWORD=tu_contraseña
```

Y se registra el servidor en el cliente MCP. El `.mcp.json` del propio repo:

```json
{
  "mcpServers": {
    "hispashare": {
      "command": "node",
      "args": ["--dns-result-order=ipv4first", "--env-file=.env", "dist/mcp/server.js"]
    }
  }
}
```

`--env-file` es lo que carga `.env`; también puedes pasar las variables en el
bloque `env` del cliente. `--dns-result-order=ipv4first` es redundante a
propósito: `server.ts` ya llama a `setDefaultResultOrder("ipv4first")`, porque en
algunas redes el host resuelve a un registro AAAA inalcanzable.

### Docker

Las imágenes multiarquitectura (`linux/amd64`, `linux/arm64`) se publican en GHCR
en cada push a `main` (`:edge`) y en cada etiqueta de release (`:latest`,
`:1.2.3`). Con `-i`, y nunca `-t`: stdin es el canal del protocolo.

```bash
docker run -i --rm --env-file .env ghcr.io/juanmandev/hispashare-ts-api:latest
```

Se incluye `docker-compose.yml`, con las credenciales cableadas más raíz en solo
lectura, capabilities eliminadas y `no-new-privileges`. Un servidor MCP no es un
demonio — lee stdin y termina cuando el cliente cierra la tubería —, así que el
comando es `run`, no `up`:

```bash
docker compose run --rm -T hispashare-mcp        # añade --build para usar tu copia de trabajo
```

Para que un cliente lo use, dale la ruta absoluta del fichero:

```json
{
  "mcpServers": {
    "hispashare": {
      "command": "docker",
      "args": ["compose", "-f", "/ruta/abs/hispashare-ts-api/docker-compose.yml",
               "run", "--rm", "-T", "hispashare-mcp"]
    }
  }
}
```

Todos los detalles, con la tabla de etiquetas y los pipelines de CI, en
[docs/es/guide/deploy.md](./docs/es/guide/deploy.md).

### Resultados enriquecidos sin romper clientes simples

Cada resultado incluye un **bloque Markdown completo**, así que cualquier cliente
muestra una respuesta útil. Además las dos herramientas declaran un recurso de
interfaz (`ui://hispashare/view.html`) mediante
[`@modelcontextprotocol/ext-apps`](https://www.npmjs.com/package/@modelcontextprotocol/ext-apps)
y devuelven los datos parseados como JSON junto al texto. Los hosts que
implementan MCP Apps los renderizan en un iframe: vista de tarjetas oscura con
cartel, valoraciones y botones `ed2k` pulsables. El HTML es una única cadena
autocontenida en `src/ui/viewHtml.ts` — CSS en línea, sin hoja de estilos,
script ni fuente externos, de modo que sobrevive a una CSP estricta. Los hosts
que ignoran el recurso muestran solo el Markdown.

### Uso como librería

El cliente se exporta por separado, sin MCP de por medio:

```ts
import { HispaShareClient } from "@juanmandev/hispashare-mcp";

const client = new HispaShareClient();
await client.login(); // lee HISPASHARE_USERNAME / HISPASHARE_PASSWORD

const results = await client.search("matrix", { year_min: "1990" });
const details = await client.getTitleDetails(results[0].url);

for (const link of details.links) {
  console.log(link.title, link.size, link.url);
}
```

`search` y `getTitleDetails` reintentan el login solos cuando la respuesta vuelve
como formulario de acceso, así que llamar a `login()` es opcional. `search`
acepta también `duration_min` / `duration_max`, que la herramienta MCP todavía no
expone.

Tipos exportados: `SearchResult`, `LinkData`, `TitleDetails`.

### Configuración

| Variable | Obligatoria | Significado |
| --- | --- | --- |
| `HISPASHARE_USERNAME` | sí | Usuario de HispaShare. Sin ella `login()` lanza error. |
| `HISPASHARE_PASSWORD` | sí | Su contraseña. |

Copia `.env.example` a `.env` y pon tus valores. Hace falta Node 20 o superior.

### Desarrollo

```bash
npm ci
npm run typecheck
npm run build
npm run smoke          # compila y hace un handshake MCP real por stdio (sin credenciales)
npm run docker:build   # docker build -t hispashare-mcp .
npm run docker:smoke   # el mismo handshake, a través del contenedor
```

`scripts/smoke-mcp.mjs` arranca el `dist/mcp/server.js` compilado, le escribe
JSON-RPC a mano por stdin y comprueba que `tools/list` devuelve los dos nombres
de herramienta. No usa SDK ni framework de test, así que demuestra que el
binario publicado arranca de verdad y habla MCP. `scripts/smoke-docker.mjs` hace
lo mismo contra la imagen, con el driver compartido de
`scripts/lib/mcpHandshake.mjs`.

Para lo que el protocolo no cubre — que el marcado de HispaShare siga encajando
con los selectores — se ejecuta el script contra el sitio real con credenciales:

```bash
node --env-file=.env scripts/smoke-hispashare.ts
```

Hace login, busca «matrix» y saca los enlaces del primer título. Node quita los
tipos de forma nativa desde 22.18; en Node 20/22 anteriores hay que añadir
`--experimental-strip-types`. (`scripts/smoke-hispashare.js` es una compilación
vieja: ignórala.)

Vitest está configurado (`vitest.config.ts`, `test/**/*.test.ts`) pero aún no hay
ficheros de test, así que `npm test` corre con `--passWithNoTests` y no informa de
nada. Quita esa opción del script `test` en cuanto entre el primer spec, para que
una batería vacía falle a la vista.

### Arquitectura

```
src/index.ts                    superficie pública de la librería (cliente + tipos)
src/infra/HispaShareClient.ts   login, búsqueda avanzada, parseo de fichas (cheerio + fetch-cookie)
src/mcp/server.ts               servidor stdio, entrada del bin
src/mcp/tools.ts                registro de herramientas y formato Markdown
src/ui/viewHtml.ts              la vista de tarjetas autocontenida de MCP Apps
```

La sesión vive en un tarro de cookies `tough-cookie` a nivel de módulo,
envolviendo el `fetch` global con `fetch-cookie`: un proceso, un login.

---

## License

MIT — see [LICENSE](./LICENSE).

Unofficial, unaffiliated project: HispaShare does not endorse or support it. You
are responsible for what you do with the links it surfaces.


<br>

## 💖 Support this project
If you found this project helpful, please consider supporting it!

[![GitHub Sponsor](https://img.shields.io/badge/Sponsor-JuanmanDev-ea4aaa?style=for-the-badge&logo=github)](https://github.com/sponsors/JuanmanDev) [![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/juanmandev) [![PayPal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/juanmandev)

<br>
