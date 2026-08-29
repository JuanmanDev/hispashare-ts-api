# CLI y librería

MCP es un transporte, no todo el producto. Los mismos casos de uso están
disponibles desde la línea de comandos y desde tu propio TypeScript.

## CLI

```bash
npm run cli -- search "blade runner" --kind movie
npm run cli -- get movie 78
npm run cli -- discover movie --genre "Science Fiction" --year-min 1990 --year-max 1999 --sort rating
```

| Comando | Opciones |
| --- | --- |
| `search <consulta>` | `--kind movie\|series`, `--year N`, `--page N` |
| `get <movie\|series> <id>` | — |
| `discover <movie\|series>` | `--genre G`, `--year-min N`, `--year-max N`, `--rating-min N`, `--sort popularity\|rating\|newest` |

La salida es el mismo Markdown que el servidor MCP envía en su bloque de texto,
así que lo que ves en local es lo que ve un modelo.

La CLI existe en parte como comprobación de diseño: si un caso de uso necesitara
fontanería específica de MCP para funcionar, aquí no funcionaría.

## Librería

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

`createContainer()` es la raíz de composición. Lee la configuración una vez,
conecta el cliente HTTP y el repositorio, y devuelve los casos de uso listos.

### Inyectar tus propias piezas

Cada dependencia es una interfaz, así que puedes sustituir cualquiera de ellas —
es exactamente así como la batería de pruebas evita la red:

```ts
import { createContainer, type HttpClient } from "tmdb-mcp";

const fakeHttp: HttpClient = {
  async getJson<T>(path: string): Promise<T> {
    return { page: 1, results: [], total_pages: 0, total_results: 0 } as T;
  },
};

const container = createContainer({
  config: { /* …tu Config… */ } as never,
  http: fakeHttp,
});
```

Sobrescrituras disponibles: `config`, `http`, `repository`, `logger`,
`fetchImpl` y `sleep`. Las dos últimas son útiles cuando quieres el cliente real
pero con temporización determinista — la batería pasa un `sleep` vacío para que
las pruebas de reintentos se ejecuten al instante.

### Renderizado

Los renderizadores también se exportan, si quieres la misma salida en tu propia
interfaz:

```ts
import { renderText, renderHtml, toListView, toDetailView } from "tmdb-mcp";

const view = toListView(page, "Resultados");
const markdown = renderText(view);
const html = renderHtml(view); // autocontenido: CSS en línea, sin recursos externos
```

`toListView` y `toDetailView` construyen el único modelo de vista; `renderText` y
`renderHtml` son dos serializadores sobre él. Cambia una vez qué muestra una
tarjeta y ambas salidas lo reflejan.

### Tipos

Los tipos de dominio se exportan y son neutrales respecto al proveedor:
`Title`, `TitleDetails`, `Credit`, `Season`, `Page<T>`, `MediaKind`,
`SearchQuery`, `DiscoverQuery`. Los errores son una taxonomía cerrada —
`AuthError`, `NotFoundError`, `RateLimitError`, `TimeoutError`, `UpstreamError`,
`ValidationError`, `ConfigError` — todos derivados de `AppError` con un `code` y
un `userMessage` seguro de mostrar al usuario.

```ts
import { AuthError, toUserMessage } from "tmdb-mcp";

try {
  await searchTitles.execute({ query: "x" });
} catch (error) {
  if (error instanceof AuthError) process.exit(1);
  console.error(toUserMessage(error));
}
```
