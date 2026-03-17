import type { BasecampClient } from "./client";
import type { Message, MessageBoard } from "./types";

export async function getMessageBoard(
  client: BasecampClient,
  boardUrl: string
): Promise<MessageBoard> {
  return client.get<MessageBoard>(boardUrl);
}

export async function getMessages(
  client: BasecampClient,
  messagesUrl: string,
  maxItems?: number
): Promise<Message[]> {
  return client.getPaginated<Message>(messagesUrl, maxItems);
}

export async function getMessage(
  client: BasecampClient,
  projectId: number,
  messageId: number
): Promise<Message> {
  return client.get<Message>(`/buckets/${projectId}/messages/${messageId}.json`);
}

export async function postMessage(
  client: BasecampClient,
  projectId: number,
  messageBoardId: number,
  subject: string,
  content: string
): Promise<Message> {
  return client.post<Message>(
    `/buckets/${projectId}/message_boards/${messageBoardId}/messages.json`,
    { subject, content, status: "active" }
  );
}
