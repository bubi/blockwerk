import { useEffect, useState } from "react";
import type { SpaceWithPages } from "../shared/api.ts";
import type { BlockPatch, ItemPatch } from "../shared/schemas.ts";
import { Dates } from "./components/Dates.tsx";
import { Header } from "./components/Header.tsx";
import { Notifications } from "./components/Notifications.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { Stream } from "./components/Stream.tsx";
import { formatError } from "./components/errorText.ts";
import { LoadError, Loading } from "./components/status.tsx";
import { monthLedger } from "./domain/calendar.ts";
import { toISODate } from "./domain/dates.ts";
import type { ItemCreateInput } from "./state/operations.ts";
import {
  selectCalendar,
  selectCalendarView,
  selectMirror,
  selectMirrorGroups,
  selectMirrorView,
  selectPageBlocks,
  selectPageView,
  selectSpaces,
  selectSpacesView,
  selectTemplates,
} from "./state/selectors.ts";
import { useApp } from "./state/useApp.ts";
import styles from "./App.module.css";

export function App() {
  const { state, ops } = useApp();

  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | "mirror" | null>(null);
  const [pane, setPane] = useState<"spaces" | "stream" | "dates">("stream");
  const todayDate = new Date();
  const [month, setMonth] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  const [jump, setJump] = useState<{ blockId: string; pageId: string } | null>(null);
  const [bootRetries, setBootRetries] = useState(0);
  const MAX_BOOT_RETRIES = 10;

  const spaces = selectSpaces(state);
  const templates = selectTemplates(state);
  // Null means "no explicit choice yet" — fall back to the first topic space.
  const resolvedSpaceId = spaceId ?? defaultSpace(spaces)?.id ?? null;
  const space = resolvedSpaceId !== null ? (spaces.find((entry) => entry.id === resolvedSpaceId) ?? null) : null;
  const isPerson = space?.kind === "person";
  const activeSpaceId = resolvedSpaceId;
  const pages = space?.pages ?? [];

  const resolvedPageId: string | "mirror" | null =
    space === null
      ? null
      : pageId === "mirror" && isPerson
        ? "mirror"
        : pageId !== null && pageId !== "mirror" && pages.some((page) => page.id === pageId)
          ? pageId
          : isPerson
            ? "mirror"
            : (pages[0]?.id ?? null);

  const mirrorMode = resolvedPageId === "mirror";
  const activePageId = resolvedPageId !== null && !mirrorMode ? resolvedPageId : null;

  const monthFrom = toISODate(new Date(month.year, month.month, 1));
  const monthTo = toISODate(new Date(month.year, month.month + 1, 0));

  // Load the spaces index once.
  useEffect(() => {
    void ops.loadSpaces();
  }, [ops]);

  // Load the active page or mirror.
  useEffect(() => {
    if (activeSpaceId === null) return;
    if (mirrorMode) void ops.loadMirror(activeSpaceId);
    else if (activePageId !== null) void ops.loadPage(activePageId);
  }, [activeSpaceId, activePageId, mirrorMode, ops]);

  // Load the calendar window for the displayed month.
  useEffect(() => {
    void ops.loadCalendar(monthFrom, monthTo);
  }, [monthFrom, monthTo, ops]);

  const spacesView = selectSpacesView(state);
  const calendarView = selectCalendarView(state);

  // Boot resilience: in dev the worker comes up a few seconds after Vite, so
  // the first requests can be lost while it is still starting. Retry any view
  // that is not loaded yet, a few times with a delay; the app heals itself
  // once the API is reachable. Gives up after the cap — the manual
  // "Erneut versuchen" buttons remain the last resort.
  useEffect(() => {
    if (bootRetries >= MAX_BOOT_RETRIES) return;
    const page = activePageId !== null ? selectPageView(state, activePageId) : null;
    const mirror = mirrorMode && activeSpaceId !== null ? selectMirrorView(state, activeSpaceId) : null;
    const pending =
      spacesView.status !== "loaded" ||
      (page !== null && page.status !== "loaded") ||
      (mirror !== null && mirror.status !== "loaded") ||
      calendarView.status !== "loaded";
    if (!pending) return;

    const timer = window.setTimeout(() => {
      if (spacesView.status !== "loaded") void ops.loadSpaces();
      if (activePageId !== null && page !== null && page.status !== "loaded") void ops.loadPage(activePageId);
      if (activeSpaceId !== null && mirror !== null && mirror.status !== "loaded") void ops.loadMirror(activeSpaceId);
      if (calendarView.status !== "loaded") void ops.loadCalendar(monthFrom, monthTo);
      setBootRetries((n) => n + 1);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [
    bootRetries,
    spacesView,
    calendarView,
    activePageId,
    activeSpaceId,
    mirrorMode,
    monthFrom,
    monthTo,
    state,
    ops,
  ]);

  // After a jump, scroll to the block once its page is loaded.
  const pageViewStatus = activePageId !== null ? selectPageView(state, activePageId).status : "idle";
  useEffect(() => {
    if (!jump || resolvedPageId !== jump.pageId || pageViewStatus !== "loaded") return;
    const timer = window.setTimeout(() => {
      const element = document.getElementById(`blk-${jump.blockId}`);
      if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
      setJump(null);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [jump, resolvedPageId, pageViewStatus]);

  const pageBlocks = activePageId !== null ? selectPageBlocks(state, activePageId) : [];
  const mirrorGroups = isPerson && activeSpaceId !== null ? selectMirrorGroups(state, activeSpaceId) : [];
  const mirrorView = isPerson && activeSpaceId !== null ? selectMirrorView(state, activeSpaceId) : null;
  const calendar = selectCalendar(state, monthFrom, monthTo);
  const ledger = monthLedger(calendar, monthFrom, monthTo);
  const today = toISODate(new Date());

  const people = spaces.filter((entry) => entry.kind === "person");
  const topics = spaces.filter((entry) => entry.kind === "topic");

  const openCounts = new Map<string, number>();
  for (const entry of spaces) {
    const view = state.mirrorViews.get(entry.id);
    if (view?.status === "loaded") openCounts.set(entry.id, selectMirror(state, entry.id).length);
  }

  const templatesById = new Map(templates.map((entry) => [entry.id, entry]));
  const spacesById = new Map(spaces.map((entry) => [entry.id, entry]));

  const selectSpace = (id: string) => {
    const next = spaces.find((entry) => entry.id === id);
    if (!next) return;
    setSpaceId(id);
    setPageId(next.kind === "person" ? "mirror" : (next.pages[0]?.id ?? null));
    setJump(null);
    setPane("stream");
  };

  const selectPage = (id: string | "mirror") => {
    setPageId(id);
    setJump(null);
    setPane("stream");
  };

  const patchBlock = (id: string, patch: BlockPatch) => void ops.updateBlock(id, patch);
  const patchItem = (id: string, patch: ItemPatch) => void ops.updateItem(id, patch);
  const createItem = (input: ItemCreateInput) => void ops.createItem(input);
  const deleteItem = (id: string) => void ops.deleteItem(id);

  const jumpToBlock = (blockId: string) => {
    const block = state.blocks.get(blockId);
    if (!block) return;
    const page = state.pages.get(block.pageId);
    if (page) {
      setSpaceId(page.spaceId);
      setPageId(page.id);
    } else {
      setPageId(block.pageId);
    }
    setPane("stream");
    setJump({ blockId, pageId: block.pageId });
  };

  const shiftMonth = (delta: number) =>
    setMonth((current) => {
      const date = new Date(current.year, current.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });

  return (
    <div className={styles.app}>
      <Header />

      <div className={styles.grid}>
        <aside className={`${styles.col} ${pane === "spaces" ? styles.open : ""}`}>
          {spacesView.status === "idle" || spacesView.status === "loading" ? (
            <Loading label="Bereiche werden geladen…" />
          ) : spacesView.status === "failed" ? (
            <LoadError message={formatError(spacesView.error)} onRetry={() => void ops.loadSpaces()} />
          ) : (
            <Sidebar
              people={people}
              topics={topics}
              openCounts={openCounts}
              selectedSpaceId={activeSpaceId}
              onSelectSpace={selectSpace}
            />
          )}
        </aside>

        <main className={`${styles.col} ${styles.stream} ${pane === "stream" ? styles.open : ""}`}>
          {spacesView.status === "failed" ? (
            <LoadError message={formatError(spacesView.error)} onRetry={() => void ops.loadSpaces()} />
          ) : spacesView.status === "idle" || spacesView.status === "loading" ? (
            <Loading />
          ) : space === null ? (
            <p className={styles.empty}>Noch keine Bereiche. Sobald der erste Bereich angelegt ist, erscheint er hier.</p>
          ) : resolvedPageId === null ? (
            <p className={styles.empty}>Dieser Bereich hat noch keine Seite.</p>
          ) : (
            <Stream
              space={space}
              selectedPageId={resolvedPageId}
              isPerson={isPerson}
              pageBlocks={pageBlocks}
              mirrorGroups={mirrorGroups}
              templatesById={templatesById}
              spacesById={spacesById}
              blocksById={state.blocks}
              spaces={spaces}
              today={todayDate}
              pageView={selectPageView(state, resolvedPageId)}
              mirrorView={mirrorView ?? { status: "idle" }}
              pulseBlockId={jump?.blockId ?? null}
              onSelectPage={selectPage}
              onPatchBlock={patchBlock}
              onPatchItem={patchItem}
              onCreateItem={createItem}
              onDeleteItem={deleteItem}
              onJumpToBlock={jumpToBlock}
              onRetryPage={() => resolvedPageId !== "mirror" && void ops.loadPage(resolvedPageId)}
              onRetryMirror={() => activeSpaceId !== null && void ops.loadMirror(activeSpaceId)}
            />
          )}
        </main>

        <aside className={`${styles.col} ${pane === "dates" ? styles.open : ""}`}>
          <Dates
            month={month}
            view={calendarView}
            ledger={ledger}
            today={today}
            spacesById={spacesById}
            templatesById={templatesById}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            onJumpToBlock={jumpToBlock}
            onRetry={() => void ops.loadCalendar(monthFrom, monthTo)}
          />
        </aside>
      </div>

      <nav className={styles.panebar} aria-label="Ansicht wählen">
        <button type="button" className={pane === "spaces" ? styles.paneOn : undefined} onClick={() => setPane("spaces")}>
          Bereiche
        </button>
        <button type="button" className={pane === "stream" ? styles.paneOn : undefined} onClick={() => setPane("stream")}>
          Stream
        </button>
        <button type="button" className={pane === "dates" ? styles.paneOn : undefined} onClick={() => setPane("dates")}>
          Datum
        </button>
      </nav>

      <Notifications notifications={state.notifications} onDismiss={(id) => ops.dismissNotification(id)} />
    </div>
  );
}

function defaultSpace(spaces: SpaceWithPages[]): SpaceWithPages | null {
  return (
    spaces.find((entry) => entry.kind === "topic" && entry.pages.length > 0) ??
    spaces.find((entry) => entry.pages.length > 0) ??
    spaces[0] ??
    null
  );
}
