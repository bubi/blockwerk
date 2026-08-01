import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AccessIdentity } from "../shared/access.ts";
import type { Env } from "./env.ts";

export class AccessError extends Error {}

const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

const jwksByTeamDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  let jwks = jwksByTeamDomain.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60 * 1000,
    });
    jwksByTeamDomain.set(teamDomain, jwks);
  }
  return jwks;
}

export async function verifyAccessJwt(request: Request, env: Env): Promise<AccessIdentity> {
  const token = request.headers.get(ACCESS_JWT_HEADER);

  if (!token) {
    if (env.DEV_ACCESS_EMAIL) {
      return { email: env.DEV_ACCESS_EMAIL, sub: "local-dev" };
    }
    throw new AccessError(`Missing ${ACCESS_JWT_HEADER} header`);
  }

  const jwks = getJwks(env.ACCESS_TEAM_DOMAIN);
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
    audience: env.ACCESS_AUD,
  });

  if (typeof payload.email !== "string" || typeof payload.sub !== "string") {
    throw new AccessError("Access token is missing email or sub claim");
  }

  return { email: payload.email, sub: payload.sub };
}
