import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BasecampClient } from "../api/client.js";
import type { Person } from "../api/types.js";

export function register(server: McpServer, client: BasecampClient): void {
  server.registerTool(
    "list_people",
    {
      description: "List all people in the Basecamp account",
      inputSchema: {},
    },
    async () => {
      try {
        const people = await client.getPaginated<Person>("/people.json");

        if (people.length === 0) {
          return { content: [{ type: "text", text: "No people found." }] };
        }

        const lines = people.map((p) => {
          const role = [
            p.admin ? "admin" : "",
            p.owner ? "owner" : "",
            p.client ? "client" : "",
          ]
            .filter(Boolean)
            .join(", ");
          const company = p.company ? ` — ${p.company.name}` : "";
          return `- **${p.name}** (ID: ${p.id}) ${p.email_address}${company}${role ? ` [${role}]` : ""}`;
        });

        const text = `# People (${people.length})\n\n${lines.join("\n")}`;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list people: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "my_profile",
    {
      description: "Get the authenticated user's profile information",
      inputSchema: {},
    },
    async () => {
      try {
        const profile = await client.get<Person>("/my/profile.json");
        const lines = [
          `# My Profile`,
          "",
          `- **Name:** ${profile.name}`,
          `- **Email:** ${profile.email_address}`,
          `- **Title:** ${profile.title || "N/A"}`,
          `- **Company:** ${profile.company?.name || "N/A"}`,
          `- **Admin:** ${profile.admin ? "Yes" : "No"}`,
          `- **Time Zone:** ${profile.time_zone || "N/A"}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get profile: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
