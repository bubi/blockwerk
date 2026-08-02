import { ZodError } from "zod";
import { calendarParamsSchema } from "../shared/schemas.ts";
import type { CalendarResponse } from "../shared/api.ts";
import type { AccessIdentity } from "../shared/access.ts";
import type { Env } from "./env.ts";
import {
  BadRequestError,
  HttpError,
  MethodNotAllowedError,
  NotFoundError,
  ValidationError,
  zodToFieldIssues,
} from "./errors.ts";
import {
  deleteEntity,
  getCalendar,
  getMirror,
  getPageDetail,
  getSpaces,
  patchBlock,
  patchItem,
  patchPage,
  patchSpace,
  patchTemplate,
  putBlock,
  putItem,
  putPage,
  putSpace,
  putTemplate,
  type EntityName,
} from "./handlers.ts";

const ENTITY_NAMES = ["spaces", "pages", "blocks", "items", "templates"] as const;
type UrlEntity = (typeof ENTITY_NAMES)[number];

const URL_ENTITY_TO_NAME: Record<UrlEntity, EntityName> = {
  spaces: "space",
  pages: "page",
  blocks: "block",
  items: "item",
  templates: "template",
};

function isUrlEntity(value: string | undefined): value is UrlEntity {
  return value !== undefined && (ENTITY_NAMES as readonly string[]).includes(value);
}

function assertId(segment: string | undefined): string {
  if (segment === undefined || segment.length === 0 || segment.length > 128) {
    throw new ValidationError([{ path: "id", code: "invalid_id" }], "Invalid entity id");
  }
  return segment;
}

function ok(data: unknown): Response {
  return Response.json(data, { status: 200 });
}

function jsonError(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

function handleError(err: unknown): Response {
  if (err instanceof MethodNotAllowedError) {
    return new Response(JSON.stringify(err.body), {
      status: err.status,
      headers: { "content-type": "application/json", Allow: err.allow },
    });
  }
  if (err instanceof HttpError) return jsonError(err.status, err.body);
  if (err instanceof ZodError) {
    return jsonError(400, {
      error: { code: "validation", message: "Invalid input", issues: zodToFieldIssues(err) },
    });
  }
  console.error(err);
  return jsonError(500, { error: { code: "internal" } });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BadRequestError("Request body is not valid JSON");
  }
}

async function getCalendarFromParams(db: D1Database, params: URLSearchParams): Promise<CalendarResponse> {
  const parsed = calendarParamsSchema.safeParse({ from: params.get("from"), to: params.get("to") });
  if (!parsed.success) throw new ValidationError(zodToFieldIssues(parsed.error));
  return getCalendar(db, parsed.data.from, parsed.data.to);
}

function putEntity(db: D1Database, entity: EntityName, id: string, body: unknown, email: string) {
  const now = Date.now();
  switch (entity) {
    case "space":
      return putSpace(db, id, body, now, email);
    case "page":
      return putPage(db, id, body, now, email);
    case "block":
      return putBlock(db, id, body, now, email);
    case "item":
      return putItem(db, id, body, now, email);
    case "template":
      return putTemplate(db, id, body, now, email);
  }
}

function patchEntity(db: D1Database, entity: EntityName, id: string, body: unknown, email: string) {
  const now = Date.now();
  switch (entity) {
    case "space":
      return patchSpace(db, id, body, now, email);
    case "page":
      return patchPage(db, id, body, now, email);
    case "block":
      return patchBlock(db, id, body, now, email);
    case "item":
      return patchItem(db, id, body, now, email);
    case "template":
      return patchTemplate(db, id, body, now, email);
  }
}

export async function handleApiRequest(
  request: Request,
  env: Env,
  identity: AccessIdentity,
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const [api, a, b, c] = url.pathname.split("/").filter(Boolean);

  try {
    if (api !== "api") throw new NotFoundError();

    if (a === "spaces" && !b) {
      if (method === "GET") return ok(await getSpaces(env.DB));
      throw new MethodNotAllowedError("GET");
    }
    if (a === "calendar" && !b) {
      if (method === "GET") return ok(await getCalendarFromParams(env.DB, url.searchParams));
      throw new MethodNotAllowedError("GET");
    }
    if (a === "spaces" && b && c === "mirror") {
      if (method === "GET") return ok(await getMirror(env.DB, assertId(b)));
      throw new MethodNotAllowedError("GET");
    }
    if (b && !c && isUrlEntity(a)) {
      const id = assertId(b);
      const email = identity.email;
      if (a === "pages" && method === "GET") return ok(await getPageDetail(env.DB, id));
      if (method === "PUT") return ok(await putEntity(env.DB, URL_ENTITY_TO_NAME[a], id, await readJson(request), email));
      if (method === "PATCH") return ok(await patchEntity(env.DB, URL_ENTITY_TO_NAME[a], id, await readJson(request), email));
      if (method === "DELETE") {
        const deleted = await deleteEntity(env.DB, URL_ENTITY_TO_NAME[a], id, email);
        if (!deleted) throw new NotFoundError();
        return new Response(null, { status: 204 });
      }
      throw new MethodNotAllowedError("PUT, PATCH, DELETE");
    }

    throw new NotFoundError();
  } catch (err) {
    return handleError(err);
  }
}
