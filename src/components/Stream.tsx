import { useState } from "react";
import type { SpaceWithPages } from "../../shared/api.ts";
import type {
  BlockRow,
  PageRow,
  SpaceRow,
  TemplateRow,
} from "../../shared/db.ts";
import type { BlockPatch, ItemPatch } from "../../shared/schemas.ts";
import type { TaskOverviewView } from "../domain/overview.ts";
import type { ItemCreateInput } from "../state/operations.ts";
import type { ViewStatus } from "../state/state.ts";
import type { BlockView } from "../state/selectors.ts";
import { BlockCard } from "./BlockCard.tsx";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { formatError } from "./errorText.ts";
import { FALLBACK_TEMPLATE } from "./fallbackTemplate.ts";
import { NewBlockBar } from "./NewBlockBar.tsx";
import { LoadError, Loading } from "./status.tsx";
import { TaskOverview } from "./TaskOverview.tsx";
import styles from "./Stream.module.css";

interface StreamProps {
  space: SpaceWithPages;
  selectedPageId: string | "mirror";
  isPerson: boolean;
  pageBlocks: BlockView[];
  /** The person's assigned-tasks view (replaces the mirror), null when unknown. */
  personView: TaskOverviewView | null;
  overviewView: ViewStatus;
  today: string;
  meSpaceId: string | null;
  templates: TemplateRow[];
  templatesById: ReadonlyMap<string, TemplateRow>;
  spacesById: ReadonlyMap<string, SpaceRow>;
  blocksById: ReadonlyMap<string, BlockRow>;
  spaces: readonly Pick<SpaceRow, "id" | "name" | "kind">[];
  todayDate: Date;
  pageView: ViewStatus;
  pulseBlockId: string | null;
  onSelectPage: (pageId: string | "mirror") => void;
  onPatchBlock: (id: string, patch: BlockPatch) => void;
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onCreateItem: (input: ItemCreateInput) => void;
  onDeleteItem: (id: string) => void;
  onJumpToBlock: (blockId: string) => void;
  onJumpToOverviewRow: (
    blockId: string,
    pageId: string,
    spaceId: string,
  ) => void;
  onRetryPage: () => void;
  onRetryOverview: () => void;
  onCreatePage: (title: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onDeletePage: (pageId: string) => void;
  onCreateBlock: (templateId: string | null) => void;
  onDeleteBlock: (id: string) => void;
  /** Opens the shared TemplateManager (owned by the App shell). */
  onManageTemplates: () => void;
}

export function Stream(props: StreamProps) {
  const {
    space,
    selectedPageId,
    isPerson,
    pageBlocks,
    personView,
    overviewView,
    today,
    meSpaceId,
    templates,
    templatesById,
    spacesById,
    blocksById,
    spaces,
    todayDate,
    pageView,
    pulseBlockId,
    onSelectPage,
    onPatchBlock,
    onPatchItem,
    onCreateItem,
    onDeleteItem,
    onJumpToBlock,
    onJumpToOverviewRow,
    onRetryPage,
    onRetryOverview,
    onCreatePage,
    onRenamePage,
    onDeletePage,
    onCreateBlock,
    onDeleteBlock,
    onManageTemplates,
  } = props;

  const mirrorMode = selectedPageId === "mirror";
  const openCount =
    personView === null
      ? 0
      : personView.overdue.length +
        personView.later.length +
        personView.undated.length +
        personView.days.reduce((sum, day) => sum + day.tasks.length, 0);

  return (
    <div className={styles.stream}>
      <div className={styles.streamhead}>
        <div className={styles.crumb}>
          <span
            className={isPerson ? styles.dotPerson : styles.dotTopic}
            aria-hidden="true"
          />
          <strong>{space.name}</strong>
        </div>
        <PageTabs
          isPerson={isPerson}
          mirrorMode={mirrorMode}
          pages={space.pages}
          selectedPageId={selectedPageId}
          openCount={openCount}
          onSelectPage={onSelectPage}
          onCreatePage={onCreatePage}
          onRenamePage={onRenamePage}
          onDeletePage={onDeletePage}
        />
      </div>

      {mirrorMode ? (
        <PersonPane
          space={space}
          view={personView}
          viewStatus={overviewView}
          today={today}
          meSpaceId={meSpaceId}
          spacesById={spacesById}
          onToggle={(itemId, done) => onPatchItem(itemId, { done })}
          onJumpToBlock={onJumpToOverviewRow}
          onRetry={onRetryOverview}
        />
      ) : (
        <PagePane
          pageView={pageView}
          pageBlocks={pageBlocks}
          pulseBlockId={pulseBlockId}
          meSpaceId={meSpaceId}
          templates={templates}
          templatesById={templatesById}
          spacesById={spacesById}
          blocksById={blocksById}
          spaces={spaces}
          today={todayDate}
          onPatchBlock={onPatchBlock}
          onPatchItem={onPatchItem}
          onCreateItem={onCreateItem}
          onDeleteItem={onDeleteItem}
          onJumpToBlock={onJumpToBlock}
          onRetry={onRetryPage}
          onCreateBlock={onCreateBlock}
          onDeleteBlock={onDeleteBlock}
          onManageTemplates={onManageTemplates}
        />
      )}
    </div>
  );
}

function PageTabs({
  isPerson,
  mirrorMode,
  pages,
  selectedPageId,
  openCount,
  onSelectPage,
  onCreatePage,
  onRenamePage,
  onDeletePage,
}: {
  isPerson: boolean;
  mirrorMode: boolean;
  pages: PageRow[];
  selectedPageId: string | "mirror";
  openCount: number;
  onSelectPage: (pageId: string | "mirror") => void;
  onCreatePage: (title: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onDeletePage: (pageId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const submitAdd = () => {
    const title = draft.trim();
    if (!title) return;
    onCreatePage(title);
    setDraft("");
    setAdding(false);
  };

  const submitRename = () => {
    if (editingId === null) return;
    const title = editDraft.trim();
    if (title) onRenamePage(editingId, title);
    setEditingId(null);
  };

  return (
    <>
      <nav className={styles.tabs} aria-label="Seiten">
        {isPerson && (
          <button
            type="button"
            className={`label ${mirrorMode ? styles.tabOn : styles.tab}`}
            aria-current={mirrorMode ? "page" : undefined}
            onClick={() => onSelectPage("mirror")}
          >
            Zugewiesen{" "}
            {openCount > 0 && (
              <span className="badge badge--active">{openCount}</span>
            )}
          </button>
        )}
        {pages.map((page) => {
          const active = !mirrorMode && page.id === selectedPageId;
          if (editingId === page.id) {
            return (
              <span key={page.id} className={styles.tabedit}>
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitRename();
                    if (event.key === "Escape") setEditingId(null);
                  }}
                  onBlur={submitRename}
                  aria-label="Seitentitel umbenennen"
                />
              </span>
            );
          }
          return (
            <span key={page.id} className={styles.tabwrap}>
              <button
                type="button"
                className={`label ${active ? styles.tabOn : styles.tab}`}
                aria-current={active ? "page" : undefined}
                onClick={() => onSelectPage(page.id)}
              >
                {page.title}
              </button>
              <button
                type="button"
                className={styles.tabrename}
                onClick={() => {
                  setEditingId(page.id);
                  setEditDraft(page.title);
                }}
                aria-label={`${page.title} umbenennen`}
                title="Seite umbenennen"
              >
                ✎
              </button>
              <button
                type="button"
                className={styles.tabdelete}
                onClick={() => setConfirmId(page.id)}
                aria-label={`${page.title} entfernen`}
                title="Seite entfernen"
              >
                ×
              </button>
            </span>
          );
        })}
        {adding ? (
          <span className={styles.tabedit}>
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitAdd();
                if (event.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
              onBlur={submitAdd}
              placeholder="Seitenname"
              aria-label="Neue Seite"
            />
          </span>
        ) : (
          <button
            type="button"
            className={`${styles.tab} ${styles.tabAdd}`}
            onClick={() => setAdding(true)}
            aria-label="Seite hinzufügen"
            title="Seite hinzufügen"
          >
            + Seite
          </button>
        )}
      </nav>

      {confirmId !== null && (
        <ConfirmDialog
          message={
            <>
              „{pages.find((entry) => entry.id === confirmId)?.title ?? ""}“ mit
              ihren Blöcken löschen?
            </>
          }
          onConfirm={() => {
            onDeletePage(confirmId);
            setConfirmId(null);
          }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </>
  );
}

function PagePane({
  pageView,
  pageBlocks,
  pulseBlockId,
  meSpaceId,
  templates,
  templatesById,
  spacesById,
  blocksById,
  spaces,
  today,
  onPatchBlock,
  onPatchItem,
  onCreateItem,
  onDeleteItem,
  onJumpToBlock,
  onRetry,
  onCreateBlock,
  onDeleteBlock,
  onManageTemplates,
}: {
  pageView: ViewStatus;
  pageBlocks: BlockView[];
  pulseBlockId: string | null;
  meSpaceId: string | null;
  templates: TemplateRow[];
  templatesById: ReadonlyMap<string, TemplateRow>;
  spacesById: ReadonlyMap<string, SpaceRow>;
  blocksById: ReadonlyMap<string, BlockRow>;
  spaces: readonly Pick<SpaceRow, "id" | "name" | "kind">[];
  today: Date;
  onPatchBlock: (id: string, patch: BlockPatch) => void;
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onCreateItem: (input: ItemCreateInput) => void;
  onDeleteItem: (id: string) => void;
  onJumpToBlock: (blockId: string) => void;
  onRetry: () => void;
  onCreateBlock: (templateId: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onManageTemplates: () => void;
}) {
  if (pageView.status === "idle" || pageView.status === "loading")
    return <Loading />;
  if (pageView.status === "failed")
    return (
      <LoadError message={formatError(pageView.error)} onRetry={onRetry} />
    );
  return (
    <div className={styles.page}>
      <NewBlockBar
        templates={templates}
        onCreateBlock={onCreateBlock}
        onManageTemplates={onManageTemplates}
      />
      {pageBlocks.length === 0 ? (
        <p className="empty">
          Diese Seite ist leer. Lege mit „Block anlegen“ den ersten Block an.
        </p>
      ) : (
        <div className={styles.blocks}>
          {pageBlocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              template={
                templatesById.get(block.templateId ?? "") ?? FALLBACK_TEMPLATE
              }
              meSpaceId={meSpaceId}
              spacesById={spacesById}
              blocksById={blocksById}
              spaces={spaces}
              today={today}
              pulse={pulseBlockId === block.id}
              onPatchBlock={onPatchBlock}
              onPatchItem={onPatchItem}
              onCreateItem={onCreateItem}
              onDeleteItem={onDeleteItem}
              onDeleteBlock={onDeleteBlock}
              onJumpToBlock={onJumpToBlock}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonPane({
  space,
  view,
  viewStatus,
  today,
  meSpaceId,
  spacesById,
  onToggle,
  onJumpToBlock,
  onRetry,
}: {
  space: SpaceWithPages;
  view: TaskOverviewView | null;
  viewStatus: ViewStatus;
  today: string;
  meSpaceId: string | null;
  spacesById: ReadonlyMap<string, SpaceRow>;
  onToggle: (itemId: string, done: boolean) => void;
  onJumpToBlock: (blockId: string, pageId: string, spaceId: string) => void;
  onRetry: () => void;
}) {
  if (viewStatus.status === "idle" || viewStatus.status === "loading")
    return <Loading />;
  if (viewStatus.status === "failed")
    return (
      <LoadError message={formatError(viewStatus.error)} onRetry={onRetry} />
    );
  if (view === null) return null;
  return (
    <TaskOverview
      mode="person"
      person={space}
      view={view}
      today={today}
      meSpaceId={meSpaceId}
      spacesById={spacesById}
      onToggle={onToggle}
      onJumpToBlock={onJumpToBlock}
    />
  );
}
