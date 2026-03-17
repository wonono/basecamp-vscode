import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BasecampClient } from "../api/client.js";
import type { Project } from "../api/types.js";

export function register(server: McpServer, client: BasecampClient): void {
  server.registerTool(
    "list_projects",
    {
      description:
        "List all Basecamp projects with their names, IDs, and available tools (dock items)",
      inputSchema: {},
    },
    async () => {
      try {
        const projects = await client.getPaginated<Project>("/projects.json");

        if (projects.length === 0) {
          return { content: [{ type: "text", text: "No projects found." }] };
        }

        const lines = projects.map((p) => {
          const enabledDocks = p.dock
            .filter((d) => d.enabled)
            .map((d) => d.name)
            .join(", ");
          return `- **${p.name}** (ID: ${p.id}) — ${p.status}\n  Tools: ${enabledDocks || "none"}`;
        });

        const text = `# Basecamp Projects (${projects.length})\n\n${lines.join("\n\n")}`;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list projects: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
