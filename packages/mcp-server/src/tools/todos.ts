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
          const notes = t.description
            ? `\n  Notes: ${t.description.replace(/<[^>]*>/g, "").trim()}`
            : "";
          return `- ${check} ${t.content} (ID: ${t.id})${assignees}${due}${notes}`;
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
    "create_todo",
    {
      description: "Create a new to-do in a to-do list",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
        todolistId: z.number().describe("To-do list ID"),
        content: z.string().describe("To-do title"),
        description: z.string().optional().describe("Notes/description (HTML supported)"),
        assignee_ids: z.array(z.number()).optional().describe("Array of person IDs to assign"),
        due_on: z.string().optional().describe("Due date in YYYY-MM-DD format"),
      },
    },
    async ({ projectId, todolistId, content, description, assignee_ids, due_on }) => {
      try {
        const body: Record<string, unknown> = { content };
        if (description) body.description = description;
        if (assignee_ids && assignee_ids.length > 0) body.assignee_ids = assignee_ids;
        if (due_on) body.due_on = due_on;

        const todo = await client.post<{ id: number; content: string }>(
          `/buckets/${projectId}/todolists/${todolistId}/todos.json`,
          body
        );

        return {
          content: [
            {
              type: "text",
              text: `To-do created: "${todo.content}" (ID: ${todo.id})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to create to-do: ${(error as Error).message}`,
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

  server.registerTool(
    "uncomplete_todo",
    {
      description: "Mark a completed to-do as incomplete",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
        todoId: z.number().describe("To-do ID"),
      },
    },
    async ({ projectId, todoId }) => {
      try {
        await client.delete(
          `/buckets/${projectId}/todos/${todoId}/completion.json`
        );
        return {
          content: [
            { type: "text", text: `To-do ${todoId} marked as incomplete.` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to uncomplete to-do: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "assign_todo",
    {
      description: "Update assignees on a to-do",
      inputSchema: {
        projectId: z.number().describe("Basecamp project ID"),
        todoId: z.number().describe("To-do ID"),
        assignee_ids: z.array(z.number()).describe("Array of person IDs to assign (empty to unassign all)"),
      },
    },
    async ({ projectId, todoId, assignee_ids }) => {
      try {
        await client.put(
          `/buckets/${projectId}/todos/${todoId}.json`,
          { assignee_ids }
        );
        const label = assignee_ids.length > 0
          ? `assigned to ${assignee_ids.length} person(s)`
          : "unassigned";
        return {
          content: [
            { type: "text", text: `To-do ${todoId} ${label}.` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to assign to-do: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
