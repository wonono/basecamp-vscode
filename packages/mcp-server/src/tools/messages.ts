import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BasecampClient } from "../api/client.js";
import type { Message, MessageBoard } from "../api/types.js";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function register(server: McpServer, client: BasecampClient): void {
  server.registerTool(
    "list_messages",
    {
      description:
        "List messages from a project's message board with titles, authors, and dates",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
        limit: z
          .number()
          .min(1)
          .max(200)
          .optional()
          .describe("Max messages to return (default 25)"),
      },
    },
    async ({ projectId, limit }) => {
      try {
        const boardUrl = await client.getDockUrl(projectId, "message_board");
        const board = await client.get<MessageBoard>(boardUrl);
        const maxItems = limit ?? 25;
        const messages = await client.getPaginated<Message>(
          board.messages_url,
          maxItems
        );

        if (messages.length === 0) {
          return {
            content: [
              { type: "text", text: "No messages on this message board." },
            ],
          };
        }

        const lines = messages.map((m) => {
          const date = new Date(m.created_at).toISOString().slice(0, 10);
          return `- **${m.subject}** (ID: ${m.id})\n  By ${m.creator.name} on ${date} · ${m.comments_count} comment(s)`;
        });

        const text = `# Message Board — ${board.bucket.name} (${messages.length} messages)\n\n${lines.join("\n\n")}`;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list messages: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "read_message",
    {
      description:
        "Read a full message thread including its content and comments",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
        messageId: z.number().describe("Message ID"),
      },
    },
    async ({ projectId, messageId }) => {
      try {
        const message = await client.get<Message>(
          `/buckets/${projectId}/messages/${messageId}.json`
        );

        const parts: string[] = [
          `# ${message.subject}`,
          `By ${message.creator.name} on ${new Date(message.created_at).toISOString().slice(0, 10)}`,
          "",
          stripHtml(message.content),
        ];

        if (message.comments_count > 0) {
          const comments = await client.getPaginated<{
            id: number;
            creator: { name: string };
            created_at: string;
            content: string;
          }>(message.comments_url);

          parts.push("", `---`, `## Comments (${comments.length})`, "");
          for (const c of comments) {
            const date = new Date(c.created_at).toISOString().slice(0, 10);
            parts.push(`**${c.creator.name}** (${date}):`);
            parts.push(stripHtml(c.content));
            parts.push("");
          }
        }

        return { content: [{ type: "text", text: parts.join("\n") }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to read message: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
