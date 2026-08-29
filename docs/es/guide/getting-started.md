# Primeros pasos

## Requisitos

- **Node.js 20 o superior.** El servidor usa `process.loadEnvFile`, `fetch`
  nativo y `AbortSignal`, disponibles desde Node 20.12.
- **Una clave de API de TMDB.** Es gratuita: crea una cuenta y abre
  [Ajustes → API](https://www.themoviedb.org/settings/api). Sirven ambas
  credenciales:
  - una **clave v3** — 32 caracteres hexadecimales, se envía como parámetro
    `api_key`;
  - un **token de lectura v4** — un JWT largo que empieza por `eyJ`, se envía en
    la cabecera `Authorization: Bearer`.

  No tienes que elegir: el cliente inspecciona el valor y aplica el esquema
  correcto.

## Instalación

Para el caso habitual no hay nada que instalar:

```bash
npx -y tmdb-mcp
```

Para usarlo como librería o para desarrollar sobre él:

```bash
npm install tmdb-mcp
```

## Configuración

Lo único obligatorio es la clave. Puedes proporcionarla como mejor encaje con tu
host:

::: code-group

```bash [shell]
export TMDB_API_KEY=tu_clave_aqui
```

```ini [.env]
TMDB_API_KEY=tu_clave_aqui
```

```json [configuración del cliente MCP]
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

:::

Si existe un `.env` en el directorio de trabajo se lee automáticamente. Está
**en .gitignore**: mantén las claves reales fuera de los commits.

### Todas las opciones

| Variable | Por defecto | Para qué sirve |
| --- | --- | --- |
| `TMDB_API_KEY` | — | **Obligatoria.** Clave v3 o token v4. |
| `TMDB_LANGUAGE` | `en-US` | Idioma de títulos, sinopsis y géneros. Prueba `es-ES`. |
| `TMDB_MCP_UI` | `auto` | Resultados HTML: `auto`, `always`, `never`. Ver [Resultados enriquecidos](./rich-ui). |
| `TMDB_TIMEOUT_MS` | `15000` | Tiempo máximo por petición. |
| `TMDB_RETRIES` | `2` | Reintentos ante timeouts, 429 y 5xx, con espera progresiva. |
| `TMDB_POSTER_SIZE` | `w342` | Ancho del póster en la CDN de imágenes. |
| `TMDB_BACKDROP_SIZE` | `w780` | Ancho del fondo. |
| `TMDB_PROFILE_SIZE` | `w185` | Ancho de las fotos del reparto. |
| `TMDB_BASE_URL` | TMDB v3 | Sobrescritura para pruebas contra un mock. |
| `TMDB_IMAGE_BASE_URL` | CDN de TMDB | Sobrescritura para pruebas contra un mock. |

Un valor inválido falla al arrancar con un mensaje que nombra la variable, en
lugar de comportarse mal más adelante.

## Comprobar que funciona

Desde un clon, compila y ejecuta la prueba de humo del protocolo: arranca el
servidor compilado de verdad, completa un *handshake* MCP sobre una tubería
stdio y verifica la lista de herramientas anunciadas. No necesita una clave
válida, porque listar herramientas no hace ninguna llamada externa:

```bash
npm ci
npm run build
node scripts/smoke-mcp.mjs
# smoke: OK tmdb-mcp@0.1.0 protocol=2024-11-05 tools=[search_titles, get_title, discover_titles]
```

Para confirmar que tu clave es correcta, haz una petición real con la CLI:

```bash
npm run cli -- search "blade runner" --kind movie
```

Una clave inválida aparece como `TMDB rejected the API key. Check TMDB_API_KEY.`

## Siguientes pasos

- [Usar como servidor MCP](./mcp) — referencia de herramientas y conexión con clientes.
- [CLI y librería](./cli-and-library) — los mismos casos de uso sin MCP.
- [Resultados enriquecidos](./rich-ui) — cómo se negocia la vista HTML.
