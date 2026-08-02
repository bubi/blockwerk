import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import worker from "../index.ts";
import type { Env } from "../env.ts";
import { countingD1 } from "./testing/counting-d1.ts";
import { getTestDb } from "./testing/get-test-db.ts";
import { createBlock, createItem, createPage, createSpace, createTemplate, loadPageBlocks } from "./index.ts";
import type { CalendarResponse, ItemWriteResponse, MirrorTask, PageResponse, SpacesResponse } from "../../shared/api.ts";
import { insertPositionBetween } from "../../src/domain/position.ts";

const NOW = 1_700_000_000_000;
const DEV_EMAIL = "tester@example.com";

interface ErrorBody {
  error: { code: string; message?: string; issues?: { path: string; code: string }[] };
}

function makeEnv(db: D1Database): Env {
  return { ...env, DB: db as unknown as D1Database, DEV_ACCESS_EMAIL: DEV_EMAIL };
}

function apiRequest(
  method: string,
  path: string,
  body?: unknown,
): Request<unknown, IncomingRequestCfProperties<unknown>> {
  const init: RequestInit<IncomingRequestCfProperties<unknown>> = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request<unknown, IncomingRequestCfProperties<unknown>>(`https://blockwerk.test${path}`, init);
}

async function call(method: string, path: string, body?: unknown, db?: D1Database): Promise<Response> {
  const testDb = db ?? (await getTestDb());
  return worker.fetch(apiRequest(method, path, body), makeEnv(testDb));
}

async function json<T = unknown>(method: string, path: string, body?: unknown, db?: D1Database) {
  const response = await call(method, path, body, db);
  return { status: response.status, body: (await response.json()) as T };
}

async function seedSpace(db: D1Database, id: string, kind: "person" | "topic" = "topic") {
  return createSpace(db, { id, name: id, kind, short: id.slice(0, 2).toUpperCase() }, NOW);
}

async function seedPage(db: D1Database, id: string, spaceId: string) {
  return createPage(db, { id, spaceId, title: id }, NOW);
}

async function seedBlock(db: D1Database, id: string, pageId: string) {
  return createBlock(db, { id, pageId, templateId: null, title: id, date: "2026-08-01" }, NOW);
}

describe("GET /api/spaces", () => {
  it("returns spaces with nested pages plus templates, ordered by id", async () => {
    const db = await getTestDb();
    await seedSpace(db, "list-b", "person");
    await seedPage(db, "list-b-page", "list-b");
    await seedSpace(db, "list-a", "topic");
    await createTemplate(db, { id: "list-tpl", label: "Meeting", hue: "steel", seed: [] }, NOW);

    const { status, body } = await json<SpacesResponse>("GET", "/api/spaces");

    expect(status).toBe(200);
    expect(body.spaces.map((space) => space.id)).toEqual(["list-a", "list-b"]);
    expect(body.spaces[0]).toMatchObject({ id: "list-a", pages: [] });
    expect(body.spaces[1]).toMatchObject({
      id: "list-b",
      pages: [expect.objectContaining({ id: "list-b-page", spaceId: "list-b" })],
    });
    expect(body.templates).toEqual([expect.objectContaining({ id: "list-tpl" })]);
  });
});

describe("GET /api/pages/:id", () => {
  it("returns the page with blocks, items grouped notes+refs → tasks → events (chronological)", async () => {
    const db = await getTestDb();
    await seedSpace(db, "order-space");
    await seedPage(db, "order-page", "order-space");
    await seedBlock(db, "order-block", "order-page");
    // Inserted deliberately out of display order.
    await createItem(db, { id: "o-event-late", blockId: "order-block", position: 100, kind: "event", text: "late", eventDate: "2026-08-10", eventTime: "09:00" }, NOW);
    await createItem(db, { id: "o-task-z", blockId: "order-block", position: 5000, kind: "task", text: "z", dueDate: null, assigneeSpaceId: null }, NOW);
    await createItem(db, { id: "o-ref", blockId: "order-block", position: 200, kind: "ref", refBlockId: null }, NOW);
    await createItem(db, { id: "o-note-b", blockId: "order-block", position: 2000, kind: "note", text: "b", heading: null }, NOW);
    await createItem(db, { id: "o-event-early", blockId: "order-block", position: 300, kind: "event", text: "early", eventDate: "2026-08-09", eventTime: "10:00" }, NOW);
    await createItem(db, { id: "o-note-a", blockId: "order-block", position: 1000, kind: "note", text: "a", heading: 1 }, NOW);
    await createItem(db, { id: "o-task-a", blockId: "order-block", position: 4000, kind: "task", text: "a", dueDate: null, assigneeSpaceId: null }, NOW);

    const { status, body } = await json<PageResponse>("GET", "/api/pages/order-page");

    expect(status).toBe(200);
    expect(body.page.id).toBe("order-page");
    expect(body.blocks[0]?.items.map((item) => item.id)).toEqual([
      "o-ref",
      "o-note-a",
      "o-note-b",
      "o-task-a",
      "o-task-z",
      "o-event-early",
      "o-event-late",
    ]);
  });

  it("returns 404 for a missing page", async () => {
    const { status, body } = await json<ErrorBody>("GET", "/api/pages/no-such-page");
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("GET /api/spaces/:id/mirror", () => {
  it("returns a person's open assigned tasks with block context, excluding done tasks", async () => {
    const db = await getTestDb();
    await seedSpace(db, "mir-person", "person");
    await seedSpace(db, "mir-other", "person");
    await seedSpace(db, "mir-topic");
    await seedPage(db, "mir-page", "mir-topic");
    await seedBlock(db, "mir-block", "mir-page");
    await createItem(db, { id: "mir-open", blockId: "mir-block", position: 1000, kind: "task", text: "open", dueDate: null, assigneeSpaceId: "mir-person" }, NOW);
    await createItem(db, { id: "mir-done", blockId: "mir-block", position: 2000, kind: "task", text: "done", dueDate: null, assigneeSpaceId: "mir-person", done: true }, NOW);
    await createItem(db, { id: "mir-other", blockId: "mir-block", position: 3000, kind: "task", text: "other", dueDate: null, assigneeSpaceId: "mir-other" }, NOW);

    const { status, body } = await json<MirrorTask[]>("GET", "/api/spaces/mir-person/mirror");

    expect(status).toBe(200);
    expect(body).toEqual([
      {
        item: expect.objectContaining({ id: "mir-open", done: false, assigneeSpaceId: "mir-person" }),
        block: { id: "mir-block", pageId: "mir-page", title: "mir-block", date: "2026-08-01" },
      },
    ]);
  });

  it("returns 404 for a missing space", async () => {
    const { status, body } = await json<ErrorBody>("GET", "/api/spaces/no-such-space/mirror");
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("GET /api/calendar", () => {
  it("returns due tasks and events inside the window, without blocks", async () => {
    const db = await getTestDb();
    await seedSpace(db, "cal-space");
    await seedPage(db, "cal-page", "cal-space");
    await createBlock(db, { id: "cal-block", pageId: "cal-page", templateId: null, title: "cal-block", date: "2026-12-10" }, NOW);
    await createItem(db, { id: "cal-task", blockId: "cal-block", position: 1000, kind: "task", text: "t", dueDate: "2026-12-11", assigneeSpaceId: null }, NOW);
    await createItem(db, { id: "cal-event", blockId: "cal-block", position: 2000, kind: "event", text: "e", eventDate: "2026-12-10", eventTime: "14:00" }, NOW);
    await createBlock(db, { id: "cal-other-block", pageId: "cal-page", templateId: null, title: "other", date: "2026-12-01" }, NOW);

    const { status, body } = await json<CalendarResponse>("GET", "/api/calendar?from=2026-12-10&to=2026-12-11");

    expect(status).toBe(200);
    expect(Object.hasOwn(body, "blocks")).toBe(false);
    expect(body.dueTasks.map((task) => task.id)).toEqual(["cal-task"]);
    expect(body.events.map((event) => event.id)).toEqual(["cal-event"]);
  });

  it("rejects a missing, malformed, or reversed window", async () => {
    const missing = await json<ErrorBody>("GET", "/api/calendar");
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("validation");

    const malformed = await json<ErrorBody>("GET", "/api/calendar?from=2026-13-01&to=2026-08-11");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.issues).toEqual(expect.arrayContaining([{ path: "from", code: "invalid_date" }]));

    const reversed = await json<ErrorBody>("GET", "/api/calendar?from=2026-08-11&to=2026-08-10");
    expect(reversed.status).toBe(400);
    expect(reversed.body.error.issues).toEqual([{ path: "from", code: "from_after_to" }]);
  });
});

describe("PUT /api/:entity/:id", () => {
  it("creates on first PUT and replaces on a repeated PUT — exactly one row", async () => {
    const db = await getTestDb();
    const body = { name: "Put Space", kind: "topic", short: "PU" };

    const first = await json<unknown>("PUT", "/api/spaces/put-space", body);
    expect(first.status).toBe(200);
    const second = await json<unknown>("PUT", "/api/spaces/put-space", { ...body, name: "Put Space Renamed" });
    expect(second.status).toBe(200);

    const count = await db
      .prepare("SELECT COUNT(*) AS n FROM spaces WHERE id = ?")
      .bind("put-space")
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("rejects invalid input with a 400 and a machine-readable field issue", async () => {
    const { status, body } = await json<ErrorBody>("PUT", "/api/spaces/bad-kind", {
      name: "X",
      kind: "group",
      short: "X",
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("validation");
    expect(body.error.issues).toEqual([{ path: "kind", code: "invalid_value" }]);
  });

  it("rejects a reference to a missing parent instead of failing in the db", async () => {
    const { status, body } = await json<ErrorBody>("PUT", "/api/pages/ghost-page", {
      spaceId: "no-such-space",
      title: "Ghost",
    });
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([{ path: "spaceId", code: "not_found" }]);
  });

  it("rejects a block referencing a missing template", async () => {
    const db = await getTestDb();
    await seedSpace(db, "ref-space");
    await seedPage(db, "ref-page", "ref-space");

    const { status, body } = await json<ErrorBody>("PUT", "/api/blocks/ref-block", {
      pageId: "ref-page",
      templateId: "no-such-template",
      title: "B",
      date: "2026-08-01",
    });
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([{ path: "templateId", code: "not_found" }]);
  });

  it("creates a full chain and refuses to move an item to another block or kind", async () => {
    const db = await getTestDb();
    await seedSpace(db, "chain-space");
    await seedPage(db, "chain-page", "chain-space");
    await seedBlock(db, "chain-block", "chain-page");

    const put = await json<unknown>("PUT", "/api/items/chain-item", {
      blockId: "chain-block",
      kind: "note",
      position: 1000,
      text: "hello",
      heading: null,
    });
    expect(put.status).toBe(200);

    const moved = await json<ErrorBody>("PUT", "/api/items/chain-item", {
      blockId: "somewhere-else",
      kind: "note",
      position: 1000,
      text: "hello",
      heading: null,
    });
    expect(moved.status).toBe(400);
    expect(moved.body.error.issues).toEqual([{ path: "blockId", code: "immutable" }]);

    const retyped = await json<ErrorBody>("PUT", "/api/items/chain-item", {
      blockId: "chain-block",
      kind: "task",
      position: 1000,
      text: "hello",
      heading: null,
    });
    expect(retyped.status).toBe(400);
    expect(retyped.body.error.issues).toEqual([{ path: "kind", code: "immutable" }]);

    const read = await json<unknown>("GET", "/api/pages/chain-page");
    expect(read.status).toBe(200);
  });
});

describe("PATCH /api/:entity/:id", () => {
  it("applies a partial change and returns 404 for a missing row", async () => {
    const db = await getTestDb();
    await seedSpace(db, "patch-space");
    await seedPage(db, "patch-page", "patch-space");
    await seedBlock(db, "patch-block", "patch-page");
    await createItem(db, { id: "patch-item", blockId: "patch-block", position: 1000, kind: "task", text: "t", dueDate: null, assigneeSpaceId: null }, NOW);

    const patched = await json<ItemWriteResponse>("PATCH", "/api/items/patch-item", { done: true });
    expect(patched.status).toBe(200);
    expect(patched.body.row.done).toBe(true);
    expect(patched.body.respaced).toBeNull();

    const missing = await json<ErrorBody>("PATCH", "/api/items/no-such-item", { done: true });
    expect(missing.status).toBe(404);
  });

  it("checks cross-field rules against the stored kind", async () => {
    const db = await getTestDb();
    await seedSpace(db, "ck-space");
    await seedPage(db, "ck-page", "ck-space");
    await seedBlock(db, "ck-block", "ck-page");
    await createItem(db, { id: "ck-task", blockId: "ck-block", position: 1000, kind: "task", text: "t", dueDate: null, assigneeSpaceId: null }, NOW);

    const { status, body } = await json<ErrorBody>("PATCH", "/api/items/ck-task", { heading: 1 });
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([{ path: "heading", code: "heading_only_on_note" }]);
  });

  it("rejects assigning a task to a missing space", async () => {
    const db = await getTestDb();
    await seedSpace(db, "as-space");
    await seedPage(db, "as-page", "as-space");
    await seedBlock(db, "as-block", "as-page");
    await createItem(db, { id: "as-task", blockId: "as-block", position: 1000, kind: "task", text: "t", dueDate: null, assigneeSpaceId: null }, NOW);

    const { status, body } = await json<ErrorBody>("PATCH", "/api/items/as-task", {
      assigneeSpaceId: "no-such-person",
    });
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([{ path: "assigneeSpaceId", code: "not_found" }]);
  });
});

describe("DELETE /api/:entity/:id", () => {
  it("deleting a space cascades its ownership chain and only nulls the assignee elsewhere", async () => {
    const db = await getTestDb();

    await seedSpace(db, "gone-space");
    await seedPage(db, "gone-page", "gone-space");
    await seedBlock(db, "gone-block", "gone-page");
    await createItem(db, { id: "gone-note", blockId: "gone-block", position: 1000, kind: "note", text: "n", heading: null }, NOW);

    await seedSpace(db, "kept-space");
    await seedPage(db, "kept-page", "kept-space");
    await seedBlock(db, "kept-block", "kept-page");
    await createItem(db, { id: "kept-task", blockId: "kept-block", position: 1000, kind: "task", text: "was gone's", dueDate: null, assigneeSpaceId: "gone-space" }, NOW);

    const deleted = await call("DELETE", "/api/spaces/gone-space");
    expect(deleted.status).toBe(204);

    const gonePage = await json<ErrorBody>("GET", "/api/pages/gone-page");
    expect(gonePage.status).toBe(404);

    const kept = await json<PageResponse>("GET", "/api/pages/kept-page");
    expect(kept.status).toBe(200);
    const keptTask = kept.body.blocks[0]?.items[0];
    expect(keptTask).toMatchObject({ id: "kept-task", kind: "task", assigneeSpaceId: null });

    const mirror = await json<ErrorBody>("GET", "/api/spaces/gone-space/mirror");
    expect(mirror.status).toBe(404);
  });

  it("returns 404 when deleting a missing row", async () => {
    const { status, body } = await json<ErrorBody>("DELETE", "/api/spaces/never-existed");
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("deleting a template leaves blocks intact, only un-templating them", async () => {
    const db = await getTestDb();
    await createTemplate(db, { id: "doom-tpl", label: "Doomed", hue: "steel", seed: [] }, NOW);
    await seedSpace(db, "ut-space");
    await seedPage(db, "ut-page", "ut-space");
    await db
      .prepare("INSERT INTO blocks (id, page_id, template_id, title, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind("ut-block", "ut-page", "doom-tpl", "B", "2026-08-01", NOW, NOW)
      .run();

    const deleted = await call("DELETE", "/api/templates/doom-tpl");
    expect(deleted.status).toBe(204);

    const page = await json<PageResponse>("GET", "/api/pages/ut-page");
    expect(page.body.blocks[0]).toMatchObject({ id: "ut-block", templateId: null, title: "B" });
  });

  it("deleting a block keeps ref items, only nulling their target", async () => {
    const db = await getTestDb();
    await seedSpace(db, "refd-space");
    await seedPage(db, "refd-page", "refd-space");
    await seedBlock(db, "refd-target", "refd-page");
    await seedBlock(db, "refd-source", "refd-page");
    await createItem(db, { id: "refd-ref", blockId: "refd-source", position: 1000, kind: "ref", refBlockId: "refd-target" }, NOW);

    const deleted = await call("DELETE", "/api/blocks/refd-target");
    expect(deleted.status).toBe(204);

    const page = await json<PageResponse>("GET", "/api/pages/refd-page");
    const source = page.body.blocks.find((block) => block.id === "refd-source");
    expect(source?.items[0]).toMatchObject({ id: "refd-ref", kind: "ref", refBlockId: null });
  });
});

describe("routing and methods", () => {
  it("returns 404 for an unknown path and 405 for a known path with a wrong method", async () => {
    const unknown = await json<ErrorBody>("GET", "/api/nonsense");
    expect(unknown.status).toBe(404);

    const wrongMethod = await call("POST", "/api/spaces");
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("Allow")).toBe("GET");
  });
});

describe("query budget per read route", () => {
  it("stays fixed for /api/spaces, /api/pages/:id, /api/spaces/:id/mirror, and /api/calendar", async () => {
    const raw = await getTestDb();

    await seedSpace(raw, "budget-space-a");
    await seedSpace(raw, "budget-person", "person");
    await seedSpace(raw, "budget-space-b");
    await createTemplate(raw, { id: "budget-tpl", label: "T", hue: "steel", seed: ["# a"] }, NOW);
    for (const [pageId, spaceId] of [
      ["budget-page-a", "budget-space-a"],
      ["budget-page-b", "budget-space-a"],
      ["budget-page-c", "budget-space-b"],
    ] as const) {
      await seedPage(raw, pageId, spaceId);
      await seedBlock(raw, `${pageId}-block`, pageId);
      await createItem(raw, { id: `${pageId}-task`, blockId: `${pageId}-block`, position: 1000, kind: "task", text: "t", dueDate: "2026-08-10", assigneeSpaceId: "budget-person" }, NOW);
      await createItem(raw, { id: `${pageId}-event`, blockId: `${pageId}-block`, position: 2000, kind: "event", text: "e", eventDate: "2026-08-10", eventTime: "14:00" }, NOW);
      await createItem(raw, { id: `${pageId}-note`, blockId: `${pageId}-block`, position: 3000, kind: "note", text: "n", heading: null }, NOW);
    }

    const { db, count } = countingD1(raw);

    const beforeSpaces = count();
    const spaces = await json<SpacesResponse>("GET", "/api/spaces", undefined, db);
    expect(spaces.status).toBe(200);
    expect(count() - beforeSpaces).toBe(3);

    const beforePage = count();
    const page = await json<PageResponse>("GET", "/api/pages/budget-page-a", undefined, db);
    expect(page.status).toBe(200);
    expect(count() - beforePage).toBe(3);

    const beforeMirror = count();
    const mirror = await json<MirrorTask[]>("GET", "/api/spaces/budget-person/mirror", undefined, db);
    expect(mirror.status).toBe(200);
    expect(count() - beforeMirror).toBe(2);

    const beforeCalendar = count();
    const calendar = await json<CalendarResponse>("GET", "/api/calendar?from=2026-08-01&to=2026-08-31", undefined, db);
    expect(calendar.status).toBe(200);
    expect(count() - beforeCalendar).toBe(1);
  });

  it("stays fixed for a respace-triggering item write, regardless of block size", async () => {
    const raw = await getTestDb();
    await seedSpace(raw, "rs-space");
    await seedPage(raw, "rs-page", "rs-space");
    await seedBlock(raw, "rs-block", "rs-page");
    for (let i = 0; i < 40; i++) {
      await createItem(raw, { id: `rs-${i}`, blockId: "rs-block", position: (i + 1) * 1000, kind: "note", text: "x", heading: null }, NOW);
    }

    const { db, count } = countingD1(raw);
    const before = count();
    const result = await json<ItemWriteResponse>("PUT", "/api/items/rs-collide", {
      blockId: "rs-block",
      kind: "note",
      position: 1000,
      text: "neu",
      heading: null,
    }, db);

    expect(result.status).toBe(200);
    expect(result.body.respaced).not.toBeNull();
    expect(Object.keys(result.body.respaced!).length).toBe(41);
    // getItem + getBlock + listBlockItems + respace UPDATE + INSERT — one
    // UPDATE for the whole block, never one per row.
    expect(count() - before).toBe(5);
  });
});

describe("item re-spacing (respace)", () => {
  it("inserting twenty times at the same slot keeps the expected order without collisions", async () => {
    const db = await getTestDb();
    await seedSpace(db, "x20-space");
    await seedPage(db, "x20-page", "x20-space");
    await seedBlock(db, "x20-block", "x20-page");
    await createItem(db, { id: "x20-anchor", blockId: "x20-block", position: 1000, kind: "note", text: "Anker", heading: 1 }, NOW);
    await createItem(db, { id: "x20-last", blockId: "x20-block", position: 2000, kind: "note", text: "Schluss", heading: null }, NOW);

    // The client's flow: place each new row between the anchor and the next
    // stream row, then PUT. Positions are integers, so roughly every ninth
    // insert exhausts the gap and the server re-spaces the block.
    for (let i = 0; i < 20; i++) {
      const items = await streamItems(db, "x20-block");
      const anchorIndex = items.findIndex((item) => item.id === "x20-anchor");
      const after = items[anchorIndex]!;
      const before = items[anchorIndex + 1] ?? null;
      const position = insertPositionBetween(after.position, before ? before.position : null);

      const result = await json<ItemWriteResponse>("PUT", `/api/items/x20-row-${i}`, {
        blockId: "x20-block",
        kind: "note",
        position,
        text: `zeile-${i}`,
        heading: null,
      });
      expect(result.status).toBe(200);
      if (result.body.respaced) {
        const positions = Object.values(result.body.respaced);
        expect(new Set(positions).size).toBe(positions.length);
      }
    }

    const items = await streamItems(db, "x20-block");
    expect(items).toHaveLength(22);
    // Newest row sits directly under the anchor, nothing lost, no collision.
    expect(items.map((item) => item.text)).toEqual([
      "Anker",
      ...Array.from({ length: 20 }, (_, i) => `zeile-${19 - i}`),
      "Schluss",
    ]);
    const positions = items.map((item) => item.position);
    expect(new Set(positions).size).toBe(positions.length);
  });
});

async function streamItems(db: D1Database, blockId: string) {
  const page = await loadPageBlocks(db, "x20-page");
  const block = page.find((entry) => entry.id === blockId);
  return block?.items ?? [];
}
