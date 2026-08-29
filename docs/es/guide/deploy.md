# Docker, Compose y CI

## Imagen de contenedor

Compilación multietapa: las dependencias y `tsc` viven en la etapa de
construcción, y a la etapa final solo llegan `dist/`, los `node_modules` de
producción ya podados y `package.json`. Se ejecuta con el usuario sin privilegios
`node`, y ninguna credencial queda dentro de la imagen: se pasan al arrancar.

```bash
docker build -t hispashare-mcp .
docker run -i --rm \
  -e HISPASHARE_USERNAME=tu_usuario \
  -e HISPASHARE_PASSWORD=tu_contraseña \
  hispashare-mcp
```

También sirve `--env-file`, que además mantiene la contraseña fuera del historial
del shell:

```bash
docker run -i --rm --env-file .env hispashare-mcp
```

Las imágenes publicadas son multiarquitectura (`linux/amd64`, `linux/arm64`):

```bash
docker pull ghcr.io/juanmandev/hispashare-ts-api:latest
```

| Etiqueta | Apunta a |
| --- | --- |
| `latest` | la última etiqueta de release `v*` |
| `1.2.3`, `1.2` | esa release exacta |
| `edge` | el `main` actual |
| `main-<sha>` | un commit concreto de `main` |

::: warning `-i` sí, `-t` no
El transporte stdio de MCP usa stdin/stdout del contenedor como canal del
protocolo. `-i` mantiene stdin abierto; `-t` asigna una TTY y corrompe el flujo.
:::

## Compose

`docker-compose.yml` envuelve la misma imagen con el cableado de credenciales,
sistema de ficheros raíz en solo lectura, todas las capabilities eliminadas y
`no-new-privileges`.

Un servidor MCP no es un demonio — lee stdin y termina cuando el cliente cierra
la tubería —, así que el comando útil es `run`, no `up`:

```bash
docker compose run --rm -T hispashare-mcp
```

`-T` desactiva la TTY, por lo dicho arriba. `docker compose up` arrancaría el
contenedor sin nada conectado a su stdin y se quedaría ahí parado.

Las credenciales salen de `./.env` mediante `env_file` (declarado
`required: false`, así que el fichero puede no existir), y una variable de
entorno ya exportada con el mismo nombre gana. Para construir desde tu copia de
trabajo en vez de descargar la imagen, comenta la clave `image:` o pasa
`--build`:

```bash
docker compose run --rm -T --build hispashare-mcp
```

Para que un cliente MCP use Compose, dale ese comando:

```json
{
  "mcpServers": {
    "hispashare": {
      "command": "docker",
      "args": [
        "compose",
        "-f", "/ruta/absoluta/a/hispashare-ts-api/docker-compose.yml",
        "run", "--rm", "-T", "hispashare-mcp"
      ]
    }
  }
}
```

La ruta tiene que ser absoluta: el cliente no se ejecuta en el directorio del
repo.

## Pipelines

Tres workflows. Los dos últimos reutilizan el primero con `workflow_call` en vez
de repetir sus comprobaciones, así una release ejecuta *la misma* CI y no una
copia que puede desviarse.

### `ci.yml` — en cada push y cada pull request

| Paso | Qué demuestra |
| --- | --- |
| `npm run typecheck` | No hay errores de tipos. |
| `npm test` | La batería unitaria. Nunca toca el sitio real. Ahora mismo corre con `--passWithNoTests`: todavía no hay especificaciones y una ejecución vacía no debe confundirse con un pipeline roto. |
| `npm run build` | El artefacto publicable compila. |
| `node scripts/smoke-mcp.mjs` | El binario **compilado** arranca, completa un handshake MCP por una tubería stdio real y anuncia las dos herramientas. |
| `docker compose config --quiet` | El fichero de Compose es válido, antes de que lo descubra otra persona. |
| `node scripts/smoke-docker.mjs` | El mismo handshake a través de la **imagen**, para ejercitar también el entrypoint, los `node_modules` podados y el usuario no-root. |
| `docker compose run` + `grep` | El servicio de Compose responde a `tools/list` con `search_hispashare`. |

La matriz cubre Node 20, 22 y 24, así se detecta cualquier dependencia
accidental de un built-in más nuevo.

Ningún paso necesita cuenta de HispaShare: `tools/list` no hace ninguna petición
al sitio, así que basta con credenciales de relleno. Los dos scripts de smoke
comparten un único driver (`scripts/lib/mcpHandshake.mjs`) para que la
comprobación local y la del contenedor no puedan divergir.

### `docker.yml` — en `main`, en etiquetas `v*` o a mano

Depende de `ci.yml`; después construye `linux/amd64` y `linux/arm64`, publica en
GHCR con las etiquetas de la tabla, adjunta una atestación de procedencia y por
último vuelve a descargar una de las etiquetas publicadas para hacerle el smoke
test a lo que realmente se subió. Se autentica con el `GITHUB_TOKEN` del propio
job y `packages: write`: no hay secreto que configurar.

### `release.yml` — en etiquetas `v*`

Depende de `ci.yml`, comprueba que la etiqueta coincide con
`package.json#version` (si no, la release falla) y publica en **GitHub Packages**
(`npm.pkg.github.com`), otra vez con `GITHUB_TOKEN`. El registro npm de GitHub
exige que el nombre del paquete lleve el scope del propietario del repositorio,
y de ahí `@juanmandev/hispashare-mcp`.

No hay `--provenance`: el registro npm de GitHub Packages no acepta atestaciones
de procedencia. La que se firma es la imagen de contenedor.

Publicar una versión es entonces:

```bash
npm version patch      # o minor / major — hace commit y etiqueta
git push --follow-tags
```

### `pages.yml` — documentación

Compila este sitio de VitePress y lo despliega en GitHub Pages en los pushes a
`main` que toquen `docs/`. Hay que activar Pages una vez, con **Source: GitHub
Actions**.

## Instalar desde GitHub Packages

Hay que decirle a npm dónde vive el scope, y autenticarse: GitHub Packages pide
token incluso para paquetes públicos. Copia `.npmrc.example` a `.npmrc`, o añade
sus líneas a `~/.npmrc`:

```ini
@juanmandev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Exporta como `GITHUB_TOKEN` un PAT clásico con el scope `read:packages` y:

```bash
npm install @juanmandev/hispashare-mcp
# o ejecuta el servidor directamente desde el registro
npx @juanmandev/hispashare-mcp
```

## Qué no demuestran los smoke tests

Demuestran el cableado del protocolo, no el scraping. Las dos herramientas
parsean el HTML de HispaShare con cheerio y `tools/list` no descarga ninguna
página, así que la CI sigue verde aunque mañana el sitio reestructure su marcado.
Lo único que comprueba eso es el script contra el sitio real, ejecutado a mano
con credenciales:

```bash
node --env-file=.env scripts/smoke-hispashare.ts
```
