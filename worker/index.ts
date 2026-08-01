import { AccessError, verifyAccessJwt } from "./access.ts";
import type { Env } from "./env.ts";
import type { AccessIdentity } from "../shared/access.ts";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    let identity: AccessIdentity;
    try {
      identity = await verifyAccessJwt(request, env);
    } catch (err) {
      if (err instanceof AccessError) {
        console.error(`Access denied for ${url.pathname}: ${err.message}`);
      } else {
        console.error(`Access denied for ${url.pathname}:`, err);
      }
      return new Response(null, { status: 401 });
    }

    if (url.pathname === "/api/me") {
      return Response.json({ email: identity.email });
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
