import type { BasecampClient } from "./client";
import type { Campfire, CampfireLine } from "./types";

export async function getCampfire(client: BasecampClient, campfireUrl: string): Promise<Campfire> {
  return client.get<Campfire>(campfireUrl);
}

export async function getLines(
  client: BasecampClient,
  linesUrl: string,
  maxItems?: number
): Promise<CampfireLine[]> {
  return client.getPaginated<CampfireLine>(linesUrl, maxItems);
}

export async function getLinesWithEtag(
  client: BasecampClient,
  linesUrl: string
): Promise<{ data: CampfireLine[]; changed: boolean }> {
  return client.getWithEtag<CampfireLine[]>(linesUrl);
}

export async function postLine(
  client: BasecampClient,
  linesUrl: string,
  content: string
): Promise<CampfireLine> {
  return client.post<CampfireLine>(linesUrl, { content });
}
