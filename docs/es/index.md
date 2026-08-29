---
layout: home

hero:
  name: tmdb-mcp
  text: Metadatos de cine y TV para clientes MCP
  tagline: Cliente tipado de TMDB que se conecta a cualquier host MCP mediante npx o Docker — con resultados HTML enriquecidos donde se admiten y texto plano en todos los demás casos.
  actions:
    - theme: brand
      text: Primeros pasos
      link: /es/guide/getting-started
    - theme: alt
      text: Usar como servidor MCP
      link: /es/guide/mcp
    - theme: alt
      text: In English
      link: /
features:
  - title: Tres herramientas concretas
    details: search_titles para encontrar algo y obtener su id, get_title para los metadatos completos incluyendo reparto, equipo y temporadas, y discover_titles para explorar por género, rango de años y valoración.
  - title: Enriquecido si se puede, legible siempre
    details: Cada resultado incluye un bloque Markdown completo. Los clientes capaces de renderizar un recurso text/html embebido reciben además una vista de tarjetas autocontenida, sin CSS, fuentes ni scripts externos.
  - title: Un solo comando
    details: npx -y tmdb-mcp, o un contenedor multiarquitectura desde GHCR. Sin instalación global, sin paso de compilación y sin más configuración que tu clave de API.
  - title: Puertos y adaptadores
    details: El dominio no sabe nada de TMDB y el adaptador de TMDB no sabe nada de MCP. Añadir un proveedor o un transporte significa añadir un archivo, no editar uno.
---

## Qué es

Un servidor MCP que responde preguntas sobre cine y televisión usando
[TMDB](https://www.themoviedb.org/) como fuente, junto con la librería tipada
que hay debajo — utilizable por separado si prefieres importar un módulo en vez
de ejecutar un servidor.

```bash
npx -y tmdb-mcp
```

## Qué no es

No localiza, indexa ni descarga archivos de vídeo. Devuelve metadatos: títulos,
años, sinopsis, valoraciones, géneros, duraciones, reparto, equipo, temporadas y
enlaces a TMDB e IMDb.

## Un ejemplo rápido

```
> search_titles { "query": "blade runner", "kind": "movie" }

# films matching "blade runner"
2 results · page 1 of 1

1. **Blade Runner** (1982 · Film)
   ★ 8.1/10 (14,231 votes) · Science Fiction, Drama, Thriller · movie id 78
   <la sinopsis que devuelve TMDB, recortada a 240 caracteres>…
```

Después pasa ese `id` directamente a `get_title` para obtener el registro
completo.

::: tip Idioma de los datos
Los textos de la interfaz de las herramientas están en inglés, pero los datos no
tienen por qué estarlo: con `TMDB_LANGUAGE=es-ES` los títulos, sinopsis y
géneros llegan en español.
:::
