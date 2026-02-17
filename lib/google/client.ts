import { google, Auth } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

let cachedOAuth2Client: Auth.OAuth2Client | null = null;

/**
 * Returns an OAuth2 client authorized with the refresh token from env.
 * Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 */
export function getGoogleAuth(): Auth.OAuth2Client {
  if (cachedOAuth2Client) return cachedOAuth2Client;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Google OAuth env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN"
    );
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob");
  oauth2.setCredentials({ refresh_token: refreshToken });
  oauth2.scopes = SCOPES;
  cachedOAuth2Client = oauth2;
  return oauth2;
}

export function isGoogleConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}
