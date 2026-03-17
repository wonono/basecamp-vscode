import type { BasecampClient } from "./client";
import type { TodoList, Todo } from "./types";

export async function getTodoLists(
  client: BasecampClient,
  todolistsUrl: string
): Promise<TodoList[]> {
  return client.getPaginated<TodoList>(todolistsUrl);
}

export async function getTodos(
  client: BasecampClient,
  todosUrl: string,
  completed?: boolean
): Promise<Todo[]> {
  const url = completed === true ? `${todosUrl}?completed=true` : todosUrl;
  return client.getPaginated<Todo>(url);
}

export async function completeTodo(
  client: BasecampClient,
  projectId: number,
  todoId: number
): Promise<void> {
  await client.post(`/buckets/${projectId}/todos/${todoId}/completion.json`, {});
}

export async function uncompleteTodo(
  client: BasecampClient,
  projectId: number,
  todoId: number
): Promise<void> {
  await client.delete(`/buckets/${projectId}/todos/${todoId}/completion.json`);
}

export async function createTodo(
  client: BasecampClient,
  projectId: number,
  todoListId: number,
  content: string,
  description?: string,
  assigneeIds?: number[],
  dueOn?: string
): Promise<Todo> {
  const body: Record<string, unknown> = { content };
  if (description) body.description = description;
  if (assigneeIds && assigneeIds.length > 0) body.assignee_ids = assigneeIds;
  if (dueOn) body.due_on = dueOn;
  return client.post<Todo>(
    `/buckets/${projectId}/todolists/${todoListId}/todos.json`,
    body
  );
}
