import { useEffect, useState } from "react";
import type { SpaceWithPages } from "../shared/api.ts";
import type { SpaceKind } from "../shared/db.ts";
import type { BlockPatch, ItemPatch, TemplatePatch } from "../shared/schemas.ts";
import { Dates } from "./components/Dates.tsx";
import { Header } from "./components/Header.tsx";
import { MobileHeader } from "./components/MobileHeader.tsx";
import { MobilePages } from "./components/MobilePages.tsx";
import { Notifications } from "./components/Notifications.tsx";
import { SearchResults } from "./components/SearchResults.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { Stream } from "./components/Stream.tsx";
import { TabBar, type MobileTab } from "./components/TabBar.tsx";
import { Today } from "./components/Today.tsx";
import { formatError } from "./components/errorText.ts";
import { LoadError, Loading } from "./components/status.tsx";
import { monthLedger } from "./domain/calendar.ts";
import { toISODate } from "./domain/dates.ts";
import { detectHeading } from "./domain/headings.ts";
import { newBlockId, newItemId, newPageId, newSpaceId, newTemplateId } from "./domain/ids.ts";
import { deriveShort } from "./domain/naming.ts";
import { readScope, writeScope, type TodayScope } from "./domain/preferences.ts";
import type { ItemCreateInput } from "./state/operations.ts";
import {
  selectCalendar,
  selectCalendarView,
  selectMeSpaceId,
  selectOpenTaskCounts,
  selectOverviewView,
  selectPageBlocks,
  selectPageView,
  selectPersonOpenCount,
  selectPersonOverview,
  selectSearch,
  selectSpaces,
  selectSpacesView,
  selectTeamOverview,
  selectTemplates,
} from "./state/selectors.ts";
import { useApp } from "./state/useApp.ts";
import styles from "./App.module.css";

type NotizenLevel = "spaces" | "pages" | "stream";

/** The mobile navigation snapshot kept in the browser history (docs/adr/0012). */
interface MobileNavState {
  mTab: MobileTab;
  nLevel: NotizenLevel;
  spaceId: string | null;
  pageId: string | "mirror" | null;
}

export function App() {
  const { state, ops } = useApp();

  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | "mirror" | null>(null);
  const [pane, setPane] = useState<"today" | "spaces" | "stream" | "dates">("today");
  const todayDate = new Date();
  const today = toISODate(todayDate);
  const [month, setMonth] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  const [jump, setJump] = useState<{ blockId: string; pageId: string; focusComposer?: boolean } | null>(null);
  const [bootRetries, setBootRetries] = useState(0);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<TodayScope>(() => readScope());
  const MAX_BOOT_RETRIES = 10;

  // The mobile layout is a distinct shape below 860px (docs/adr/0012): a tab
  // bar instead of the desktop columns, and a drill-down with history for
  // Notizen. The same value must be used by the CSS media queries.
  const [narrow, setNarrow] = useState(false);
  const [mTab, setMTab] = useState<MobileTab>("heute");
  const [nLevel, setNLevel] = useState<NotizenLevel>("spaces");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Anchor the app's own history trail so the in-app back button and the
  // browser back gesture never leave the page.
  useEffect(() => {
    window.history.replaceState({ mTab: "heute", nLevel: "spaces", spaceId: null, pageId: null }, "");
  }, []);

  // Browser back/forward restores the mobile navigation snapshot.
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const nav = event.state as Partial<MobileNavState> | null;
      if (!nav || typeof nav.mTab !== "string") return;
      if (nav.mTab) setMTab(nav.mTab);
      if (nav.nLevel) setNLevel(nav.nLevel);
      if (nav.spaceId !== undefined) setSpaceId(nav.spaceId);
      if (nav.pageId !== undefined) setPageId(nav.pageId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /** A mobile navigation: update the state and record it in the history. */
  const commitNav = (next: Partial<MobileNavState>) => {
    const nav: MobileNavState = {
      mTab: next.mTab ?? mTab,
      nLevel: next.nLevel ?? nLevel,
      spaceId: next.spaceId !== undefined ? next.spaceId : spaceId,
      pageId: next.pageId !== undefined ? next.pageId : pageId,
    };
    setMTab(nav.mTab);
    setNLevel(nav.nLevel);
    setSpaceId(nav.spaceId);
    setPageId(nav.pageId);
    window.history.pushState(nav, "");
  };

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

  // The task overview is the start view and backs the person view — loaded
  // once, refreshed when the local date rolls over.
  useEffect(() => {
    void ops.loadOverview(today);
  }, [today, ops]);

  // Load the active page. The person view ("Zugewiesen") needs no per-space
  // load — it renders from the overview. The gate differs by layout: desktop
  // loads whenever a pane other than "today" is open; mobile only at the
  // Notizen stream level.
  useEffect(() => {
    if (narrow) {
      if (nLevel === "stream" && activePageId !== null) void ops.loadPage(activePageId);
      return;
    }
    if (pane === "today") return;
    if (activePageId !== null) void ops.loadPage(activePageId);
  }, [pane, activePageId, nLevel, narrow, ops]);

  // Load the calendar window for the displayed month.
  useEffect(() => {
    void ops.loadCalendar(monthFrom, monthTo);
  }, [monthFrom, monthTo, ops]);

  // Debounced live search: fire a request once the input has settled, and a
  // blank input resets the view immediately. Out-of-order responses are
  // dropped inside ops.search, so rapid typing cannot show stale results.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === "") {
      ops.clearSearch();
      return;
    }
    const timer = window.setTimeout(() => void ops.search(trimmed), 200);
    return () => window.clearTimeout(timer);
  }, [query, ops]);

  const spacesView = selectSpacesView(state);
  const calendarView = selectCalendarView(state);
  const overviewView = selectOverviewView(state);
  const meSpaceId = selectMeSpaceId();

  // Boot resilience: in dev the worker comes up a few seconds after Vite, so
  // the first requests can be lost while it is still starting. Retry any view
  // that is not loaded yet, a few times with a delay; the app heals itself
  // once the API is reachable. Gives up after the cap — the manual
  // "Erneut versuchen" buttons remain the last resort.
  useEffect(() => {
    if (bootRetries >= MAX_BOOT_RETRIES) return;
    const page = activePageId !== null ? selectPageView(state, activePageId) : null;
    const pageNeeded = narrow ? nLevel === "stream" : pane !== "today";
    const pending =
      spacesView.status !== "loaded" ||
      overviewView.status !== "loaded" ||
      (pageNeeded && page !== null && page.status !== "loaded") ||
      calendarView.status !== "loaded";
    if (!pending) return;

    const timer = window.setTimeout(() => {
      if (spacesView.status !== "loaded") void ops.loadSpaces();
      if (overviewView.status !== "loaded") void ops.loadOverview(today);
      if (pageNeeded && activePageId !== null && page !== null && page.status !== "loaded") {
        void ops.loadPage(activePageId);
      }
      if (calendarView.status !== "loaded") void ops.loadCalendar(monthFrom, monthTo);
      setBootRetries((n) => n + 1);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [
    bootRetries,
    spacesView,
    calendarView,
    overviewView,
    activePageId,
    pane,
    nLevel,
    narrow,
    today,
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
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        if (jump.focusComposer) document.getElementById(`composer-${jump.blockId}`)?.focus();
      }
      setJump(null);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [jump, resolvedPageId, pageViewStatus]);

  // If the selected space disappears (deleted), move to another one — on
  // mobile back to the spaces list.
  const deleteSpace = (id: string) => {
    ops.deleteSpace(id);
    if (resolvedSpaceId === id) {
      setJump(null);
      if (narrow) {
        commitNav({ nLevel: "spaces", spaceId: null, pageId: null });
        return;
      }
      const next = defaultSpace(spaces.filter((entry) => entry.id !== id));
      if (next) {
        setSpaceId(next.id);
        setPageId(next.kind === "person" ? "mirror" : (next.pages[0]?.id ?? null));
      } else {
        setSpaceId(null);
        setPageId(null);
      }
    }
  };

  const pageBlocks = activePageId !== null ? selectPageBlocks(state, activePageId) : [];
  const teamView = selectTeamOverview(state, today, scope, meSpaceId, spaces);
  const personView =
    isPerson && activeSpaceId !== null ? selectPersonOverview(state, today, activeSpaceId, spaces) : null;
  const calendar = selectCalendar(state, monthFrom, monthTo);
  const ledger = monthLedger(calendar, monthFrom, monthTo);

  // A non-blank search query replaces the stream column with its results
  // (prototype behavior); clearing it hands the column back to the pane.
  const searchActive = query.trim() !== "";
  const searchView = selectSearch(state);

  const people = spaces.filter((entry) => entry.kind === "person");
  const topics = spaces.filter((entry) => entry.kind === "topic");

  const openCounts = selectOpenTaskCounts(state);
  const overdueCount = teamView.overdue.length;

  const templatesById = new Map(templates.map((entry) => [entry.id, entry]));
  const spacesById = new Map(spaces.map((entry) => [entry.id, entry]));

  // Selecting a space: on desktop switch the pane to the stream; on mobile
  // descend to the pages level of the Notizen drill-down.
  const selectSpace = (id: string) => {
    const next = spaces.find((entry) => entry.id === id);
    if (!next) return;
    const nextPageId: string | "mirror" | null = next.kind === "person" ? "mirror" : (next.pages[0]?.id ?? null);
    setJump(null);
    if (narrow) {
      commitNav({ nLevel: "pages", spaceId: id, pageId: nextPageId });
    } else {
      setSpaceId(id);
      setPageId(nextPageId);
      setPane("stream");
    }
  };

  const selectPage = (id: string | "mirror") => {
    setJump(null);
    if (narrow) {
      commitNav({ nLevel: "stream", pageId: id });
    } else {
      setPageId(id);
      setPane("stream");
    }
  };

  const goHome = () => {
    setPane("today");
    setJump(null);
    setQuery("");
  };

  const patchBlock = (id: string, patch: BlockPatch) => void ops.updateBlock(id, patch);
  const patchItem = (id: string, patch: ItemPatch) => void ops.updateItem(id, patch);
  const createItem = (input: ItemCreateInput) => void ops.createItem(input);
  const deleteItem = (id: string) => void ops.deleteItem(id);

  const createSpace = async (kind: SpaceKind, rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    const id = newSpaceId();
    const pageId = newPageId();
    const nextPageId: string | "mirror" = kind === "person" ? "mirror" : pageId;
    // Select the new space synchronously, before any await — otherwise the
    // async continuation could revert a selection the user already changed.
    setJump(null);
    if (narrow) {
      commitNav({ mTab: "notizen", nLevel: "stream", spaceId: id, pageId: nextPageId });
    } else {
      setSpaceId(id);
      setPageId(nextPageId);
      setPane("stream");
    }
    // The page references the space, so its PUT must not race the space's
    // (both rows are optimistic already; the page's request follows once
    // the space is confirmed on the server).
    const space = ops.createSpace({ id, name, kind, short: deriveShort(name) });
    await space;
    ops.createPage({ id: pageId, spaceId: id, title: "Notizen" });
  };

  const createPage = (rawTitle: string) => {
    const title = rawTitle.trim();
    if (title === "" || activeSpaceId === null) return;
    const pageId = newPageId();
    ops.createPage({ id: pageId, spaceId: activeSpaceId, title });
    if (narrow) {
      commitNav({ nLevel: "stream", pageId });
    } else {
      setPageId(pageId);
    }
  };

  const renamePage = (id: string, rawTitle: string) => {
    const title = rawTitle.trim();
    if (title !== "") ops.updatePage(id, { title });
  };

  const deletePage = (id: string) => {
    ops.deletePage(id);
    // If the active page goes away, switch to another one — the mirror for a
    // person space, otherwise the next remaining page (or none).
    if (resolvedPageId === id && space) {
      const next = space.pages.find((entry) => entry.id !== id);
      if (next) setPageId(next.id);
      else setPageId(isPerson ? "mirror" : null);
    }
  };

  const deleteBlock = (id: string) => void ops.deleteBlock(id);

  const createBlock = async (templateId: string | null) => {
    if (activePageId === null) return;
    const template = templates.find((entry) => entry.id === templateId);
    const blockId = newBlockId();
    // The seed items reference the block, so their PUTs must not race the
    // block's create — the block is confirmed first, then the items.
    await ops.createBlock({
      id: blockId,
      pageId: activePageId,
      templateId,
      title: `Neuer ${template?.label ?? "Block"}`,
      date: toISODate(new Date()),
    });
    for (const [index, line] of (template?.seed ?? []).entries()) {
      const detected = detectHeading(line);
      ops.createItem({
        id: newItemId(),
        blockId,
        kind: "note",
        position: 1000 * (index + 1),
        text: detected?.text ?? line,
        heading: detected?.heading ?? null,
      });
    }
    setJump({ blockId, pageId: activePageId, focusComposer: true });
  };

  const createTemplate = () => {
    ops.createTemplate({ id: newTemplateId(), label: "Neues Template", hue: "ink", seed: [] });
  };

  const updateTemplate = (id: string, patch: TemplatePatch) => void ops.updateTemplate(id, patch);
  const deleteTemplate = (id: string) => void ops.deleteTemplate(id);

  const jumpToBlock = (blockId: string) => {
    const block = state.blocks.get(blockId);
    if (!block) return;
    const page = state.pages.get(block.pageId);
    setJump({ blockId, pageId: block.pageId });
    setQuery("");
    if (narrow) {
      commitNav({
        mTab: "notizen",
        nLevel: "stream",
        spaceId: page?.spaceId ?? spaceId,
        pageId: page?.id ?? block.pageId,
      });
    } else {
      if (page) setSpaceId(page.spaceId);
      setPageId(block.pageId);
      setPane("stream");
    }
  };

  // A search hit or an overview row points into pages that are usually not
  // loaded yet, so the jump navigates by the row's own ids instead of
  // resolving through state.
  const jumpToTarget = (blockId: string, pageId: string, spaceId: string) => {
    setJump({ blockId, pageId });
    setQuery("");
    if (narrow) {
      commitNav({ mTab: "notizen", nLevel: "stream", spaceId, pageId });
    } else {
      setSpaceId(spaceId);
      setPageId(pageId);
      setPane("stream");
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // On tablet screens the panes are mutually exclusive; show the results.
    if (value.trim() !== "") setPane("stream");
  };

  const handleScopeChange = (next: TodayScope) => {
    setScope(next);
    writeScope(next);
  };

  const shiftMonth = (delta: number) =>
    setMonth((current) => {
      const date = new Date(current.year, current.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });

  const mobileTab = (tab: MobileTab) => commitNav({ mTab: tab });
  const mobileBack = () => window.history.back();

  const renderSearchResults = () =>
    searchView.view.status === "failed" ? (
      <LoadError message={formatError(searchView.view.error)} onRetry={() => void ops.search(searchView.query)} />
    ) : searchView.results ? (
      <SearchResults response={searchView.results} onJumpToBlock={jumpToTarget} onClear={() => setQuery("")} />
    ) : (
      <Loading label="Suche läuft…" />
    );

  const renderToday = (showHead: boolean) => (
    <Today
      viewStatus={overviewView}
      taskView={teamView}
      today={today}
      scope={scope}
      meSpaceId={meSpaceId}
      spacesById={spacesById}
      showHead={showHead}
      onScopeChange={handleScopeChange}
      onToggle={(id, done) => patchItem(id, { done })}
      onJumpToBlock={jumpToTarget}
      onRetry={() => void ops.loadOverview(today)}
    />
  );

  // The block stream is the same on mobile and desktop (docs/adr/0012) — it
  // is deliberately not reworked here.
  const renderStream = (s: SpaceWithPages, selectedPageId: string | "mirror") => (
    <Stream
      space={s}
      selectedPageId={selectedPageId}
      isPerson={isPerson}
      pageBlocks={pageBlocks}
      personView={personView}
      overviewView={overviewView}
      today={today}
      meSpaceId={meSpaceId}
      templates={templates}
      templatesById={templatesById}
      spacesById={spacesById}
      blocksById={state.blocks}
      spaces={spaces}
      todayDate={todayDate}
      pageView={selectPageView(state, selectedPageId)}
      pulseBlockId={jump?.blockId ?? null}
      onSelectPage={selectPage}
      onPatchBlock={patchBlock}
      onPatchItem={patchItem}
      onCreateItem={createItem}
      onDeleteItem={deleteItem}
      onJumpToBlock={jumpToBlock}
      onJumpToOverviewRow={jumpToTarget}
      onRetryPage={() => void ops.loadPage(selectedPageId)}
      onRetryOverview={() => void ops.loadOverview(today)}
      onCreatePage={createPage}
      onRenamePage={renamePage}
      onDeletePage={deletePage}
      onCreateBlock={createBlock}
      onDeleteBlock={deleteBlock}
      onCreateTemplate={createTemplate}
      onUpdateTemplate={updateTemplate}
      onDeleteTemplate={deleteTemplate}
    />
  );

  // ============================================================
  // Mobile layout (< 860px): header, sheet, tab bar — no date column.
  // ============================================================
  if (narrow) {
    return (
      <div className={styles.mapp}>
        <MobileHeader
          mTab={mTab}
          nLevel={nLevel}
          spaceName={space?.name ?? ""}
          pageTitle={activePageId !== null ? (state.pages.get(activePageId)?.title ?? "") : ""}
          mirrorMode={mirrorMode}
          query={query}
          onQueryChange={handleQueryChange}
          onBack={mobileBack}
        />

        <main className={styles.msheet}>
          {mTab === "heute" && renderToday(false)}

          {mTab === "notizen" && nLevel === "spaces" &&
            (spacesView.status === "idle" || spacesView.status === "loading" ? (
              <Loading label="Bereiche werden geladen…" />
            ) : spacesView.status === "failed" ? (
              <LoadError message={formatError(spacesView.error)} onRetry={() => void ops.loadSpaces()} />
            ) : (
              <Sidebar
                people={people}
                topics={topics}
                openCounts={openCounts}
                selectedSpaceId={activeSpaceId}
                overdueCount={overdueCount}
                homeActive={false}
                showHome={false}
                onHome={goHome}
                onSelectSpace={selectSpace}
                onCreateSpace={createSpace}
                onDeleteSpace={deleteSpace}
              />
            ))}

          {mTab === "notizen" && nLevel === "pages" && (
            <MobilePages
              space={space}
              pages={pages}
              openCount={isPerson && activeSpaceId !== null ? selectPersonOpenCount(state, activeSpaceId) : 0}
              onPickPage={selectPage}
              onAddPage={createPage}
            />
          )}

          {mTab === "notizen" && nLevel === "stream" &&
            (spacesView.status === "failed" ? (
              <LoadError message={formatError(spacesView.error)} onRetry={() => void ops.loadSpaces()} />
            ) : spacesView.status === "idle" || spacesView.status === "loading" ? (
              <Loading />
            ) : space === null ? (
              <p className={styles.empty}>Noch keine Bereiche. Sobald der erste Bereich angelegt ist, erscheint er hier.</p>
            ) : resolvedPageId === null ? (
              <p className={styles.empty}>Dieser Bereich hat noch keine Seite.</p>
            ) : (
              renderStream(space, resolvedPageId)
            ))}

          {mTab === "suche" &&
            (searchActive ? renderSearchResults() : (
              <p className={styles.mempty}>Suche nach Blocktiteln, Notizzeilen, Tasks oder Terminen.</p>
            ))}
        </main>

        <TabBar tab={mTab} overdueCount={overdueCount} onTab={mobileTab} />

        <Notifications notifications={state.notifications} onDismiss={(id) => ops.dismissNotification(id)} />
      </div>
    );
  }

  // ============================================================
  // Desktop / tablet layout: header, three columns (or panebar below 980px).
  // ============================================================
  return (
    <div className={styles.app}>
      <Header query={query} onQueryChange={handleQueryChange} />

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
              selectedSpaceId={pane === "today" ? null : activeSpaceId}
              overdueCount={overdueCount}
              homeActive={pane === "today"}
              onHome={goHome}
              onSelectSpace={selectSpace}
              onCreateSpace={createSpace}
              onDeleteSpace={deleteSpace}
            />
          )}
        </aside>

        <main className={`${styles.col} ${styles.stream} ${pane === "stream" || pane === "today" ? styles.open : ""}`}>
          {searchActive ? (
            renderSearchResults()
          ) : pane === "today" ? (
            renderToday(true)
          ) : spacesView.status === "failed" ? (
            <LoadError message={formatError(spacesView.error)} onRetry={() => void ops.loadSpaces()} />
          ) : spacesView.status === "idle" || spacesView.status === "loading" ? (
            <Loading />
          ) : space === null ? (
            <p className={styles.empty}>Noch keine Bereiche. Sobald der erste Bereich angelegt ist, erscheint er hier.</p>
          ) : resolvedPageId === null ? (
            <p className={styles.empty}>Dieser Bereich hat noch keine Seite.</p>
          ) : (
            renderStream(space, resolvedPageId)
          )}
        </main>

        <aside className={`${styles.col} ${pane === "dates" ? styles.open : ""}`}>
          <Dates
            month={month}
            view={calendarView}
            ledger={ledger}
            today={today}
            spacesById={spacesById}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            onJumpToBlock={jumpToBlock}
            onReschedule={(id, patch) => patchItem(id, patch)}
            onRetry={() => void ops.loadCalendar(monthFrom, monthTo)}
          />
        </aside>
      </div>

      <nav className={styles.panebar} aria-label="Ansicht wählen">
        <button type="button" className={pane === "today" ? styles.paneOn : undefined} onClick={goHome}>
          Heute
        </button>
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
