import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWK } from "jose";
import { verifyAccessJwt } from "./access.ts";
import type { Env } from "./env.ts";
import worker from "./index.ts";

interface TestKey {
  kid: string;
  privateKey: CryptoKey;
  jwk: JWK;
}

async function makeKey(kid: string): Promise<TestKey> {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  return { kid, privateKey, jwk: { ...jwk, kid, alg: "ES256", use: "sig" } };
}

function jwksResponse(keys: TestKey[]) {
  return new Response(JSON.stringify({ keys: keys.map((k) => k.jwk) }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function signToken(
  key: TestKey,
  claims: { iss: string; aud: string; email?: string; sub?: string; exp?: number },
) {
  let jwt = new SignJWT({ email: claims.email ?? "person@example.com" })
    .setProtectedHeader({ alg: "ES256", kid: key.kid })
    .setIssuedAt()
    .setIssuer(claims.iss)
    .setAudience(claims.aud)
    .setSubject(claims.sub ?? "user-123");
  jwt = claims.exp !== undefined ? jwt.setExpirationTime(claims.exp) : jwt.setExpirationTime("1h");
  return jwt.sign(key.privateKey);
}

function makeEnv(overrides: Partial<Env> & { ACCESS_TEAM_DOMAIN: string; ACCESS_AUD: string }): Env {
  return {
    ASSETS: undefined as unknown as Fetcher,
    DB: undefined as unknown as D1Database,
    ...overrides,
  };
}

function makeRequest(token?: string) {
  const headers = new Headers();
  if (token) headers.set("Cf-Access-Jwt-Assertion", token);
  return new Request<unknown, IncomingRequestCfProperties<unknown>>("https://worker.example/api/me", {
    headers,
  });
}

describe("verifyAccessJwt", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("accepts a valid token and extracts email and sub", async () => {
    const domain = "valid.example.cloudflareaccess.com";
    const key = await makeKey("k1");
    fetchMock.mockResolvedValue(jwksResponse([key]));
    const token = await signToken(key, {
      iss: `https://${domain}`,
      aud: "aud-1",
      email: "person@example.com",
      sub: "user-123",
    });

    const identity = await verifyAccessJwt(
      makeRequest(token),
      makeEnv({ ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: "aud-1" }),
    );

    expect(identity).toEqual({ email: "person@example.com", sub: "user-123" });
  });

  it("rejects an expired token", async () => {
    const domain = "expired.example.cloudflareaccess.com";
    const key = await makeKey("k1");
    fetchMock.mockResolvedValue(jwksResponse([key]));
    const token = await signToken(key, {
      iss: `https://${domain}`,
      aud: "aud-1",
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await expect(
      verifyAccessJwt(makeRequest(token), makeEnv({ ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: "aud-1" })),
    ).rejects.toThrow();
  });

  it("rejects a token with the wrong audience", async () => {
    const domain = "wrong-aud.example.cloudflareaccess.com";
    const key = await makeKey("k1");
    fetchMock.mockResolvedValue(jwksResponse([key]));
    const token = await signToken(key, { iss: `https://${domain}`, aud: "some-other-aud" });

    await expect(
      verifyAccessJwt(makeRequest(token), makeEnv({ ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: "aud-1" })),
    ).rejects.toThrow();
  });

  it("rejects a token with the wrong issuer", async () => {
    const domain = "wrong-iss.example.cloudflareaccess.com";
    const key = await makeKey("k1");
    fetchMock.mockResolvedValue(jwksResponse([key]));
    const token = await signToken(key, { iss: "https://not-the-team-domain.example.com", aud: "aud-1" });

    await expect(
      verifyAccessJwt(makeRequest(token), makeEnv({ ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: "aud-1" })),
    ).rejects.toThrow();
  });

  it("rejects a request with no Access header and no dev bypass configured", async () => {
    await expect(
      verifyAccessJwt(
        makeRequest(),
        makeEnv({ ACCESS_TEAM_DOMAIN: "missing.example.cloudflareaccess.com", ACCESS_AUD: "aud-1" }),
      ),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a token with a tampered signature", async () => {
    const domain = "tampered.example.cloudflareaccess.com";
    const key = await makeKey("k1");
    fetchMock.mockResolvedValue(jwksResponse([key]));
    const token = await signToken(key, { iss: `https://${domain}`, aud: "aud-1" });
    const [header, payload, signature] = token.split(".");
    const tamperedSignature = signature!.slice(0, -2) + (signature!.slice(-2) === "AA" ? "BB" : "AA");
    const tampered = `${header}.${payload}.${tamperedSignature}`;

    await expect(
      verifyAccessJwt(makeRequest(tampered), makeEnv({ ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: "aud-1" })),
    ).rejects.toThrow();
  });

  it("refetches the JWKS exactly once for an unknown key ID", async () => {
    const domain = "rotation.example.cloudflareaccess.com";
    const keyA = await makeKey("kid-a");
    const keyB = await makeKey("kid-b");
    fetchMock.mockResolvedValueOnce(jwksResponse([keyA])).mockResolvedValue(jwksResponse([keyA, keyB]));
    const env = makeEnv({ ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: "aud-1" });

    const tokenA = await signToken(keyA, { iss: `https://${domain}`, aud: "aud-1" });
    const identityA = await verifyAccessJwt(makeRequest(tokenA), env);
    expect(identityA.email).toBe("person@example.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Bypass the 30s refetch cooldown without touching real timers/AbortSignal.
    vi.setSystemTime(Date.now() + 31_000);

    const tokenB = await signToken(keyB, { iss: `https://${domain}`, aud: "aud-1" });
    const identityB = await verifyAccessJwt(makeRequest(tokenB), env);
    expect(identityB.email).toBe("person@example.com");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("worker fetch handler", () => {
  const domain = "handler.example.cloudflareaccess.com";
  const aud = "aud-1";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 with no body when the Access header is missing", async () => {
    const env = makeEnv({ ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: aud });
    const response = await worker.fetch(makeRequest(), env);

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
  });

  it("returns the identity's email from /api/me for a valid token", async () => {
    const key = await makeKey("k1");
    vi.mocked(fetch).mockResolvedValue(jwksResponse([key]));
    const token = await signToken(key, { iss: `https://${domain}`, aud, email: "team@example.com" });
    const env = makeEnv({ ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: aud });

    const response = await worker.fetch(makeRequest(token), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: "team@example.com" });
  });

  it("only applies the dev bypass when the Access header is absent", async () => {
    const key = await makeKey("k1");
    vi.mocked(fetch).mockResolvedValue(jwksResponse([key]));
    const badToken = await signToken(key, { iss: "https://not-the-team-domain.example.com", aud });
    const env = makeEnv({ ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: aud, DEV_ACCESS_EMAIL: "dev@example.com" });

    const response = await worker.fetch(makeRequest(badToken), env);

    expect(response.status).toBe(401);
  });
});
