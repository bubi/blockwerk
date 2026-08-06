import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import worker from "../index.ts";
import type { Env } from "../env.ts";
import { countingD1 } from "./testing/counting-d1.ts";
import { getTestDb } from "./testing/get-test-db.ts";
import {
  createBlock,
  createItem,
  createPage,
  createSpace,
  createTemplate,
  loadPageBlocks,
  updateSpace,
} from "./index.ts";
import type {
  CalendarResponse,
  ItemWriteResponse,
  OverviewResponse,
  PageResponse,
  SearchResponse,
  SpacesResponse,
} from "../../shared/api.ts";
import { insertPositionBetween } from "../../src/domain/position.ts";

const NOW = 1_700_000_000_000;
const DEV_EMAIL = "tester@example.com";

interface ErrorBody {
  error: {
    code: string;
    message?: string;
    issues?: { path: string; code: string }[];
  };
}

function makeEnv(db: D1Database): Env {
  return {
    ...env,
    DB: db as unknown as D1Database,
    DEV_ACCESS_EMAIL: DEV_EMAIL,
  };
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
  return new Request<unknown, IncomingRequestCfProperties<unknown>>(
    `https://blockwerk.test${path}`,
    init,
  );
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  db?: D1Database,
): Promise<Response> {
  const testDb = db ?? (await getTestDb());
  return worker.fetch(apiRequest(method, path, body), makeEnv(testDb));
}

async function json<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  db?: D1Database,
) {
  const response = await call(method, path, body, db);
  return { status: response.status, body: (await response.json()) as T };
}

async function seedSpace(
  db: D1Database,
  id: string,
  kind: "person" | "topic" = "topic",
) {
  return createSpace(
    db,
    { id, name: id, kind, short: id.slice(0, 2).toUpperCase() },
    NOW,
  );
}

async function seedPage(db: D1Database, id: string, spaceId: string) {
  return createPage(db, { id, spaceId, title: id }, NOW);
}

async function seedBlock(db: D1Database, id: string, pageId: string) {
  return createBlock(
    db,
    { id, pageId, templateId: null, title: id, date: "2026-08-01" },
    NOW,
  );
}

describe("GET /api/spaces", () => {
  it("returns spaces with nested pages plus templates, ordered by id", async () => {
    const db = await getTestDb();
    await seedSpace(db, "list-b", "person");
    await seedPage(db, "list-b-page", "list-b");
    await seedSpace(db, "list-a", "topic");
    await createTemplate(
      db,
      { id: "list-tpl", label: "Meeting", hue: "steel", seed: [] },
      NOW,
    );

    const { status, body } = await json<SpacesResponse>("GET", "/api/spaces");

    expect(status).toBe(200);
    expect(body.spaces.map((space) => space.id)).toEqual(["list-a", "list-b"]);
    expect(body.spaces[0]).toMatchObject({ id: "list-a", pages: [] });
    expect(body.spaces[1]).toMatchObject({
      id: "list-b",
      pages: [
        expect.objectContaining({ id: "list-b-page", spaceId: "list-b" }),
      ],
    });
    expect(body.templates).toEqual([
      expect.objectContaining({ id: "list-tpl" }),
    ]);
  });

  it("resolves meSpaceId from the Access email against a person space", async () => {
    const db = await getTestDb();
    await seedSpace(db, "me-me", "person");
    await seedSpace(db, "me-other", "person");
    await updateSpace(db, "me-me", { email: DEV_EMAIL }, NOW);

    const { status, body } = await json<SpacesResponse>("GET", "/api/spaces");

    expect(status).toBe(200);
    // A person without the email, or any topic, never becomes "me".
    expect(body.meSpaceId).toBe("me-me");
  });
});

describe("GET /api/pages/:id", () => {
  it("returns the page with blocks, items grouped notes+refs → tasks → events (chronological)", async () => {
    const db = await getTestDb();
    await seedSpace(db, "order-space");
    await seedPage(db, "order-page", "order-space");
    await seedBlock(db, "order-block", "order-page");
    // Inserted deliberately out of display order.
    await createItem(
      db,
      {
        id: "o-event-late",
        blockId: "order-block",
        position: 100,
        kind: "event",
        text: "late",
        eventDate: "2026-08-10",
        eventTime: "09:00",
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "o-task-z",
        blockId: "order-block",
        position: 5000,
        kind: "task",
        text: "z",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "o-ref",
        blockId: "order-block",
        position: 200,
        kind: "ref",
        refBlockId: null,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "o-note-b",
        blockId: "order-block",
        position: 2000,
        kind: "note",
        text: "b",
        heading: null,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "o-event-early",
        blockId: "order-block",
        position: 300,
        kind: "event",
        text: "early",
        eventDate: "2026-08-09",
        eventTime: "10:00",
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "o-note-a",
        blockId: "order-block",
        position: 1000,
        kind: "note",
        text: "a",
        heading: 1,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "o-task-a",
        blockId: "order-block",
        position: 4000,
        kind: "task",
        text: "a",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );

    const { status, body } = await json<PageResponse>(
      "GET",
      "/api/pages/order-page",
    );

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
    const { status, body } = await json<ErrorBody>(
      "GET",
      "/api/pages/no-such-page",
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("GET /api/overview", () => {
  it("returns open tasks, window events, and the blocks and pages behind them", async () => {
    const db = await getTestDb();
    await seedSpace(db, "ov-person", "person");
    await seedSpace(db, "ov-topic");
    await seedPage(db, "ov-page", "ov-topic");
    await seedBlock(db, "ov-block", "ov-page");
    await createItem(
      db,
      {
        id: "ov-open",
        blockId: "ov-block",
        position: 1000,
        kind: "task",
        text: "open",
        dueDate: "2026-08-10",
        assigneeSpaceId: "ov-person",
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "ov-done",
        blockId: "ov-block",
        position: 2000,
        kind: "task",
        text: "done",
        dueDate: "2026-08-10",
        assigneeSpaceId: "ov-person",
        done: true,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "ov-event",
        blockId: "ov-block",
        position: 3000,
        kind: "event",
        text: "e",
        eventDate: "2026-08-12",
        eventTime: "14:00",
      },
      NOW,
    );

    const { status, body } = await json<OverviewResponse>(
      "GET",
      "/api/overview?today=2026-08-10",
    );

    expect(status).toBe(200);
    const taskIds = body.tasks.map((task) => task.id);
    expect(taskIds).toContain("ov-open");
    expect(taskIds).not.toContain("ov-done");
    expect(body.events.map((event) => event.id)).toContain("ov-event");
    expect(body.blocks.map((block) => block.id)).toContain("ov-block");
    expect(body.pages.map((page) => page.id)).toContain("ov-page");
  });

  it("rejects a missing or malformed today", async () => {
    const missing = await json<ErrorBody>("GET", "/api/overview");
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("validation");

    const malformed = await json<ErrorBody>("GET", "/api/overview?today=nope");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.issues?.[0]?.path).toBe("today");
  });
});

describe("GET /api/calendar", () => {
  it("returns due tasks and events inside the window, without blocks", async () => {
    const db = await getTestDb();
    await seedSpace(db, "cal-space");
    await seedPage(db, "cal-page", "cal-space");
    await createBlock(
      db,
      {
        id: "cal-block",
        pageId: "cal-page",
        templateId: null,
        title: "cal-block",
        date: "2026-12-10",
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "cal-task",
        blockId: "cal-block",
        position: 1000,
        kind: "task",
        text: "t",
        dueDate: "2026-12-11",
        assigneeSpaceId: null,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "cal-event",
        blockId: "cal-block",
        position: 2000,
        kind: "event",
        text: "e",
        eventDate: "2026-12-10",
        eventTime: "14:00",
      },
      NOW,
    );
    await createBlock(
      db,
      {
        id: "cal-other-block",
        pageId: "cal-page",
        templateId: null,
        title: "other",
        date: "2026-12-01",
      },
      NOW,
    );

    const { status, body } = await json<CalendarResponse>(
      "GET",
      "/api/calendar?from=2026-12-10&to=2026-12-11",
    );

    expect(status).toBe(200);
    expect(Object.hasOwn(body, "blocks")).toBe(false);
    expect(body.dueTasks.map((task) => task.id)).toEqual(["cal-task"]);
    expect(body.events.map((event) => event.id)).toEqual(["cal-event"]);
  });

  it("rejects a missing, malformed, or reversed window", async () => {
    const missing = await json<ErrorBody>("GET", "/api/calendar");
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("validation");

    const malformed = await json<ErrorBody>(
      "GET",
      "/api/calendar?from=2026-13-01&to=2026-08-11",
    );
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.issues).toEqual(
      expect.arrayContaining([{ path: "from", code: "invalid_date" }]),
    );

    const reversed = await json<ErrorBody>(
      "GET",
      "/api/calendar?from=2026-08-11&to=2026-08-10",
    );
    expect(reversed.status).toBe(400);
    expect(reversed.body.error.issues).toEqual([
      { path: "from", code: "from_after_to" },
    ]);
  });
});

describe("GET /api/search", () => {
  it("finds block titles and item text with context for a result row", async () => {
    const db = await getTestDb();
    await createTemplate(
      db,
      { id: "s-meeting", label: "Meeting", hue: "steel", seed: [] },
      NOW,
    );
    await seedSpace(db, "s-road", "topic");
    await seedPage(db, "s-plan", "s-road");
    await createBlock(
      db,
      {
        id: "s-b1",
        pageId: "s-plan",
        templateId: "s-meeting",
        title: "Quartalsplanung Q3",
        date: "2026-07-31",
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "s-task",
        blockId: "s-b1",
        position: 1000,
        kind: "task",
        text: "Kapazitätsplan für Q3 aufstellen",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );

    const { status, body } = await json<SearchResponse>(
      "GET",
      "/api/search?q=Q3",
    );

    expect(status).toBe(200);
    expect(body.query).toBe("Q3");
    expect(body.blocks).toEqual([
      {
        block: { id: "s-b1", title: "Quartalsplanung Q3", date: "2026-07-31" },
        templateLabel: "Meeting",
        page: { id: "s-plan", title: "s-plan" },
        space: { id: "s-road", name: "s-road" },
      },
    ]);
    expect(body.items).toEqual([
      {
        item: {
          id: "s-task",
          kind: "task",
          text: "Kapazitätsplan für Q3 aufstellen",
        },
        block: { id: "s-b1", title: "Quartalsplanung Q3" },
        page: { id: "s-plan", title: "s-plan" },
        space: { id: "s-road", name: "s-road" },
      },
    ]);
  });

  it("matches case-insensitively and reports no template as null", async () => {
    const db = await getTestDb();
    await seedSpace(db, "s-case-space");
    await seedPage(db, "s-case-page", "s-case-space");
    await createBlock(
      db,
      {
        id: "s-case-b1",
        pageId: "s-case-page",
        templateId: null,
        title: "Interview Nordbau GmbH",
        date: "2026-08-03",
      },
      NOW,
    );

    const { status, body } = await json<SearchResponse>(
      "GET",
      "/api/search?q=nordbau",
    );
    expect(status).toBe(200);
    expect(body.blocks[0]).toMatchObject({
      block: { id: "s-case-b1" },
      templateLabel: null,
    });
  });

  it("returns an empty result for a query without hits", async () => {
    const db = await getTestDb();
    await seedSpace(db, "s-empty-space");
    await seedPage(db, "s-empty-page", "s-empty-space");
    await createBlock(
      db,
      {
        id: "s-empty-b1",
        pageId: "s-empty-page",
        templateId: null,
        title: "X",
        date: "2026-08-03",
      },
      NOW,
    );

    const { status, body } = await json<SearchResponse>(
      "GET",
      "/api/search?q=nirgendwo",
    );
    expect(status).toBe(200);
    expect(body.blocks).toEqual([]);
    expect(body.items).toEqual([]);
  });

  it("rejects a missing or blank query", async () => {
    const missing = await json<ErrorBody>("GET", "/api/search");
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("validation");
    expect(missing.body.error.issues).toEqual([
      { path: "q", code: "invalid_type" },
    ]);

    const blank = await json<ErrorBody>("GET", "/api/search?q=%20%20");
    expect(blank.status).toBe(400);
    expect(blank.body.error.issues).toEqual(
      expect.arrayContaining([{ path: "q", code: "too_small" }]),
    );
  });
});

describe("PUT /api/:entity/:id", () => {
  it("creates on first PUT and replaces on a repeated PUT — exactly one row", async () => {
    const db = await getTestDb();
    const body = { name: "Put Space", kind: "topic", short: "PU" };

    const first = await json<unknown>("PUT", "/api/spaces/put-space", body);
    expect(first.status).toBe(200);
    const second = await json<unknown>("PUT", "/api/spaces/put-space", {
      ...body,
      name: "Put Space Renamed",
    });
    expect(second.status).toBe(200);

    const count = await db
      .prepare("SELECT COUNT(*) AS n FROM spaces WHERE id = ?")
      .bind("put-space")
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("rejects invalid input with a 400 and a machine-readable field issue", async () => {
    const { status, body } = await json<ErrorBody>(
      "PUT",
      "/api/spaces/bad-kind",
      {
        name: "X",
        kind: "group",
        short: "X",
      },
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("validation");
    expect(body.error.issues).toEqual([
      { path: "kind", code: "invalid_value" },
    ]);
  });

  it("rejects a reference to a missing parent instead of failing in the db", async () => {
    const { status, body } = await json<ErrorBody>(
      "PUT",
      "/api/pages/ghost-page",
      {
        spaceId: "no-such-space",
        title: "Ghost",
      },
    );
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([{ path: "spaceId", code: "not_found" }]);
  });

  it("rejects a block referencing a missing template", async () => {
    const db = await getTestDb();
    await seedSpace(db, "ref-space");
    await seedPage(db, "ref-page", "ref-space");

    const { status, body } = await json<ErrorBody>(
      "PUT",
      "/api/blocks/ref-block",
      {
        pageId: "ref-page",
        templateId: "no-such-template",
        title: "B",
        date: "2026-08-01",
      },
    );
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([
      { path: "templateId", code: "not_found" },
    ]);
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
    expect(moved.body.error.issues).toEqual([
      { path: "blockId", code: "immutable" },
    ]);

    const retyped = await json<ErrorBody>("PUT", "/api/items/chain-item", {
      blockId: "chain-block",
      kind: "task",
      position: 1000,
      text: "hello",
      heading: null,
    });
    expect(retyped.status).toBe(400);
    expect(retyped.body.error.issues).toEqual([
      { path: "kind", code: "immutable" },
    ]);

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
    await createItem(
      db,
      {
        id: "patch-item",
        blockId: "patch-block",
        position: 1000,
        kind: "task",
        text: "t",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );

    const patched = await json<ItemWriteResponse>(
      "PATCH",
      "/api/items/patch-item",
      { done: true },
    );
    expect(patched.status).toBe(200);
    expect(patched.body.row.done).toBe(true);
    expect(patched.body.respaced).toBeNull();

    const missing = await json<ErrorBody>("PATCH", "/api/items/no-such-item", {
      done: true,
    });
    expect(missing.status).toBe(404);
  });

  it("checks cross-field rules against the stored kind", async () => {
    const db = await getTestDb();
    await seedSpace(db, "ck-space");
    await seedPage(db, "ck-page", "ck-space");
    await seedBlock(db, "ck-block", "ck-page");
    await createItem(
      db,
      {
        id: "ck-task",
        blockId: "ck-block",
        position: 1000,
        kind: "task",
        text: "t",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );

    const { status, body } = await json<ErrorBody>(
      "PATCH",
      "/api/items/ck-task",
      { heading: 1 },
    );
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([
      { path: "heading", code: "heading_only_on_note" },
    ]);
  });

  it("rejects assigning a task to a missing space", async () => {
    const db = await getTestDb();
    await seedSpace(db, "as-space");
    await seedPage(db, "as-page", "as-space");
    await seedBlock(db, "as-block", "as-page");
    await createItem(
      db,
      {
        id: "as-task",
        blockId: "as-block",
        position: 1000,
        kind: "task",
        text: "t",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );

    const { status, body } = await json<ErrorBody>(
      "PATCH",
      "/api/items/as-task",
      {
        assigneeSpaceId: "no-such-person",
      },
    );
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([
      { path: "assigneeSpaceId", code: "not_found" },
    ]);
  });
});

describe("task notes (docs/adr/0014)", () => {
  it("rejects a task or event carrying a parentItemId (400)", async () => {
    const db = await getTestDb();
    await seedSpace(db, "tn-space");
    await seedPage(db, "tn-page", "tn-space");
    await seedBlock(db, "tn-block", "tn-page");
    await createItem(
      db,
      {
        id: "tn-task",
        blockId: "tn-block",
        position: 1000,
        kind: "task",
        text: "t",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );

    const task = await json<ErrorBody>("PUT", "/api/items/tn-task-child", {
      blockId: "tn-block",
      kind: "task",
      position: 2000,
      text: "child?",
      dueDate: null,
      assigneeSpaceId: null,
      parentItemId: "tn-task",
    });
    expect(task.status).toBe(400);
    expect(task.body.error.issues).toEqual([
      { path: "parentItemId", code: "parent_only_on_note" },
    ]);

    const event = await json<ErrorBody>("PUT", "/api/items/tn-event-child", {
      blockId: "tn-block",
      kind: "event",
      position: 2000,
      text: "child?",
      eventDate: "2026-08-10",
      eventTime: null,
      parentItemId: "tn-task",
    });
    expect(event.status).toBe(400);
    expect(event.body.error.issues).toEqual([
      { path: "parentItemId", code: "parent_only_on_note" },
    ]);
  });

  it("rejects a heading on a child note (400)", async () => {
    const db = await getTestDb();
    await seedSpace(db, "tnh-space");
    await seedPage(db, "tnh-page", "tnh-space");
    await seedBlock(db, "tnh-block", "tnh-page");
    await createItem(
      db,
      {
        id: "tnh-task",
        blockId: "tnh-block",
        position: 1000,
        kind: "task",
        text: "t",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );

    const { status, body } = await json<ErrorBody>(
      "PUT",
      "/api/items/tnh-child",
      {
        blockId: "tnh-block",
        kind: "note",
        position: 2000,
        text: "x",
        heading: 1,
        parentItemId: "tnh-task",
      },
    );
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([
      { path: "heading", code: "heading_forbidden_on_child" },
    ]);
  });

  it("rejects a note whose parent is a note (400)", async () => {
    const db = await getTestDb();
    await seedSpace(db, "tno-space");
    await seedPage(db, "tno-page", "tno-space");
    await seedBlock(db, "tno-block", "tno-page");
    await createItem(
      db,
      {
        id: "tno-note",
        blockId: "tno-block",
        position: 1000,
        kind: "note",
        text: "n",
        heading: null,
      },
      NOW,
    );

    const { status, body } = await json<ErrorBody>(
      "PUT",
      "/api/items/tno-child",
      {
        blockId: "tno-block",
        kind: "note",
        position: 2000,
        text: "x",
        heading: null,
        parentItemId: "tno-note",
      },
    );
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([
      { path: "parentItemId", code: "parent_must_be_task" },
    ]);
  });

  it("rejects a note under a child note — one level only (400)", async () => {
    const db = await getTestDb();
    await seedSpace(db, "tn2-space");
    await seedPage(db, "tn2-page", "tn2-space");
    await seedBlock(db, "tn2-block", "tn2-page");
    await createItem(
      db,
      {
        id: "tn2-task",
        blockId: "tn2-block",
        position: 1000,
        kind: "task",
        text: "t",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "tn2-child",
        blockId: "tn2-block",
        position: 2000,
        kind: "note",
        text: "c",
        heading: null,
        parentItemId: "tn2-task",
      },
      NOW,
    );

    const { status, body } = await json<ErrorBody>(
      "PUT",
      "/api/items/tn2-grandchild",
      {
        blockId: "tn2-block",
        kind: "note",
        position: 3000,
        text: "x",
        heading: null,
        parentItemId: "tn2-child",
      },
    );
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([
      { path: "parentItemId", code: "parent_must_not_be_child" },
    ]);
  });

  it("rejects a child note whose parent does not exist (400)", async () => {
    const db = await getTestDb();
    await seedSpace(db, "tnm-space");
    await seedPage(db, "tnm-page", "tnm-space");
    await seedBlock(db, "tnm-block", "tnm-page");

    const { status, body } = await json<ErrorBody>(
      "PUT",
      "/api/items/tnm-child",
      {
        blockId: "tnm-block",
        kind: "note",
        position: 1000,
        text: "x",
        heading: null,
        parentItemId: "no-such-task",
      },
    );
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([
      { path: "parentItemId", code: "not_found" },
    ]);
  });

  it("a child note sits directly under its task, not in the notes group", async () => {
    const db = await getTestDb();
    await seedSpace(db, "tno2-space");
    await seedPage(db, "tno2-page", "tno2-space");
    await seedBlock(db, "tno2-block", "tno2-page");
    await createItem(
      db,
      {
        id: "tno2-note",
        blockId: "tno2-block",
        position: 500,
        kind: "note",
        text: "top",
        heading: null,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "tno2-task",
        blockId: "tno2-block",
        position: 4000,
        kind: "task",
        text: "t",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );

    const put = await json<ItemWriteResponse>("PUT", "/api/items/tno2-child", {
      blockId: "tno2-block",
      kind: "note",
      position: 1500,
      text: "Kontext",
      heading: null,
      parentItemId: "tno2-task",
    });
    expect(put.status).toBe(200);

    const page = await json<PageResponse>("GET", "/api/pages/tno2-page");
    const items = page.body.blocks[0]!.items;
    // A top-level note would sort before the task; the child follows its task.
    expect(items.map((entry) => entry.id)).toEqual([
      "tno2-note",
      "tno2-task",
      "tno2-child",
    ]);
    expect(items.find((entry) => entry.id === "tno2-child")).toMatchObject({
      kind: "note",
      parentItemId: "tno2-task",
    });
  });

  it("deleting a task takes its notes with it, and only them", async () => {
    const db = await getTestDb();
    await seedSpace(db, "tnd-space");
    await seedPage(db, "tnd-page", "tnd-space");
    await seedBlock(db, "tnd-block", "tnd-page");
    await createItem(
      db,
      {
        id: "tnd-task",
        blockId: "tnd-block",
        position: 1000,
        kind: "task",
        text: "t",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "tnd-child",
        blockId: "tnd-block",
        position: 2000,
        kind: "note",
        text: "Kontext",
        heading: null,
        parentItemId: "tnd-task",
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "tnd-note",
        blockId: "tnd-block",
        position: 500,
        kind: "note",
        text: "top",
        heading: null,
      },
      NOW,
    );

    const deleted = await call("DELETE", "/api/items/tnd-task");
    expect(deleted.status).toBe(204);

    const page = await json<PageResponse>("GET", "/api/pages/tnd-page");
    const items = page.body.blocks[0]!.items;
    expect(items.map((entry) => entry.id)).toEqual(["tnd-note"]);
  });

  it("forbids adding a heading to a child note via PATCH", async () => {
    const db = await getTestDb();
    await seedSpace(db, "tnp-space");
    await seedPage(db, "tnp-page", "tnp-space");
    await seedBlock(db, "tnp-block", "tnp-page");
    await createItem(
      db,
      {
        id: "tnp-task",
        blockId: "tnp-block",
        position: 1000,
        kind: "task",
        text: "t",
        dueDate: null,
        assigneeSpaceId: null,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "tnp-child",
        blockId: "tnp-block",
        position: 2000,
        kind: "note",
        text: "c",
        heading: null,
        parentItemId: "tnp-task",
      },
      NOW,
    );

    const { status, body } = await json<ErrorBody>(
      "PATCH",
      "/api/items/tnp-child",
      { heading: 1 },
    );
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([
      { path: "heading", code: "heading_forbidden_on_child" },
    ]);
  });
});

describe("DELETE /api/:entity/:id", () => {
  it("deleting a space cascades its ownership chain and only nulls the assignee elsewhere", async () => {
    const db = await getTestDb();

    await seedSpace(db, "gone-space");
    await seedPage(db, "gone-page", "gone-space");
    await seedBlock(db, "gone-block", "gone-page");
    await createItem(
      db,
      {
        id: "gone-note",
        blockId: "gone-block",
        position: 1000,
        kind: "note",
        text: "n",
        heading: null,
      },
      NOW,
    );

    await seedSpace(db, "kept-space");
    await seedPage(db, "kept-page", "kept-space");
    await seedBlock(db, "kept-block", "kept-page");
    await createItem(
      db,
      {
        id: "kept-task",
        blockId: "kept-block",
        position: 1000,
        kind: "task",
        text: "was gone's",
        dueDate: null,
        assigneeSpaceId: "gone-space",
      },
      NOW,
    );

    const deleted = await call("DELETE", "/api/spaces/gone-space");
    expect(deleted.status).toBe(204);

    const gonePage = await json<ErrorBody>("GET", "/api/pages/gone-page");
    expect(gonePage.status).toBe(404);

    const kept = await json<PageResponse>("GET", "/api/pages/kept-page");
    expect(kept.status).toBe(200);
    const keptTask = kept.body.blocks[0]?.items[0];
    expect(keptTask).toMatchObject({
      id: "kept-task",
      kind: "task",
      assigneeSpaceId: null,
    });
  });

  it("returns 404 when deleting a missing row", async () => {
    const { status, body } = await json<ErrorBody>(
      "DELETE",
      "/api/spaces/never-existed",
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("deleting a template leaves blocks intact, only un-templating them", async () => {
    const db = await getTestDb();
    await createTemplate(
      db,
      { id: "doom-tpl", label: "Doomed", hue: "steel", seed: [] },
      NOW,
    );
    await seedSpace(db, "ut-space");
    await seedPage(db, "ut-page", "ut-space");
    await db
      .prepare(
        "INSERT INTO blocks (id, page_id, template_id, title, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind("ut-block", "ut-page", "doom-tpl", "B", "2026-08-01", NOW, NOW)
      .run();

    const deleted = await call("DELETE", "/api/templates/doom-tpl");
    expect(deleted.status).toBe(204);

    const page = await json<PageResponse>("GET", "/api/pages/ut-page");
    expect(page.body.blocks[0]).toMatchObject({
      id: "ut-block",
      templateId: null,
      title: "B",
    });
  });

  it("deleting a block keeps ref items, only nulling their target", async () => {
    const db = await getTestDb();
    await seedSpace(db, "refd-space");
    await seedPage(db, "refd-page", "refd-space");
    await seedBlock(db, "refd-target", "refd-page");
    await seedBlock(db, "refd-source", "refd-page");
    await createItem(
      db,
      {
        id: "refd-ref",
        blockId: "refd-source",
        position: 1000,
        kind: "ref",
        refBlockId: "refd-target",
      },
      NOW,
    );

    const deleted = await call("DELETE", "/api/blocks/refd-target");
    expect(deleted.status).toBe(204);

    const page = await json<PageResponse>("GET", "/api/pages/refd-page");
    const source = page.body.blocks.find((block) => block.id === "refd-source");
    expect(source?.items[0]).toMatchObject({
      id: "refd-ref",
      kind: "ref",
      refBlockId: null,
    });
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
  it("stays fixed for /api/spaces, /api/pages/:id, /api/overview, /api/calendar, and /api/search", async () => {
    const raw = await getTestDb();

    await seedSpace(raw, "budget-space-a");
    await seedSpace(raw, "budget-person", "person");
    await seedSpace(raw, "budget-space-b");
    await createTemplate(
      raw,
      { id: "budget-tpl", label: "T", hue: "steel", seed: ["# a"] },
      NOW,
    );
    for (const [pageId, spaceId] of [
      ["budget-page-a", "budget-space-a"],
      ["budget-page-b", "budget-space-a"],
      ["budget-page-c", "budget-space-b"],
    ] as const) {
      await seedPage(raw, pageId, spaceId);
      await seedBlock(raw, `${pageId}-block`, pageId);
      await createItem(
        raw,
        {
          id: `${pageId}-task`,
          blockId: `${pageId}-block`,
          position: 1000,
          kind: "task",
          text: "t",
          dueDate: "2026-08-10",
          assigneeSpaceId: "budget-person",
        },
        NOW,
      );
      await createItem(
        raw,
        {
          id: `${pageId}-event`,
          blockId: `${pageId}-block`,
          position: 2000,
          kind: "event",
          text: "e",
          eventDate: "2026-08-10",
          eventTime: "14:00",
        },
        NOW,
      );
      await createItem(
        raw,
        {
          id: `${pageId}-note`,
          blockId: `${pageId}-block`,
          position: 3000,
          kind: "note",
          text: "n",
          heading: null,
        },
        NOW,
      );
    }

    const { db, count } = countingD1(raw);

    const beforeSpaces = count();
    const spaces = await json<SpacesResponse>(
      "GET",
      "/api/spaces",
      undefined,
      db,
    );
    expect(spaces.status).toBe(200);
    expect(count() - beforeSpaces).toBe(3);

    const beforePage = count();
    const page = await json<PageResponse>(
      "GET",
      "/api/pages/budget-page-a",
      undefined,
      db,
    );
    expect(page.status).toBe(200);
    expect(count() - beforePage).toBe(3);

    const beforeOverview = count();
    const overview = await json<OverviewResponse>(
      "GET",
      "/api/overview?today=2026-08-10",
      undefined,
      db,
    );
    expect(overview.status).toBe(200);
    expect(count() - beforeOverview).toBe(3);

    const beforeCalendar = count();
    const calendar = await json<CalendarResponse>(
      "GET",
      "/api/calendar?from=2026-08-01&to=2026-08-31",
      undefined,
      db,
    );
    expect(calendar.status).toBe(200);
    expect(count() - beforeCalendar).toBe(1);

    const beforeSearch = count();
    const search = await json<SearchResponse>(
      "GET",
      "/api/search?q=t",
      undefined,
      db,
    );
    expect(search.status).toBe(200);
    expect(count() - beforeSearch).toBe(5);
  });

  it("stays fixed for a respace-triggering item write, regardless of block size", async () => {
    const raw = await getTestDb();
    await seedSpace(raw, "rs-space");
    await seedPage(raw, "rs-page", "rs-space");
    await seedBlock(raw, "rs-block", "rs-page");
    for (let i = 0; i < 40; i++) {
      await createItem(
        raw,
        {
          id: `rs-${i}`,
          blockId: "rs-block",
          position: (i + 1) * 1000,
          kind: "note",
          text: "x",
          heading: null,
        },
        NOW,
      );
    }

    const { db, count } = countingD1(raw);
    const before = count();
    const result = await json<ItemWriteResponse>(
      "PUT",
      "/api/items/rs-collide",
      {
        blockId: "rs-block",
        kind: "note",
        position: 1000,
        text: "neu",
        heading: null,
      },
      db,
    );

    expect(result.status).toBe(200);
    expect(result.body.respaced).not.toBeNull();
    expect(Object.keys(result.body.respaced!).length).toBe(41);
    // getItem + getBlock + listBlockItems + respace UPDATE + INSERT — one
    // UPDATE for the whole block, never one per row.
    expect(count() - before).toBe(5);
  });

  it("keeps the overview at three queries no matter how many notes a task carries", async () => {
    const raw = await getTestDb();
    await seedSpace(raw, "bn-space", "person");
    await seedPage(raw, "bn-page", "bn-space");
    await seedBlock(raw, "bn-block", "bn-page");
    // Many open tasks, each with several notes — the notes ride in the same
    // items scan, never one query per task.
    for (let t = 0; t < 30; t++) {
      const taskId = `bn-task-${t}`;
      await createItem(
        raw,
        {
          id: taskId,
          blockId: "bn-block",
          position: (t + 1) * 1000,
          kind: "task",
          text: taskId,
          dueDate: "2026-08-10",
          assigneeSpaceId: "bn-space",
        },
        NOW,
      );
      for (let n = 0; n < 4; n++) {
        await createItem(
          raw,
          {
            id: `bn-${taskId}-note-${n}`,
            blockId: "bn-block",
            position: (t + 1) * 1000 + (n + 1) * 100,
            kind: "note",
            text: `Kontext ${n}`,
            heading: null,
            parentItemId: taskId,
          },
          NOW,
        );
      }
    }

    const { db, count } = countingD1(raw);
    const before = count();
    const overview = await json<OverviewResponse>(
      "GET",
      "/api/overview?today=2026-08-10",
      undefined,
      db,
    );
    expect(overview.status).toBe(200);
    // All seeded tasks are returned, each with all four of its notes, and the
    // route still cost exactly three queries — the notes ride in the same
    // items scan, never one query per task.
    expect(overview.body.tasks.map((row) => row.id)).toEqual(
      expect.arrayContaining(
        Array.from({ length: 30 }, (_, t) => `bn-task-${t}`),
      ),
    );
    expect(overview.body.notes.map((row) => row.id)).toEqual(
      expect.arrayContaining(
        Array.from({ length: 30 }, (_, t) =>
          Array.from({ length: 4 }, (_, n) => `bn-bn-task-${t}-note-${n}`),
        ).flat(),
      ),
    );
    expect(count() - before).toBe(3);
  });
});

describe("item re-spacing (respace)", () => {
  it("inserting twenty times at the same slot keeps the expected order without collisions", async () => {
    const db = await getTestDb();
    await seedSpace(db, "x20-space");
    await seedPage(db, "x20-page", "x20-space");
    await seedBlock(db, "x20-block", "x20-page");
    await createItem(
      db,
      {
        id: "x20-anchor",
        blockId: "x20-block",
        position: 1000,
        kind: "note",
        text: "Anker",
        heading: 1,
      },
      NOW,
    );
    await createItem(
      db,
      {
        id: "x20-last",
        blockId: "x20-block",
        position: 2000,
        kind: "note",
        text: "Schluss",
        heading: null,
      },
      NOW,
    );

    // The client's flow: place each new row between the anchor and the next
    // stream row, then PUT. Positions are integers, so roughly every ninth
    // insert exhausts the gap and the server re-spaces the block.
    for (let i = 0; i < 20; i++) {
      const items = await streamItems(db, "x20-block");
      const anchorIndex = items.findIndex((item) => item.id === "x20-anchor");
      const after = items[anchorIndex]!;
      const before = items[anchorIndex + 1] ?? null;
      const position = insertPositionBetween(
        after.position,
        before ? before.position : null,
      );

      const result = await json<ItemWriteResponse>(
        "PUT",
        `/api/items/x20-row-${i}`,
        {
          blockId: "x20-block",
          kind: "note",
          position,
          text: `zeile-${i}`,
          heading: null,
        },
      );
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

describe("list points (list_mark on a note, like heading)", () => {
  it("stores a list point and returns it in the page", async () => {
    const db = await getTestDb();
    await seedSpace(db, "lp-space");
    await seedPage(db, "lp-page", "lp-space");
    await seedBlock(db, "lp-block", "lp-page");

    const put = await json<ItemWriteResponse>("PUT", "/api/items/lp-note", {
      blockId: "lp-block",
      kind: "note",
      position: 1000,
      text: "Punkt",
      heading: null,
      listMark: "-",
    });
    expect(put.status).toBe(200);
    expect(put.body.row).toMatchObject({
      kind: "note",
      text: "Punkt",
      listMark: "-",
    });

    const page = await json<PageResponse>("GET", "/api/pages/lp-page");
    expect(page.body.blocks[0]!.items[0]).toMatchObject({
      id: "lp-note",
      listMark: "-",
    });
  });

  it("rejects a list mark on a task and a list mark next to a heading (400)", async () => {
    const db = await getTestDb();
    await seedSpace(db, "lpr-space");
    await seedPage(db, "lpr-page", "lpr-space");
    await seedBlock(db, "lpr-block", "lpr-page");

    const onTask = await json<ErrorBody>("PUT", "/api/items/lpr-task", {
      blockId: "lpr-block",
      kind: "task",
      position: 1000,
      text: "t",
      dueDate: null,
      assigneeSpaceId: null,
      listMark: "*",
    });
    expect(onTask.status).toBe(400);
    expect(onTask.body.error.issues).toEqual([
      { path: "listMark", code: "list_only_on_note" },
    ]);

    const withHeading = await json<ErrorBody>("PUT", "/api/items/lpr-note", {
      blockId: "lpr-block",
      kind: "note",
      position: 1000,
      text: "x",
      heading: 1,
      listMark: "*",
    });
    expect(withHeading.status).toBe(400);
    expect(withHeading.body.error.issues).toEqual([
      { path: "heading", code: "list_and_heading" },
    ]);
  });

  it("rejects making a stored list point a heading via PATCH (400)", async () => {
    const db = await getTestDb();
    await seedSpace(db, "lpp-space");
    await seedPage(db, "lpp-page", "lpp-space");
    await seedBlock(db, "lpp-block", "lpp-page");
    await createItem(
      db,
      {
        id: "lpp-note",
        blockId: "lpp-block",
        position: 1000,
        kind: "note",
        text: "Punkt",
        heading: null,
        listMark: "-",
      },
      NOW,
    );

    const { status, body } = await json<ErrorBody>(
      "PATCH",
      "/api/items/lpp-note",
      { heading: 1 },
    );
    expect(status).toBe(400);
    expect(body.error.issues).toEqual([
      { path: "heading", code: "list_and_heading" },
    ]);
  });
});
