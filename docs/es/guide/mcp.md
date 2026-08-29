# Usar como servidor MCP

El servidor habla MCP por **stdio**: el host lo lanza como proceso hijo e
intercambia JSON-RPC por stdin/stdout. Todos los diagnósticos van a stderr, así
que los logs nunca pueden corromper el flujo del protocolo.

## Conectarlo a un cliente

::: code-group

```json [npx (recomendado)]
{
  "mcpServers": {
    "tmdb": {
      "command": "npx",
      "args": ["-y", "tmdb-mcp"],
      "env": { "TMDB_API_KEY": "tu_clave_aqui" }
    }
  }
}
```

```json [compilación local]
{
  "mcpServers": {
    "tmdb": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "env": { "TMDB_API_KEY": "tu_clave_aqui" }
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
      "env": { "TMDB_API_KEY": "tu_clave_aqui" }
    }
  }
}
```

:::

::: warning Docker necesita `-i`, nunca `-t`
Con transporte stdio, la entrada estándar del contenedor **es** el canal del
protocolo. `-i` la mantiene abierta; añadir `-t` asigna una TTY que corrompe el
flujo.
:::

En Claude Code puedes registrarlo por proyecto sin editar JSON a mano:

```bash
claude mcp add tmdb -- npx -y tmdb-mcp
```

Un `.mcp.json` en la raíz del repositorio se aplica solo a ese directorio, que
suele ser lo deseable para un servidor que lleva una clave.

## Herramientas

Las tres son de solo lectura y están anotadas como tales (`readOnlyHint`), de
modo que los hosts que restringen herramientas con capacidad de escritura no
pedirán confirmación para estas.

### `search_titles`

Busca películas y series por nombre. Es el punto de entrada: devuelve el `id`
numérico que necesita `get_title`.

| Parámetro | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `query` | texto, 1–100 caracteres | sí | Título a buscar. |
| `kind` | `movie` \| `series` | no | Omítelo para buscar en **ambos** y obtener una clasificación combinada. |
| `year` | entero 1870–2200 | no | Año de estreno (películas) o de primera emisión (series). |
| `page` | entero 1–500 | no | Por defecto 1. |

Cuando se omite `kind`, el servidor consulta películas y series en paralelo y
combina los resultados, ordenando por valoración ponderada con el número de
votos: así un 9,5 con doce votos no adelanta a un 8,2 con veinte mil.

### `get_title`

Registro completo de un título.

| Parámetro | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `kind` | `movie` \| `series` | sí | Debe coincidir con el tipo devuelto por la búsqueda. |
| `id` | entero positivo | sí | Id de TMDB. |

Devuelve sinopsis, eslogan, estado, duración (por episodio en series), géneros,
reparto principal, equipo clave (dirección, guion, producción), lista de
temporadas en series y enlaces a TMDB e IMDb cuando existe id de IMDb.

### `discover_titles`

Explorar sin texto de búsqueda — «ciencia ficción bien valorada de los noventa».

| Parámetro | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `kind` | `movie` \| `series` | sí | |
| `genre` | texto | no | **Nombre** del género, p. ej. `Ciencia ficción`. |
| `yearMin` / `yearMax` | entero | no | Límites inclusivos. |
| `ratingMin` | número 0–10 | no | Aplica también un mínimo de votos para que títulos desconocidos con una única nota perfecta no copen los resultados. |
| `sort` | `popularity` \| `rating` \| `newest` | no | Por defecto `popularity`. |
| `page` | entero 1–500 | no | |

La coincidencia de géneros ignora mayúsculas y acentos, así que `ciencia
ficcion` encuentra `Ciencia ficción` cuando `TMDB_LANGUAGE=es-ES`. Un género no
reconocido se rechaza devolviendo la lista completa de valores válidos para ese
tipo, de modo que el modelo puede corregirse sin una segunda ida y vuelta.

## Recursos

Las vistas HTML renderizadas se exponen además como recursos bajo `ui://tmdb/…`:

- `ui://tmdb/movie/78` — última vista de detalle renderizada de ese título
- `ui://tmdb/list/<slug>` — última lista de resultados renderizada

Existe para hosts que prefieren `resources/read` a los recursos embebidos. La
caché guarda las 50 vistas más recientes y es puramente un artefacto de
presentación: nada depende de ella.

## Errores

Los fallos llegan como errores de herramienta con un mensaje breve y accionable
en lugar de una traza:

| Situación | Mensaje |
| --- | --- |
| Clave incorrecta o ausente | `TMDB rejected the API key. Check TMDB_API_KEY.` |
| Límite de peticiones | `Rate limited by TMDB. Retry in ~Ns.` |
| Id inexistente | `Not found: /movie/999999999` |
| Género desconocido | `Unknown genre "X" for movie. Available: …` |
| Timeout | `Request timed out after 15000ms` |

Los timeouts, los 429 y los 5xx se reintentan automáticamente con espera
progresiva antes de mostrar cualquier error; si viene una cabecera `Retry-After`,
se respeta.
