import { describe, expect, it } from "vitest";
import { getTestDb } from "./testing/get-test-db.ts";
import { createBlock } from "./blocks.ts";
import { createItem } from "./items.ts";
import { createPage } from "./pages.ts";
import { createSpace } from "./spaces.ts";
import { loadOverview } from "./overview.ts";

const NOW = 1_754_000_000_000;
const TODAY = "2026-08-10";

// The test DB is shared per file, so every test uses its own id prefix.
async function seed(db: D1Database, p: string) {
  await createSpace(db, { id: `${p}-lena`, name: "Lena", kind: "person", short: "LE" }, NOW);
  await createSpace(db, { id: `${p}-tomas`, name: "Tomas", kind: "person", short: "TO" }, NOW);
  await createSpace(db, { id: `${p}-topic`, name: "Topic", kind: "topic", short: "TO" }, NOW);
  await createPage(db, { id: `${p}-page`, spaceId: `${p}-topic`, title: "P" }, NOW);
  await createBlock(db, { id: `${p}-block`, pageId: `${p}-page`, templateId: null, title: "B", date: "2026-08-01" }, NOW);

  await createItem(db, { id: `${p}-open`, blockId: `${p}-block`, position: 1000, kind: "task", text: "offen", done: false, dueDate: "2026-08-01", assigneeSpaceId: `${p}-lena` }, NOW);
  await createItem(db, { id: `${p}-done`, blockId: `${p}-block`, position: 2000, kind: "task", text: "fertig", done: true, dueDate: "2026-08-01", assigneeSpaceId: `${p}-tomas` }, NOW);
  await createItem(db, { id: `${p}-later`, blockId: `${p}-block`, position: 3000, kind: "task", text: "später", done: false, dueDate: "2026-08-30", assigneeSpaceId: `${p}-tomas` }, NOW);
  await createItem(db, { id: `${p}-window`, blockId: `${p}-block`, position: 4000, kind: "event", text: "Termin", eventDate: "2026-08-12", eventTime: "10:00" }, NOW);
  await createItem(db, { id: `${p}-out`, blockId: `${p}-block`, position: 5000, kind: "event", text: "draußen", eventDate: "2026-08-30", eventTime: "10:00" }, NOW);
}

describe("loadOverview", () => {
  it("returns open tasks, window events, and only the backing blocks and pages", async () => {
    const db = await getTestDb();
    await seed(db, "ova");

    const overview = await loadOverview(db, TODAY);

    expect(overview.tasks.map((item) => item.id)).toEqual([`ova-open`, `ova-later`]);
    expect(overview.events.map((item) => item.id)).toEqual([`ova-window`]);
    expect(overview.blocks.map((block) => block.id)).toEqual([`ova-block`]);
    expect(overview.pages.map((page) => page.id)).toEqual([`ova-page`]);
  });

  it("grows with the data, not with the team size — blocks follow the referenced rows", async () => {
    const db = await getTestDb();
    await seed(db, "ovb");
    await createSpace(db, { id: "ovb-extra", name: "Extra", kind: "topic", short: "EX" }, NOW);
    await createPage(db, { id: "ovb-extra-page", spaceId: "ovb-extra", title: "E" }, NOW);
    await createBlock(db, { id: "ovb-extra-block", pageId: "ovb-extra-page", templateId: null, title: "E", date: "2026-08-01" }, NOW);
    for (let i = 0; i < 20; i++) {
      await createItem(db, { id: `ovb-many-${i}`, blockId: "ovb-extra-block", position: 1000 + i, kind: "task", text: "x", done: false, dueDate: null, assigneeSpaceId: null }, NOW);
    }

    const overview = await loadOverview(db, TODAY);
    expect(overview.tasks.filter((item) => item.id.startsWith("ovb-"))).toHaveLength(22);
    expect(overview.blocks.map((block) => block.id)).toEqual(
      expect.arrayContaining(["ovb-block", "ovb-extra-block"]),
    );
  });
});
