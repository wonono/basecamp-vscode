import type { BasecampClient } from "./client";
import type { Project } from "./types";

export async function getProjects(client: BasecampClient): Promise<Project[]> {
  return client.getPaginated<Project>("/projects.json");
}

export async function getProject(client: BasecampClient, id: number): Promise<Project> {
  return client.get<Project>(`/projects/${id}.json`);
}
