import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BasecampClient } from "../api/client.js";
import type { TodoList, Todo } from "../api/types.js";

export function register(server: McpServer, client: BasecampClient): void {
  server.registerTool(
    "list_todo_lists",
    {
      description: "List all to-do lists from a project with completion ratios",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
      },
    },
    async ({ projectId }) => {
      try {
        const todosetUrl = await client.getDockUrl(projectId, "todoset");
        const todoset = await client.get<{ todolists_url: string }>(todosetUrl);
        const lists = await client.getPaginated<TodoList>(
          todoset.todolists_url
        );

        if (lists.length === 0) {
          return {
            content: [
              { type: "text", text: "No to-do lists in this project." },
            ],
          };
        }

        const lines = lists.map((l) => {
          const status = l.completed ? "[DONE]" : `[${l.completed_ratio}]`;
          return `- ${status} **${l.name}** (ID: ${l.id})`;
        });

        const text = `# To-do Lists (${lists.length})\n\n${lines.join("\n")}`;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list to-do lists: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "list_todos",
    {
      description: "List to-dos from a to-do list with status and assignees",
      inputSchema: {
        todolistId: z.number().describe("To-do list ID"),
        completed: z
          .boolean()
          .optional()
          .describe("Filter by completion status (omit for active only)"),
      },
    },
    async ({ todolistId, completed }) => {
      try {
        let url = `/todolists/${todolistId}/todos.json`;
        if (completed === true) {
          url += "?completed=true";
        }
        const todos = await client.getPaginated<Todo>(url);

        if (todos.length === 0) {
          return {
            content: [
              { type: "text", text: "No to-dos in this list." },
            ],
          };
        }

        const lines = todos.map((t) => {
          const check = t.completed ? "[x]" : "[ ]";
          const assignees =
            t.assignees.length > 0
              ? ` — assigned to: ${t.assignees.map((a) => a.name).join(", ")}`
              : "";
          const due = t.due_on ? ` (due: ${t.due_on})` : "";
          return `- ${check} ${t.content} (ID: ${t.id})${assignees}${due}`;
        });

        const text = `# To-dos (${todos.length})\n\n${lines.join("\n")}`;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list to-dos: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "complete_todo",
    {
      description: "Mark a to-do as complete",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
        todoId: z.number().describe("To-do ID"),
      },
    },
    async ({ projectId, todoId }) => {
      try {
        await client.post(
          `/buckets/${projectId}/todos/${todoId}/completion.json`,
          {}
        );
        return {
          content: [
            { type: "text", text: `To-do ${todoId} marked as complete.` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to complete to-do: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
