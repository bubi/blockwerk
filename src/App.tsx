import { useEffect, useState } from "react";
import type { SpaceWithPages } from "../shared/api.ts";
import type { SpaceKind } from "../shared/db.ts";
import type {
  BlockPatch,
  ItemPatch,
  TemplatePatch,
} from "../shared/schemas.ts";
import { Dates } from "./components/Dates.tsx";
import { Header } from "./components/Header.tsx";
import { MobileHeader } from "./components/MobileHeader.tsx";
import { MobilePages } from "./components/MobilePages.tsx";
import { Boot } from "./components/Boot.tsx";
import { Notifications } from "./components/Notifications.tsx";
import { SearchResults } from "./components/SearchResults.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { Stream } from "./components/Stream.tsx";
import { TabBar, type MobileTab } from "./components/TabBar.tsx";
import { TemplateManager } from "./components/TemplateManager.tsx";
import { Today } from "./components/Today.tsx";
import { formatError } from "./components/errorText.ts";
import { LoadError, Loading } from "./components/status.tsx";
import { monthLedger } from "./domain/calendar.ts";
import { fromISODate, refreshToday, toISODate } from "./domain/dates.ts";
import { detectHeading } from "./domain/headings.ts";
import {
  newBlockId,
  newItemId,
  newPageId,
  newSpaceId,
  newTemplateId,
} from "./domain/ids.ts";
import { deriveShort } from "./domain/naming.ts";
import {
  readScope,
  writeScope,
  type TodayScope,
} from "./domain/preferences.ts";
import type { PageSelection } from "./state/navigation.ts";
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
  pageId: PageSelection | null;
}

export function App() {
  const { state, ops } = useApp();

  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<PageSelection | null>(null);
  // The desktop stream column shows either the "Heute" start view or a
  // space's stream — the rail's "Heute" button toggles it (design-system 5).
  const [home, setHome] = useState(true);
  const { today, todayDate } = useToday();
  const [month, setMonth] = useState({
    year: todayDate.getFullYear(),
    month: todayDate.getMonth(),
  });
  const [jump, setJump] = useState<{
    blockId: string;
    pageId: string;
    focusComposer?: boolean;
  } | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
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
    window.history.replaceState(
      { mTab: "heute", nLevel: "spaces", spaceId: null, pageId: null },
      "",
    );
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
  const space =
    resolvedSpaceId !== null
      ? (spaces.find((entry) => entry.id === resolvedSpaceId) ?? null)
      : null;
  const isPerson = space?.kind === "person";
  const activeSpaceId = resolvedSpaceId;
  const pages = space?.pages ?? [];

  const resolvedPageId: PageSelection | null =
    space === null
      ? null
      : pageId !== null && validSelection(pageId, space)
        ? pageId
        : isPerson
          ? "tasks"
          : (pages[0]?.id ?? "jourfix");

  const tasksMode = resolvedPageId === "tasks";
  const jourfixMode = resolvedPageId === "jourfix";
  const activePageId =
    resolvedPageId !== null && !tasksMode && !jourfixMode
      ? resolvedPageId
      : null;

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

  // Load the active page. The person view ("Aufgaben") needs no per-space
  // load — it renders from the overview. The gate differs by layout: desktop
  // loads whenever a pane other than "today" is open; mobile only at the
  // Notizen stream level.
  useEffect(() => {
    if (narrow) {
      if (nLevel === "stream" && activePageId !== null)
        void ops.loadPage(activePageId);
      return;
    }
    if (home) return;
    if (activePageId !== null) void ops.loadPage(activePageId);
  }, [home, activePageId, nLevel, narrow, ops]);

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
  const meSpaceId = selectMeSpaceId(state);

  // Boot resilience: in dev the worker comes up a few seconds after Vite, so
  // the first requests can be lost while it is still starting. Retry any view
  // that is not loaded yet, a few times with a delay; the app heals itself
  // once the API is reachable. Gives up after the cap — the manual
  // "Erneut versuchen" buttons remain the last resort.
  useEffect(() => {
    if (bootRetries >= MAX_BOOT_RETRIES) return;
    const page =
      activePageId !== null ? selectPageView(state, activePageId) : null;
    const pageNeeded = narrow ? nLevel === "stream" : !home;
    const pending =
      spacesView.status !== "loaded" ||
      overviewView.status !== "loaded" ||
      (pageNeeded && page !== null && page.status !== "loaded") ||
      calendarView.status !== "loaded";
    if (!pending) return;

    const timer = window.setTimeout(() => {
      if (spacesView.status !== "loaded") void ops.loadSpaces();
      if (overviewView.status !== "loaded") void ops.loadOverview(today);
      if (
        pageNeeded &&
        activePageId !== null &&
        page !== null &&
        page.status !== "loaded"
      ) {
        void ops.loadPage(activePageId);
      }
      if (calendarView.status !== "loaded")
        void ops.loadCalendar(monthFrom, monthTo);
      setBootRetries((n) => n + 1);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [
    bootRetries,
    spacesView,
    calendarView,
    overviewView,
    activePageId,
    home,
    nLevel,
    narrow,
    today,
    monthFrom,
    monthTo,
    state,
    ops,
  ]);

  // After a jump, scroll to the block once its page is loaded.
  const pageViewStatus =
    activePageId !== null ? selectPageView(state, activePageId).status : "idle";
  useEffect(() => {
    if (!jump || resolvedPageId !== jump.pageId || pageViewStatus !== "loaded")
      return;
    const timer = window.setTimeout(() => {
      const element = document.getElementById(`blk-${jump.blockId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        if (jump.focusComposer)
          document.getElementById(`composer-${jump.blockId}`)?.focus();
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
        setPageId(
          next.kind === "person" ? "tasks" : (next.pages[0]?.id ?? "jourfix"),
        );
      } else {
        setSpaceId(null);
        setPageId(null);
      }
    }
  };

  const pageBlocks =
    activePageId !== null ? selectPageBlocks(state, activePageId) : [];
  const teamView = selectTeamOverview(state, today, scope, meSpaceId, spaces);
  const personView =
    isPerson && activeSpaceId !== null
      ? selectPersonOverview(state, today, activeSpaceId, spaces)
      : null;
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

  // The Tageskopf's fourth reading "erledigt in sieben Tagen" (design-system
  // 5): the data model has no done_at, so the moment a task is checked off is
  // tracked in this session only — it resets on reload and the tile degrades
  // to zero rather than claiming a server truth it does not have.
  const [doneAt, setDoneAt] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [weekCutoff] = useState(() => Date.now() - 7 * 86_400_000);
  const doneWeek = [...doneAt.values()].filter(
    (time) => time > weekCutoff,
  ).length;

  const templatesById = new Map(templates.map((entry) => [entry.id, entry]));
  const spacesById = new Map(spaces.map((entry) => [entry.id, entry]));

  // Selecting a space: on desktop switch the pane to the stream; on mobile
  // descend to the pages level of the Notizen drill-down.
  const selectSpace = (id: string) => {
    const next = spaces.find((entry) => entry.id === id);
    if (!next) return;
    const nextPageId: PageSelection =
      next.kind === "person" ? "tasks" : (next.pages[0]?.id ?? "jourfix");
    setJump(null);
    if (narrow) {
      commitNav({ nLevel: "pages", spaceId: id, pageId: nextPageId });
    } else {
      setSpaceId(id);
      setPageId(nextPageId);
      setHome(false);
    }
  };

  const selectPage = (id: PageSelection) => {
    setJump(null);
    if (narrow) {
      commitNav({ nLevel: "stream", pageId: id });
    } else {
      setPageId(id);
      setHome(false);
    }
  };

  const goHome = () => {
    setHome(true);
    setJump(null);
    setQuery("");
  };

  const patchBlock = (id: string, patch: BlockPatch) =>
    void ops.updateBlock(id, patch);
  const patchItem = (id: string, patch: ItemPatch) =>
    void ops.updateItem(id, patch);
  const createItem = (input: ItemCreateInput) => void ops.createItem(input);
  const deleteItem = (id: string) => void ops.deleteItem(id);

  const createSpace = async (
    kind: SpaceKind,
    rawName: string,
    rawEmail = "",
  ) => {
    const name = rawName.trim();
    if (!name) return;
    const email = rawEmail.trim() || null;
    const id = newSpaceId();
    const pageId = newPageId();
    const nextPageId: PageSelection = kind === "person" ? "tasks" : pageId;
    // Select the new space synchronously, before any await — otherwise the
    // async continuation could revert a selection the user already changed.
    setJump(null);
    if (narrow) {
      commitNav({
        mTab: "notizen",
        nLevel: "stream",
        spaceId: id,
        pageId: nextPageId,
      });
    } else {
      setSpaceId(id);
      setPageId(nextPageId);
      setHome(false);
    }
    // The page references the space, so its PUT must not race the space's
    // (both rows are optimistic already; the page's request follows once
    // the space is confirmed on the server).
    const space = ops.createSpace({
      id,
      name,
      kind,
      short: deriveShort(name),
      email,
    });
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
      setHome(false);
    }
  };

  const renamePage = (id: string, rawTitle: string) => {
    const title = rawTitle.trim();
    if (title !== "") ops.updatePage(id, { title });
  };

  const deletePage = (id: string) => {
    ops.deletePage(id);
    // If the active page goes away, switch to another one — the "Aufgaben"
    // entry for a person space, otherwise the next remaining page (or the
    // "Jour Fix" entry, which always exists for a topic).
    if (resolvedPageId === id && space) {
      const next = space.pages.find((entry) => entry.id !== id);
      if (next) setPageId(next.id);
      else setPageId(isPerson ? "tasks" : "jourfix");
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
    ops.createTemplate({
      id: newTemplateId(),
      label: "Neues Template",
      hue: "ink",
      seed: [],
    });
  };

  const updateTemplate = (id: string, patch: TemplatePatch) =>
    void ops.updateTemplate(id, patch);
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
      setHome(false);
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
      setHome(false);
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // A search query replaces the stream column with its results.
    if (value.trim() !== "") setHome(false);
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
      <LoadError
        message={formatError(searchView.view.error)}
        onRetry={() => void ops.search(searchView.query)}
      />
    ) : searchView.results ? (
      <SearchResults
        response={searchView.results}
        onJumpToBlock={jumpToTarget}
      />
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
      doneWeek={doneWeek}
      showHead={showHead}
      onScopeChange={handleScopeChange}
      onToggle={(id, done) => {
        if (done) {
          setDoneAt((previous) => {
            const next = new Map(previous);
            next.set(id, Date.now());
            return next;
          });
        } else {
          setDoneAt((previous) => {
            const next = new Map(previous);
            next.delete(id);
            return next;
          });
        }
        patchItem(id, { done });
      }}
      onJumpToBlock={jumpToTarget}
      onRetry={() => void ops.loadOverview(today)}
    />
  );

  // The block stream is the same on mobile and desktop (docs/adr/0012) — it
  // is deliberately not reworked here.
  const renderStream = (s: SpaceWithPages, selectedPageId: PageSelection) => (
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
      onPatchBlock={patchBlock}
      onPatchItem={patchItem}
      onCreateItem={createItem}
      onDeleteItem={deleteItem}
      onJumpToBlock={jumpToBlock}
      onJumpToOverviewRow={jumpToTarget}
      onRetryPage={() => void ops.loadPage(selectedPageId)}
      onRetryOverview={() => void ops.loadOverview(today)}
      onCreateBlock={createBlock}
      onDeleteBlock={deleteBlock}
      onManageTemplates={() => setTplOpen(true)}
    />
  );

  // ============================================================
  // Mobile layout (< 860px): header, sheet, tab bar — no date column.
  // ============================================================
  if (spacesView.status === "idle" || spacesView.status === "loading") {
    return <Boot />;
  }

  if (narrow) {
    return (
      <div className={styles.mapp}>
        <MobileHeader
          mTab={mTab}
          nLevel={nLevel}
          spaceName={space?.name ?? ""}
          pageTitle={
            activePageId !== null
              ? (state.pages.get(activePageId)?.title ?? "")
              : ""
          }
          selection={resolvedPageId}
          query={query}
          onQueryChange={handleQueryChange}
          onBack={mobileBack}
        />

        <main className={styles.msheet}>
          {mTab === "heute" && renderToday(true)}

          {mTab === "notizen" &&
            nLevel === "spaces" &&
            (spacesView.status === "failed" ? (
              <LoadError
                message={formatError(spacesView.error)}
                onRetry={() => void ops.loadSpaces()}
              />
            ) : (
              <Sidebar
                people={people}
                topics={topics}
                openCounts={openCounts}
                selectedSpaceId={activeSpaceId}
                selectedPage={resolvedPageId}
                overdueCount={overdueCount}
                meSpaceId={meSpaceId}
                homeActive={false}
                showHome={false}
                expandable={false}
                onHome={goHome}
                onSelectSpace={selectSpace}
                onSelectPage={selectPage}
                onCreatePage={createPage}
                onRenamePage={renamePage}
                onDeletePage={deletePage}
                onCreateSpace={createSpace}
                onDeleteSpace={deleteSpace}
                onManageTemplates={() => setTplOpen(true)}
              />
            ))}

          {mTab === "notizen" && nLevel === "pages" && (
            <MobilePages
              space={space}
              pages={pages}
              openCount={
                isPerson && activeSpaceId !== null
                  ? selectPersonOpenCount(state, activeSpaceId)
                  : 0
              }
              onPickPage={selectPage}
              onAddPage={createPage}
            />
          )}

          {mTab === "notizen" &&
            nLevel === "stream" &&
            (spacesView.status === "failed" ? (
              <LoadError
                message={formatError(spacesView.error)}
                onRetry={() => void ops.loadSpaces()}
              />
            ) : space === null ? (
              <p className="empty">
                Noch keine Bereiche. Sobald der erste Bereich angelegt ist,
                erscheint er hier.
              </p>
            ) : resolvedPageId === null ? (
              <p className="empty">Dieser Bereich hat noch keine Seite.</p>
            ) : (
              renderStream(space, resolvedPageId)
            ))}

          {mTab === "suche" &&
            (searchActive ? (
              renderSearchResults()
            ) : (
              <p className="empty">
                Suche nach Blocktiteln, Notizzeilen, Tasks oder Terminen.
              </p>
            ))}
        </main>

        <TabBar tab={mTab} overdueCount={overdueCount} onTab={mobileTab} />

        <Notifications
          notifications={state.notifications}
          onDismiss={(id) => ops.dismissNotification(id)}
        />

        {tplOpen && (
          <TemplateManager
            templates={templates}
            onCreate={createTemplate}
            onUpdate={updateTemplate}
            onDelete={deleteTemplate}
            onClose={() => setTplOpen(false)}
          />
        )}
      </div>
    );
  }

  // ============================================================
  // Desktop / tablet layout: header and the column grid. The date band is
  // part of the grid above 1100px and hidden below (design-system 4.2).
  // ============================================================
  return (
    <div className={styles.app}>
      <Header query={query} today={today} onQueryChange={handleQueryChange} />

      <div className={styles.grid}>
        <aside className={`${styles.col} ${styles.rail}`}>
          {spacesView.status === "failed" ? (
            <LoadError
              message={formatError(spacesView.error)}
              onRetry={() => void ops.loadSpaces()}
            />
          ) : (
            <Sidebar
              people={people}
              topics={topics}
              openCounts={openCounts}
              selectedSpaceId={home ? null : activeSpaceId}
              selectedPage={home ? null : resolvedPageId}
              overdueCount={overdueCount}
              meSpaceId={meSpaceId}
              homeActive={home}
              onHome={goHome}
              onSelectSpace={selectSpace}
              onSelectPage={selectPage}
              onCreatePage={createPage}
              onRenamePage={renamePage}
              onDeletePage={deletePage}
              onCreateSpace={createSpace}
              onDeleteSpace={deleteSpace}
              onManageTemplates={() => setTplOpen(true)}
            />
          )}
        </aside>

        <main className={`${styles.col} ${styles.stream}`}>
          {searchActive ? (
            renderSearchResults()
          ) : home ? (
            renderToday(true)
          ) : spacesView.status === "failed" ? (
            <LoadError
              message={formatError(spacesView.error)}
              onRetry={() => void ops.loadSpaces()}
            />
          ) : space === null ? (
            <p className="empty">
              Noch keine Bereiche. Sobald der erste Bereich angelegt ist,
              erscheint er hier.
            </p>
          ) : resolvedPageId === null ? (
            <p className="empty">Dieser Bereich hat noch keine Seite.</p>
          ) : (
            renderStream(space, resolvedPageId)
          )}
        </main>

        <aside className={`${styles.col} ${styles.dates}`}>
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
            onToggleDone={(id, done) => patchItem(id, { done })}
            onRetry={() => void ops.loadCalendar(monthFrom, monthTo)}
          />
        </aside>
      </div>

      <Notifications
        notifications={state.notifications}
        onDismiss={(id) => ops.dismissNotification(id)}
      />

      {tplOpen && (
        <TemplateManager
          templates={templates}
          onCreate={createTemplate}
          onUpdate={updateTemplate}
          onDelete={deleteTemplate}
          onClose={() => setTplOpen(false)}
        />
      )}
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

/** Whether a page selection is valid for the space: "tasks" only on a person,
 * "jourfix" everywhere, a page id only if it belongs to the space. */
function validSelection(
  selection: PageSelection,
  space: SpaceWithPages,
): boolean {
  if (selection === "tasks") return space.kind === "person";
  if (selection === "jourfix") return true;
  return space.pages.some((page) => page.id === selection);
}

/**
 * The "today" the app works with, recomputed when the tab becomes visible
 * again — the fix for an app left open across midnight (docs/adr/0013). The
 * date itself is derived by refreshToday (domain), which is unit-tested; this
 * hook only wires it to visibility and focus.
 */
function useToday(): { today: string; todayDate: Date } {
  const [today, setToday] = useState(() => toISODate(new Date()));

  useEffect(() => {
    const refresh = () => {
      const visible = document.visibilityState === "visible";
      setToday((previous) => refreshToday(previous, new Date(), visible));
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return { today, todayDate: fromISODate(today) };
}
