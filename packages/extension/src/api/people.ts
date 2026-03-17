import type { BasecampClient } from "./client";
import type { Person } from "./types";

export async function getPeople(client: BasecampClient): Promise<Person[]> {
  return client.getPaginated<Person>("/people.json");
}

export async function getProfile(client: BasecampClient): Promise<Person> {
  return client.get<Person>("/my/profile.json");
}
