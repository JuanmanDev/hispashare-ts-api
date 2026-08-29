import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { HispaShareClient, type SearchResult, type LinkData, type TitleDetails } from "../infra/HispaShareClient.js";

function formatSearchResults(results: SearchResult[], query: string): string {
  if (results.length === 0) return `No results found for "${query}".`;
  
  let md = `# HispaShare Search Results for "${query}"\n\n`;
  md += `| Title | Year | ID/Link |\n`;
  md += `|---|---|---|\n`;
  
  for (const r of results) {
    const yearStr = r.year ? r.year.toString() : 'N/A';
    md += `| ${r.title} | ${yearStr} | [View Details](${r.url}) |\n`;
  }
  
  return md;
}

function formatTitleDetails(details: TitleDetails, url: string): string {
  let md = `# ${details.title}\n\n`;

  if (details.posterUrl) {
    md += `![Poster](${details.posterUrl})\n\n`;
  }

  md += `**Original Title:** ${details.originalTitle}\n\n`;
  md += `**Director:** ${details.director}\n\n`;
  md += `**Genres:** ${details.genres}\n\n`;
  md += `**Actors:** ${details.actors}\n\n`;
  
  if (details.synopsis) {
    md += `> ${details.synopsis}\n\n`;
  }

  md += `**Ratings:**\n`;
  if (details.imdbRating) md += `- IMDB: ${details.imdbRating}\n`;
  if (details.userRating) md += `- Users: ${details.userRating}\n`;
  md += `\n`;

  if (details.links.length === 0) {
    md += `*No links found at ${url}.*\n\n`;
  } else {
    md += `## Download Links\n`;
    if (details.imdbId) {
      md += `**IMDB ID:** [${details.imdbId}](https://www.imdb.com/title/${details.imdbId}/)\n\n`;
    }
    
    md += `| Title | Size | Downloads | Audio | Subtitles | Link |\n`;
    md += `|---|---|---|---|---|---|\n`;
    
    for (const l of details.links) {
      const audio = l.audio.join(', ') || '-';
      const subs = l.subtitles.join(', ') || '-';
      md += `| ${l.title} | ${l.size} | ${l.downloads} | ${audio} | ${subs} | [Download (ed2k)](${l.url}) |\n`;
    }
    md += `\n`;
  }

  if (details.comments && details.comments.length > 0) {
    md += `## Comments\n\n`;
    const limitedComments = details.comments.slice(0, 5);
    for (const c of limitedComments) {
      md += `**${c.author}** ${c.date ? `(${c.date})` : ''}: \n${c.text}\n\n---\n\n`;
    }
  }

  if (details.related && details.related.length > 0) {
    md += `## Related Titles\n\n`;
    const limitedRelated = details.related.slice(0, 10);
    for (const r of limitedRelated) {
      md += `- [${r.title}](${r.url})\n`;
    }
    md += `\n`;
  }

  md += `\n[View Full Page on HispaShare](${url})\n`;
  
  return md;
}

import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { viewHtml } from "../ui/viewHtml.js";

export function registerTools(server: McpServer, client: HispaShareClient): void {
  // Register the HTML resource for the UI
  registerAppResource(
    server,
    "HispaShare View",
    "ui://hispashare/view.html",
    {
      description: "Interactive HispaShare metadata and link details",
    },
    async () => {
      return {
        contents: [
          {
            uri: "ui://hispashare/view.html",
            mimeType: RESOURCE_MIME_TYPE,
            text: viewHtml,
          },
        ],
      };
    }
  );

  registerAppTool(
    server,
    "search_hispashare",
    {
      title: "Search HispaShare",
      description: "Search HispaShare for films and series.",
      inputSchema: {
        query: z.string().describe("Title to search for, e.g. 'Blade Runner'"),
        imdb_min: z.string().optional().describe("Minimum IMDb rating"),
        imdb_max: z.string().optional().describe("Maximum IMDb rating"),
        year_min: z.string().optional().describe("Minimum year"),
        year_max: z.string().optional().describe("Maximum year"),
      },
      _meta: {
        ui: { resourceUri: "ui://hispashare/view.html" },
      },
    },
    async (args) => {
      try {
        const results = await client.search(args.query, {
          imdb_min: args.imdb_min || '',
          imdb_max: args.imdb_max || '',
          year_min: args.year_min || '',
          year_max: args.year_max || '',
        });
        
        return {
          content: [
            {
              type: "text",
              text: formatSearchResults(results, args.query),
            },
          ],
          // Return raw JSON data to the UI iframe
          data: results,
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error.message}` }],
        };
      }
    }
  );

  registerAppTool(
    server,
    "get_hispashare_links",
    {
      title: "Get links from HispaShare URL",
      description: "Fetches ed2k links and metadata from a specific HispaShare URL.",
      inputSchema: {
        url: z.string().url().describe("The HispaShare URL of the title"),
      },
      _meta: {
        ui: { resourceUri: "ui://hispashare/view.html" },
      },
    },
    async (args) => {
      try {
        const details = await client.getTitleDetails(args.url);
        
        return {
          content: [
            {
              type: "text",
              text: formatTitleDetails(details, args.url),
            },
          ],
          // Return raw JSON data to the UI iframe
          data: details,
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error.message}` }],
        };
      }
    }
  );
}
