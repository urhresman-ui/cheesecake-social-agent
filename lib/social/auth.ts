import { NextRequest } from "next/server";

/**
 * Skupni guard za interne API-je in stran /pregled. Token je ločen od
 * kakršnihkoli Instagram/Meta poverilstev - ta aplikacija ne kliče
 * Instagram API-ja, samo pripravlja vsebino za ročno objavo.
 */
export function isAgentAuthorized(request: NextRequest): boolean {
  const token = process.env.SOCIAL_AGENT_TOKEN;
  if (!token) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${token}`) return true;
  const queryToken = request.nextUrl.searchParams.get("token");
  return queryToken === token;
}

export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
