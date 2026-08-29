# Arquitectura

La estructura sigue el patrón de puertos y adaptadores. Las dependencias apuntan
solo hacia dentro: el dominio no sabe nada de TMDB y el adaptador de TMDB no sabe
nada de MCP.

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

## Capa por capa

**`domain/`** — Modelos neutrales respecto al proveedor (`Title`,
`TitleDetails`, `Page<T>`), las interfaces de puerto (`HttpClient`,
`TitleRepository`, `Logger`) y una única taxonomía de errores. No importa nada de
las capas exteriores.

**`app/`** — Casos de uso (`SearchTitles`, `GetTitleDetails`, `DiscoverTitles`)
con las reglas que deben cumplirse sea quien sea quien llame, más `container.ts`,
el único sitio donde las clases concretas se conectan a las interfaces.

**`infra/`** — Adaptadores. `FetchHttpClient` es el único código que hace E/S de
red o interpreta un código de estado. `TmdbTitleRepository` traduce consultas de
dominio a peticiones de TMDB y las respuestas de vuelta a objetos de dominio.

**`mcp/`** — Protocolo y presentación. Esquemas de herramientas, detección de
capacidades y renderizado.

## Dónde se ve SOLID

No como etiqueta, sino como decisiones concretas que se pueden señalar.

### Responsabilidad única

Reintentos, espera progresiva y timeouts viven en `FetchHttpClient` y en ningún
otro sitio. Los códigos de estado se convierten en errores tipados en un único
método. La configuración se interpreta en `config.ts`; nada más lee
`process.env`. El escapado de HTML tiene una sola implementación.

### Abierto/cerrado

Añadir un segundo proveedor consiste en escribir una clase que implemente
`TitleRepository` y registrarla en el contenedor. Ningún caso de uso,
renderizador o herramienta cambia. Añadir un transporte (por ejemplo HTTP
*streamable*) reutiliza los casos de uso intactos: la CLI ya demuestra un segundo
consumidor.

### Sustitución de Liskov

Las implementaciones de `TitleRepository` son sustituibles porque el contrato
está expresado en términos de dominio: los errores de validación se lanzan antes
de cualquier petición, y los fallos externos llegan siempre como subclases
compartidas de `AppError`. Las pruebas intercambian un repositorio doble y las
herramientas se comportan igual.

### Segregación de interfaces

`HttpClient` expone un único `getJson`, porque es todo lo que necesita cualquier
adaptador: no hay una superficie `post`/`put` sin usar que haya que implementar en
un doble. `Logger` tiene un método. `ClientDisplayProfile` lleva un booleano en
lugar de un objeto de capacidades completo, para que el renderizador no pueda
adquirir una dependencia de los detalles del protocolo.

### Inversión de dependencias

Cada colaborador llega por el constructor. `FetchHttpClient` acepta `fetchImpl` y
`sleep`; el contenedor acepta sobrescrituras de `config`, `http`, `repository` y
`logger`. La batería de pruebas no necesita *mocks* de módulos, ni `nock`, ni
red.

## Dónde se eliminó duplicación a propósito

El caso más instructivo es la separación que hace TMDB entre películas y series.
Los mismos conceptos llevan nombres de campo distintos: `title` frente a `name`,
`release_date` frente a `first_air_date`, `runtime` frente a `episode_run_time`,
`primary_release_year` frente a `first_air_date_year`. La implementación obvia
son dos mapeadores y dos constructores de consultas que acaban divergiendo.

En su lugar, las diferencias se declaran una vez, en `kindSpec.ts`:

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

`mapTitle`, `mapDetails` y todos los constructores de consultas leen esa tabla.
Hay un mapeador, no dos.

::: tip Una lección aprendida a base de bien
Una versión anterior derivaba `searchYearParam` a partir de `dateField` mediante
sustitución de texto. Producía `release_year` y `first_air_year`, ninguno de los
cuales acepta TMDB, así que el filtro de año se ignoraba en silencio mientras
todas las pruebas con fixtures escritas a mano seguían pasando. Deducir con
ingenio el vocabulario de una API externa es un error esperando a ocurrir; ahora
los nombres están escritos explícitamente.
:::

Otras deduplicaciones deliberadas:

| Asunto | Único sitio |
| --- | --- |
| Contenido de las vistas | `render/viewmodel.ts`, con `text.ts` y `html.ts` como serializadores |
| Manejo de errores de herramientas | un único `run()` en `tools.ts`, compartido por las tres |
| Género id → nombre | `GenreDirectory`, con caché por tipo y fallos concurrentes agrupados |
| URLs de imágenes | `ImageUrlBuilder` |
| Omisión de campos opcionales | el ayudante `maybe()` en `mappers.ts` |
| Comprobaciones de CI al publicar | `release.yml` llama a `ci.yml` en vez de repetirlo |

## Flujo de una petición

```
cliente MCP
  → tools.ts        validar contra el esquema zod
  → useCases.ts     aplicar reglas (límites de página, años, consulta vacía)
  → TmdbTitleRepository
        ├ GenreDirectory.load(kind)   en caché tras la primera llamada
        └ FetchHttpClient.getJson     timeout · reintentos · mapeo de errores
  → mappers.ts      DTO → dominio, mediante KindSpec
  → viewmodel.ts    dominio → vista
  → text.ts (siempre) + html.ts (si el cliente puede renderizarlo)
```
