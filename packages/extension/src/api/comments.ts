import type { BasecampClient } from "./client";
import type { Comment } from "./types";

export async function getComments(
  client: BasecampClient,
  commentsUrl: string
): Promise<Comment[]> {
  return client.getPaginated<Comment>(commentsUrl);
}

export async function postComment(
  client: BasecampClient,
  projectId: number,
  recordingId: number,
  content: string
): Promise<Comment> {
  return client.post<Comment>(
    `/buckets/${projectId}/recordings/${recordingId}/comments.json`,
    { content }
  );
}
