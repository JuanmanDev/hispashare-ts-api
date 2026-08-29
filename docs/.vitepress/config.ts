import { defineConfig } from "vitepress";

const REPO = "JuanmanDev/hispashare-ts-api";

export default defineConfig({
  title: "hispashare-mcp",
  description:
    "MCP server and typed TypeScript client for HispaShare film/series metadata and ed2k links",
  // Served from https://<user>.github.io/<repo>/
  base: `/${REPO.split("/")[1]}/`,
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,

  head: [["meta", { name: "theme-color", content: "#0b7285" }]],

  locales: {
    root: {
      label: "English",
      lang: "en-US",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/getting-started" },
          { text: "Architecture", link: "/guide/architecture" },
        ],
        sidebar: [
          {
            text: "Guide",
            items: [
              { text: "Getting started", link: "/guide/getting-started" },
              { text: "Use as an MCP server", link: "/guide/mcp" },
              { text: "CLI and library", link: "/guide/cli-and-library" },
              { text: "Rich results", link: "/guide/rich-ui" },
              { text: "Docker, Compose and CI", link: "/guide/deploy" },
              { text: "Architecture", link: "/guide/architecture" },
            ],
          },
        ],
        editLink: {
          pattern: `https://github.com/${REPO}/edit/main/docs/:path`,
          text: "Edit this page on GitHub",
        },
        outline: { level: [2, 3] },
      },
    },
    es: {
      label: "Español",
      lang: "es-ES",
      link: "/es/",
      themeConfig: {
        nav: [
          { text: "Guía", link: "/es/guide/getting-started" },
          { text: "Arquitectura", link: "/es/guide/architecture" },
        ],
        sidebar: [
          {
            text: "Guía",
            items: [
              { text: "Primeros pasos", link: "/es/guide/getting-started" },
              { text: "Usar como servidor MCP", link: "/es/guide/mcp" },
              { text: "CLI y librería", link: "/es/guide/cli-and-library" },
              { text: "Resultados enriquecidos", link: "/es/guide/rich-ui" },
              { text: "Docker, Compose y CI", link: "/es/guide/deploy" },
              { text: "Arquitectura", link: "/es/guide/architecture" },
            ],
          },
        ],
        editLink: {
          pattern: `https://github.com/${REPO}/edit/main/docs/:path`,
          text: "Editar esta página en GitHub",
        },
        docFooter: { prev: "Anterior", next: "Siguiente" },
        outline: { level: [2, 3], label: "En esta página" },
        darkModeSwitchLabel: "Tema",
        returnToTopLabel: "Volver arriba",
        lastUpdatedText: "Última actualización",
      },
    },
  },

  themeConfig: {
    socialLinks: [{ icon: "github", link: `https://github.com/${REPO}` }],
    search: { provider: "local" },
    footer: {
      message: "Released under the MIT License.",
      copyright:
        'Data from <a href="https://www.themoviedb.org/">TMDB</a>. This project is not endorsed or certified by TMDB.',
    },
  },
});
