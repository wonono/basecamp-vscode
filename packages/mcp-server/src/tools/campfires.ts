import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BasecampClient } from "../api/client.js";
import type { Campfire, CampfireLine } from "../api/types.js";

export function register(server: McpServer, client: BasecampClient): void {
  server.registerTool(
    "read_campfire",
    {
      description:
        "Read recent Campfire (chat) messages from a project. Returns formatted chat lines with timestamps and authors.",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
        limit: z
          .number()
          .min(1)
          .max(200)
          .optional()
          .describe("Max messages to return (default 50)"),
      },
    },
    async ({ projectId, limit }) => {
      try {
        const chatUrl = await client.getDockUrl(projectId, "chat");
        const chat = await client.get<Campfire>(chatUrl);
        const maxItems = limit ?? 50;
        const lines = await client.getPaginated<CampfireLine>(
          chat.lines_url,
          maxItems
        );

        if (lines.length === 0) {
          return {
            content: [{ type: "text", text: "No messages in this Campfire." }],
          };
        }

        const formatted = lines.map((line) => {
          const date = new Date(line.created_at);
          const ts = date.toISOString().replace("T", " ").slice(0, 16);
          return `[${ts}] ${line.creator.name}: ${line.content}`;
        });

        const header = `# Campfire — ${chat.bucket.name} (Chat ID: ${chat.id})\nShowing ${lines.length} messages\n`;
        const text = header + "\n" + formatted.join("\n");
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to read campfire: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "post_campfire_line",
    {
      description: "Send a message to a project's Campfire chat",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
        content: z.string().min(1).describe("Message text to send"),
      },
    },
    async ({ projectId, content }) => {
      try {
        const chatUrl = await client.getDockUrl(projectId, "chat");
        const chat = await client.get<Campfire>(chatUrl);
        const linesPath = new URL(chat.lines_url).pathname;
        await client.post(linesPath, { content });

        return {
          content: [
            {
              type: "text",
              text: `Message sent to Campfire in "${chat.bucket.name}".`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to post campfire line: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
