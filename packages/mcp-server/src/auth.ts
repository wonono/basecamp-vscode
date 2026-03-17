export interface BasecampConfig {
  accountId: string;
  accessToken: string;
}

export function loadConfig(): BasecampConfig {
  const accessToken = process.env.BASECAMP_ACCESS_TOKEN;
  const accountId = process.env.BASECAMP_ACCOUNT_ID;

  if (!accessToken) {
    console.error(
      "Error: BASECAMP_ACCESS_TOKEN environment variable is required.\n" +
      "Get a token via OAuth at https://launchpad.37signals.com/integrations"
    );
    process.exit(1);
  }

  if (!accountId) {
    console.error(
      "Error: BASECAMP_ACCOUNT_ID environment variable is required.\n" +
      "Find your account ID in the Basecamp URL: https://3.basecamp.com/{ACCOUNT_ID}/..."
    );
    process.exit(1);
  }

  return { accountId, accessToken };
}
