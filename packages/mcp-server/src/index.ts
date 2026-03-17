#!/usr/bin/env node

// Safety net: prevent console.log from corrupting the stdio transport
console.log = (...args: unknown[]) => console.error("[LOG]", ...args);

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./auth.js";
import { BasecampClient } from "./api/client.js";
import { register as registerProjects } from "./tools/projects.js";
import { register as registerCampfires } from "./tools/campfires.js";
import { register as registerMessages } from "./tools/messages.js";
import { register as registerTodos } from "./tools/todos.js";
import { register as registerComments } from "./tools/comments.js";
import { register as registerPeople } from "./tools/people.js";

async function main() {
  const config = loadConfig();
  const client = new BasecampClient(config);

  const server = new McpServer({
    name: "basecamp",
    version: "1.0.0",
  });

  registerProjects(server, client);
  registerCampfires(server, client);
  registerMessages(server, client);
  registerTodos(server, client);
  registerComments(server, client);
  registerPeople(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Basecamp MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
