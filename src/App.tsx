import { useEffect, useState, useCallback } from "react";
import type { SpaceWithPages } from "../shared/api.ts";
import type { SpaceKind } from "../shared/db.ts";
import type {
  BlockPatch,
  ItemPatch,
  TemplatePatch,
} from "../shared/schemas.ts";
import { WorkspaceTools } from "./components/WorkspaceTools.tsx";
import { Composer } from "./components/Composer.tsx";
import { ItemEditor } from "./components/ItemEditor.tsx";
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
import type {
  ComposerCommandKey,
  ComposerItemFields,
} from "./domain/composer.ts";
import { fromISODate, refreshToday, toISODate } from "./domain/dates.ts";
import { detectHeading } from "./domain/headings.ts";
import {
  newBlockId,
  newItemId,
  newPageId,
  newSpaceId,
  newTemplateId,
} from "./domain/ids.ts";
import { itemLink, readLink } from "./domain/links.ts";
import { deriveShort } from "./domain/naming.ts";
import { insertPositionBetween } from "./domain/position.ts";
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
  selectJourFixBlocks,
  selectPageView,
  selectPersonOpenCount,
  selectPersonOverview,
  selectSearch,
  selectSpaces,
  selectSpacesView,
  selectTeamOverview,
  selectTemplates,
  selectJourFixThemes,
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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureSpaceId, setCaptureSpaceId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
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
    itemId?: string;
  } | null>(null);
  const [linkRequest, setLinkRequest] = useState(() =>
    readLink(window.location.hash),
  );
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
  const commitNav = useCallback(
    (next: Partial<MobileNavState>, link?: string) => {
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
      window.history.pushState(
        nav,
        "",
        link ?? `${window.location.pathname}${window.location.search}`,
      );
    },
    [mTab, nLevel, spaceId, pageId],
  );

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

  const virtualNotePageId =
    (space?.pages.find((entry) => entry.title === "Notizen") ?? space?.pages[0])
      ?.id ?? null;
  const tasksMode = resolvedPageId === "tasks";
  const jourfixMode = resolvedPageId === "jourfix";
  const activePageId =
    resolvedPageId !== null && !tasksMode && !jourfixMode
      ? resolvedPageId
      : null;

  const ensureCaptureBlock = async (target: SpaceWithPages, title: string) => {
    const page =
      target.pages.find((entry) => entry.title === "Notizen") ??
      target.pages[0] ??
      null;
    const pageId = page?.id ?? `p-notes-${target.id}`;
    if (
      !page &&
      !(await ops.createPage({
        id: pageId,
        spaceId: target.id,
        title: "Notizen",
      }))
    )
      return false;
    const detail = await ops.loadPage(pageId);
    if (!detail) return false;
    const stableBlockId =
      title === "Jour Fix"
        ? `b-jfx-${target.id}`
        : `b-capture-${target.id}-${today}`;
    const block =
      detail.blocks.find((entry) => entry.id === stableBlockId) ??
      detail.blocks.find(
        (entry) =>
          entry.title === title &&
          (title === "Jour Fix" || entry.date === today),
      );
    const blockId = block?.id ?? stableBlockId;
    if (
      !block &&
      !(await ops.createBlock({
        id: blockId,
        pageId,
        templateId: null,
        title,
        date: today,
      }))
    )
      return false;
    const position =
      Math.max(0, ...(block?.items ?? []).map((item) => item.position)) + 1000;
    return { blockId, position };
  };
  const createInSpace = async (
    fields: ComposerItemFields,
    target: SpaceWithPages,
    title: string,
  ) => {
    const destination = await ensureCaptureBlock(target, title);
    return destination
      ? ops.createItem({ ...fields, id: newItemId(), ...destination })
      : false;
  };
  const runItemCommand = async (
    id: string,
    command: ComposerCommandKey,
    targetId?: string,
  ) => {
    const item = state.items.get(id);
    if (!item) return false;
    if (command === "jfx") {
      const source = state.blocks.get(item.blockId);
      const sourceSpaceId = source
        ? state.pages.get(source.pageId)?.spaceId
        : null;
      const target = spaces.find(
        (entry) => entry.id === (targetId || sourceSpaceId),
      );
      if (!target || item.kind !== "note" || item.parentItemId !== null)
        return false;
      const destination = await ensureCaptureBlock(target, "Jour Fix");
      return destination
        ? ops.moveItem(id, destination.blockId, destination.position)
        : false;
    }
    if (command === "merge") return false;
    if (command === "heading")
      return ops.convertItem(id, "note", { heading: 1 });
    if (command === "note")
      return ops.convertItem(id, "note", { heading: null });
    if (command === "ref")
      return targetId
        ? ops.convertItem(id, "ref", { refBlockId: targetId })
        : false;
    return ops.convertItem(
      id,
      command,
      command === "event" && item.kind !== "event"
        ? { eventDate: today }
        : undefined,
    );
  };

  const createPersonTask = async (fields: ComposerItemFields) => {
    if (!isPerson || !space) return false;
    return createInSpace(
      fields.kind === "task"
        ? { ...fields, assigneeSpaceId: fields.assigneeSpaceId ?? space.id }
        : fields,
      space,
      "Ohne Kontext",
    );
  };
  const jfxThemes = space !== null ? selectJourFixThemes(state, space.id) : [];
  const createJourFixTheme = async (
    text: string,
    personSpaceId: string | null,
  ) => {
    const target = spaces.find((entry) => entry.id === personSpaceId) ?? space;
    if (!target || !text.trim()) return false;
    return createInSpace(
      { kind: "note", text, heading: null },
      target,
      "Jour Fix",
    );
  };

  // Moves a Jour-Fix theme into a meeting block (Feature 2): the item changes
  // its block and position — it is not copied, so it leaves the open list.
  const moveTheme = async (itemId: string, targetBlockId: string) => {
    const theme = state.items.get(itemId);
    if (!theme) return false;
    const lastPosition = [...state.items.values()]
      .filter((entry) => entry.blockId === targetBlockId)
      .reduce((max, entry) => Math.max(max, entry.position), 0);
    if (
      !(await ops.moveItem(
        itemId,
        targetBlockId,
        insertPositionBetween(lastPosition || null, null),
      ))
    )
      return false;
    const originPosition = [...state.items.values()]
      .filter((entry) => entry.blockId === theme.blockId)
      .reduce((max, entry) => Math.max(max, entry.position), 0);
    return ops.createItem({
      id: newItemId(),
      blockId: theme.blockId,
      kind: "ref",
      position: insertPositionBetween(originPosition || null, null),
      refBlockId: targetBlockId,
    });
  };

  const monthFrom = toISODate(new Date(month.year, month.month, 1));
  const monthTo = toISODate(new Date(month.year, month.month + 1, 0));

  // Load the spaces index once.
  useEffect(() => {
    void ops.loadSpaces();
    void ops.loadCatalog();
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

  // Virtual views load the same durable note page, including Jour-Fix themes.
  useEffect(() => {
    if (
      virtualNotePageId &&
      (resolvedPageId === "jourfix" || resolvedPageId === "tasks")
    )
      void ops.loadPage(virtualNotePageId);
  }, [virtualNotePageId, resolvedPageId, ops]);

  useEffect(() => {
    const flush = () => ops.flushWrites();
    const guard = (event: BeforeUnloadEvent) => {
      ops.flushWrites();
      if (state.pending.size > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", guard);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [state.pending.size, ops]);

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
      const element = jump.itemId
        ? document.querySelector<HTMLElement>(
            `[data-item-id="${CSS.escape(jump.itemId)}"]`,
          )
        : document.getElementById(`blk-${jump.blockId}`);
      if (element) {
        element.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "center",
        });
        if (jump.itemId) {
          element.classList.add("search-target");
          element.querySelector<HTMLTextAreaElement>("textarea")?.focus();
        }
        if (jump.focusComposer)
          document.getElementById(`composer-${jump.blockId}`)?.focus();
      }
      setJump(null);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [jump, resolvedPageId, pageViewStatus]);

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      const editing =
        event.target instanceof HTMLElement &&
        !!event.target.closest(
          "input, textarea, select, [contenteditable=true]",
        );
      if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCaptureOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (narrow) commitNav({ mTab: "suche" });
        window.setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>('[aria-label="Durchsuchen"]')
              ?.focus(),
          0,
        );
      }
      if (
        !editing &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        void ops.undoLast();
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [ops, narrow, commitNav]);

  useEffect(() => {
    const read = () => {
      setLinkRequest(readLink(window.location.hash));
    };
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (!linkRequest || state.spacesView.status !== "loaded") return;
    const block = state.blocks.get(linkRequest.blockId);
    const page = block ? state.pages.get(block.pageId) : null;
    if (!block || !page) return;
    const frame = window.requestAnimationFrame(() => {
      setHome(false);
      setSpaceId(page.spaceId);
      setPageId(page.id);
      setMTab("notizen");
      setNLevel("stream");
      setJump({
        blockId: block.id,
        pageId: page.id,
        itemId: linkRequest.itemId,
      });
      setLinkRequest(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [linkRequest, state.blocks, state.pages, state.spacesView.status]);

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
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search,
    );
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
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search,
    );
    if (narrow) {
      commitNav({ nLevel: "stream", pageId: id });
    } else {
      setPageId(id);
      setHome(false);
    }
  };

  const goHome = () => {
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search,
    );
    setHome(true);
    setJump(null);
    setQuery("");
  };

  const patchBlock = (id: string, patch: BlockPatch) =>
    void ops.updateBlock(id, patch);
  const patchItem = (id: string, patch: ItemPatch) =>
    void ops.updateItem(id, patch);
  const createItem = (input: ItemCreateInput) => ops.createItem(input);
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
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search,
    );
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
    if (!(await space)) return;
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
    const created = await ops.createBlock({
      id: blockId,
      pageId: activePageId,
      templateId,
      title: `Neuer ${template?.label ?? "Block"}`,
      date: toISODate(new Date()),
    });
    if (!created) return;
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
      label: "Neue Vorlage",
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
  const jumpToTarget = (
    blockId: string,
    pageId: string,
    spaceId: string,
    itemId?: string,
  ) => {
    setJump({ blockId, pageId, itemId });
    window.history.replaceState(
      window.history.state,
      "",
      itemLink(blockId, itemId),
    );
    setQuery("");
    if (narrow) {
      commitNav(
        { mTab: "notizen", nLevel: "stream", spaceId, pageId },
        itemLink(blockId, itemId),
      );
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

  const completed = [...state.items.values()]
    .filter(
      (item) =>
        item.kind === "task" &&
        item.done &&
        (scope !== "mine" || item.assigneeSpaceId === meSpaceId),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const renderToday = (showHead: boolean) => (
    <>
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
        onEdit={setEditingItemId}
        onRetry={() => void ops.loadOverview(today)}
      />
      <details className="completed-tasks">
        <summary>Erledigte Aufgaben ({completed.length})</summary>
        {completed.length === 0 ? (
          <p>Keine erledigten Aufgaben in dieser Auswahl.</p>
        ) : (
          <ul>
            {completed.map((item) => {
              const block = state.blocks.get(item.blockId);
              return (
                <li key={item.id}>
                  <a href={itemLink(item.blockId, item.id)}>
                    {item.text || "Ohne Text"}
                  </a>
                  <span>{block?.title}</span>
                  <button
                    type="button"
                    onClick={() => patchItem(item.id, { done: false })}
                  >
                    Wieder öffnen
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingItemId(item.id)}
                  >
                    Bearbeiten
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </>
  );

  // The block stream is the same on mobile and desktop (docs/adr/0012) — it
  // is deliberately not reworked here.
  const renderStream = (s: SpaceWithPages, selectedPageId: PageSelection) => (
    <Stream
      space={s}
      selectedPageId={selectedPageId}
      isPerson={isPerson}
      jfxThemes={jfxThemes}
      jourFixBlocks={
        virtualNotePageId ? selectJourFixBlocks(state, virtualNotePageId) : []
      }
      onCreateJourFixItem={async (input) => {
        if (!space) return false;
        if (state.blocks.has(input.blockId)) return ops.createItem(input);
        const destination = await ensureCaptureBlock(space, "Jour Fix");
        return destination
          ? ops.createItem({ ...input, ...destination })
          : false;
      }}
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
      pageView={
        selectedPageId === "jourfix"
          ? virtualNotePageId
            ? selectPageView(state, virtualNotePageId)
            : { status: "loaded" }
          : selectPageView(state, selectedPageId)
      }
      pulseBlockId={jump?.blockId ?? null}
      onPatchBlock={patchBlock}
      onPatchItem={patchItem}
      onEditItem={setEditingItemId}
      references={[...state.items.values()].filter(
        (item) => item.kind === "ref",
      )}
      onCreateItem={createItem}
      onDeleteItem={deleteItem}
      onJumpToBlock={jumpToBlock}
      onJumpToOverviewRow={jumpToTarget}
      onRetryPage={() =>
        void ops.loadPage(
          selectedPageId === "jourfix"
            ? (virtualNotePageId ?? "")
            : selectedPageId,
        )
      }
      onRetryOverview={() => void ops.loadOverview(today)}
      onCreateTask={createPersonTask}
      onCreateJourFix={createJourFixTheme}
      onMoveTheme={moveTheme}
      onRunItemCommand={runItemCommand}
      onMergeItems={ops.mergeItems}
      onCreateBlock={createBlock}
      onDeleteBlock={deleteBlock}
      onManageTemplates={() => setTplOpen(true)}
    />
  );

  const captureTarget =
    spaces.find((entry) => entry.id === captureSpaceId) ??
    spaces.find((entry) => entry.id === meSpaceId) ??
    spaces[0];
  const tools = (
    <WorkspaceTools
      pending={state.pending.size}
      failed={state.failedWrites.size}
      undoLabel={state.undoHistory.at(-1)?.label}
      onUndo={() => void ops.undoLast()}
      onCapture={() => setCaptureOpen((open) => !open)}
    />
  );
  const capture = captureOpen && (
    <section className="quick-capture" aria-label="Schnell erfassen">
      <div>
        <h2>Schnell erfassen</h2>
        <button type="button" onClick={() => setCaptureOpen(false)}>
          Schließen
        </button>
      </div>
      {captureTarget ? (
        <>
          <label>
            Ablage
            <select
              value={captureTarget.id}
              onChange={(event) => setCaptureSpaceId(event.target.value)}
            >
              {spaces.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <Composer
            autoFocus
            key={captureTarget.id}
            blockId={`capture-${captureTarget.id}`}
            spaces={spaces}
            blocks={[...state.blocks.values()]}
            today={todayDate}
            showMergeCommand={false}
            onCreateJourFix={(text, person) =>
              createInSpace(
                { kind: "note", text, heading: null },
                spaces.find((entry) => entry.id === person) ?? captureTarget,
                "Jour Fix",
              )
            }
            onCreateItem={(fields) =>
              createInSpace(
                fields.kind === "task" &&
                  !fields.assigneeSpaceId &&
                  captureTarget.kind === "person"
                  ? { ...fields, assigneeSpaceId: captureTarget.id }
                  : fields,
                captureTarget,
                "Ohne Kontext",
              )
            }
          />
        </>
      ) : (
        <p>Lege zuerst einen Bereich an, um Inhalte zu erfassen.</p>
      )}
    </section>
  );

  const editor =
    editingItemId && state.items.get(editingItemId) ? (
      <ItemEditor
        key={editingItemId}
        item={state.items.get(editingItemId)!}
        spaces={spaces}
        onSave={async (id, patch, converted) => {
          const saved = await ops.updateItem(id, patch);
          if (saved && converted) ops.updateUndoRevision(id);
          return saved;
        }}
        onConvert={ops.convertItem}
        onClose={() => setEditingItemId(null)}
      />
    ) : null;

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

        {tools}
        <main
          className={styles.msheet}
          id={`panel-${mTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${mTab}`}
        >
          {capture}
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

        {editor}
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
      {tools}
      <button
        type="button"
        className="calendar-toggle"
        aria-expanded={calendarOpen}
        onClick={() => setCalendarOpen((open) => !open)}
      >
        {calendarOpen ? "Datumspanel schließen" : "Termine und Fälligkeiten"}
      </button>

      <div
        className={`${styles.grid} ${calendarOpen ? "" : styles.withoutDates}`}
      >
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
          {capture}
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

        {calendarOpen && (
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
        )}
      </div>

      <Notifications
        notifications={state.notifications}
        onDismiss={(id) => ops.dismissNotification(id)}
      />

      {editor}
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
