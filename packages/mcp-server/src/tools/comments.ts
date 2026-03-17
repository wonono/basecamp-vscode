import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BasecampClient } from "../api/client.js";
import type { Comment } from "../api/types.js";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function register(server: McpServer, client: BasecampClient): void {
  server.registerTool(
    "read_comments",
    {
      description:
        "Read comments on any Basecamp recording (message, to-do, etc.)",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
        recordingId: z
          .number()
          .describe("Recording ID (message ID, to-do ID, etc.)"),
      },
    },
    async ({ projectId, recordingId }) => {
      try {
        const comments = await client.getPaginated<Comment>(
          `/buckets/${projectId}/recordings/${recordingId}/comments.json`
        );

        if (comments.length === 0) {
          return {
            content: [
              { type: "text", text: "No comments on this recording." },
            ],
          };
        }

        const lines = comments.map((c) => {
          const date = new Date(c.created_at).toISOString().slice(0, 10);
          return `**${c.creator.name}** (${date}):\n${stripHtml(c.content)}`;
        });

        const text = `# Comments (${comments.length})\n\n${lines.join("\n\n")}`;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to read comments: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "post_comment",
    {
      description: "Post a comment on any Basecamp recording",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
        recordingId: z
          .number()
          .describe("Recording ID (message ID, to-do ID, etc.)"),
        content: z.string().min(1).describe("Comment text (HTML supported)"),
      },
    },
    async ({ projectId, recordingId, content }) => {
      try {
        await client.post(
          `/buckets/${projectId}/recordings/${recordingId}/comments.json`,
          { content }
        );
        return {
          content: [{ type: "text", text: "Comment posted successfully." }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to post comment: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
