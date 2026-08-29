# Resultados enriquecidos

Los resultados de las herramientas llevan dos representaciones de los mismos
datos. Cuáles recibe un cliente depende de lo que sea capaz de mostrar.

## El contrato de compatibilidad

1. **El bloque de texto va siempre primero.** Es Markdown completo: títulos,
   valoraciones, reparto, enlaces. Un cliente que no entienda nada más sigue
   mostrando una respuesta útil. Es el camino que toma cualquier host ya
   existente, y nunca se degrada para dejar sitio a la vista enriquecida.
2. **Se añade un recurso `text/html` embebido cuando el cliente puede
   renderizarlo.** Los mismos datos, maquetados como tarjetas con pósteres,
   barras de valoración y etiquetas de género.

Es decir, la vista enriquecida es estrictamente aditiva. No se traslada nada a
ella y quitarla no pierde información.

## Cómo se detecta el soporte

::: warning Estado real
MCP **todavía no** tiene una capacidad ratificada que signifique «sé renderizar
un recurso HTML en línea». Mientras eso se estabiliza, los hosts lo anuncian
bajo `capabilities.experimental` con claves propias de cada fabricante.
:::

El modo `auto` — el predeterminado — busca cualquiera de las claves
experimentales que se ven hoy en la práctica (`ui`, `htmlResources`, `html`,
`resourceUi`, `mcpUi`, `mcp-ui`, `openai/outputTemplate`), sin distinguir
mayúsculas. Si no encuentra ninguna, el servidor envía **solo texto**.

Ese valor por defecto es deliberadamente conservador: equivocarse en el otro
sentido vuelca marcado en bruto en la conversación, que es peor que una
respuesta sencilla. Sobrescríbelo cuando conozcas tu cliente mejor que la
detección:

| `TMDB_MCP_UI` | Comportamiento |
| --- | --- |
| `auto` (por defecto) | HTML solo si el cliente anuncia una capacidad de interfaz reconocida. |
| `always` | HTML siempre. Útil si tu cliente renderiza HTML pero no lo anuncia. |
| `never` | Solo texto. Útil para logs, tuberías o un host que muestre los recursos como código fuente. |

Cuando el estándar se publique, lo único que habrá que cambiar es `auto`: una
lista de claves en `src/mcp/capabilities.ts`.

## Qué contiene el HTML

- **Autocontenido.** `<style>` en línea, sin hoja de estilos externa, sin script
  de CDN, sin fuentes web. Sobrevive a un sandbox o una CSP estrictos.
- **Renderizado en el servidor.** El marcado se genera en TypeScript y llega
  completo. Si el host bloquea los scripts por completo, el resultado sigue
  siendo perfectamente legible: nada se dibuja con JavaScript en el cliente.
- **Mejora progresiva.** Un script pequeño registra un elemento personalizado
  `tmdb-result` y añade comportamiento al marcado que ya existe: pulsa o haz
  clic para expandir una sinopsis recortada. Nunca vuelve a renderizar el
  contenido, y por eso no hay una plantilla duplicada en el cliente.
- **Adaptado al tema.** Respeta `prefers-color-scheme`.
- **Responsive.** Una columna en pantallas estrechas y dos a partir de 620 px.
- **Escapado.** Todo el texto interpolado pasa por un único escapador, con una
  variante específica para contexto de atributo (URLs). Hay pruebas que inyectan
  `<img src=x onerror=…>` a través de un título y comprueban que sale inerte.

Las únicas referencias remotas son las imágenes de póster de TMDB, que degradan
al texto `alt` si se bloquean.

## URIs de recursos

Las vistas renderizadas se guardan en caché y se pueden leer como recursos:

```
ui://tmdb/movie/78
ui://tmdb/series/95396
ui://tmdb/list/films-matching-blade-runner
```

Para hosts que prefieren pedir recursos en lugar de consumir los embebidos. La
caché conserva los 50 renderizados más recientes.
