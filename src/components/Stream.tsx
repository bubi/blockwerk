import type { SpaceWithPages } from "../../shared/api.ts";
import type {
  BlockRow,
  ItemRow,
  SpaceRow,
  TemplateRow,
} from "../../shared/db.ts";
import type { BlockPatch, ItemPatch } from "../../shared/schemas.ts";
import type { ComposerItemFields } from "../domain/composer.ts";
import type { TaskOverviewView } from "../domain/overview.ts";
import type { PageSelection } from "../state/navigation.ts";
import type { ItemCreateInput } from "../state/operations.ts";
import type { ViewStatus } from "../state/state.ts";
import type { BlockView } from "../state/selectors.ts";
import { itemLink } from "../domain/links.ts";
import { BlockCard } from "./BlockCard.tsx";
import { Composer } from "./Composer.tsx";
import { formatError } from "./errorText.ts";
import { FALLBACK_TEMPLATE } from "./fallbackTemplate.ts";
import { NewBlockBar } from "./NewBlockBar.tsx";
import { LoadError, Loading } from "./status.tsx";
import { TaskOverview } from "./TaskOverview.tsx";
import styles from "./Stream.module.css";

interface StreamProps {
  space: SpaceWithPages;
  selectedPageId: PageSelection;
  isPerson: boolean;
  /** The current space's open Jour-Fix themes (Feature 2). */
  jfxThemes: ItemRow[];
  pageBlocks: BlockView[];
  /** The person's assigned-tasks view, null when unknown. */
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
  onPatchBlock: (id: string, patch: BlockPatch) => void;
  references: readonly ItemRow[];
  onEditItem: (id: string) => void;
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onCreateItem: (input: ItemCreateInput) => void | Promise<boolean>;
  onDeleteItem: (id: string) => void;
  onJumpToBlock: (blockId: string) => void;
  onJumpToOverviewRow: (
    blockId: string,
    pageId: string,
    spaceId: string,
  ) => void;
  onRetryPage: () => void;
  onRetryOverview: () => void;
  /** A task created in the person's "Aufgaben" view (Feature 3). */
  onCreateTask: (
    fields: ComposerItemFields,
  ) => void | boolean | Promise<boolean>;
  /** A "/jfx" theme goes to the target space's Jour-Fix block (Feature 2). */
  onCreateJourFix: (
    text: string,
    personSpaceId: string | null,
  ) => void | boolean | Promise<boolean>;
  /** Moves a Jour-Fix theme into the given block (Feature 2). */
  onMergeItems: (items: readonly ItemRow[]) => Promise<boolean>;
  onMoveTheme: (
    itemId: string,
    targetBlockId: string,
  ) => void | boolean | Promise<boolean>;
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
    jfxThemes,
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
    onPatchBlock,
    onPatchItem,
    onEditItem,
    references,
    onCreateItem,
    onDeleteItem,
    onJumpToBlock,
    onJumpToOverviewRow,
    onRetryPage,
    onRetryOverview,
    onCreateTask,
    onCreateJourFix,
    onMoveTheme,
    onMergeItems,
    onCreateBlock,
    onDeleteBlock,
    onManageTemplates,
  } = props;

  // The stream decides once what the selected entry renders: the virtual
  // "Aufgaben" (person) and "Jour Fix" entries, or a real page.
  const pane: "tasks" | "jourfix" | "page" =
    selectedPageId === "tasks"
      ? "tasks"
      : selectedPageId === "jourfix"
        ? "jourfix"
        : "page";
  const entryTitle =
    pane === "tasks"
      ? "Aufgaben"
      : pane === "jourfix"
        ? "Jour Fix"
        : (space.pages.find((page) => page.id === selectedPageId)?.title ?? "");

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
        <p className={styles.crumbEntry}>{entryTitle}</p>
      </div>

      {pane === "tasks" ? (
        <PersonPane
          space={space}
          view={personView}
          viewStatus={overviewView}
          today={today}
          todayDate={todayDate}
          meSpaceId={meSpaceId}
          spacesById={spacesById}
          spaces={spaces}
          blocks={[...blocksById.values()]}
          onCreateTask={onCreateTask}
          onEditItem={onEditItem}
          onToggle={(itemId, done) => onPatchItem(itemId, { done })}
          onJumpToBlock={onJumpToOverviewRow}
          onRetry={onRetryOverview}
        />
      ) : pane === "jourfix" ? (
        <JourFixPane
          themes={jfxThemes}
          space={space}
          spaces={spaces}
          blocks={[...blocksById.values()]}
          today={todayDate}
          onCreate={onCreateJourFix}
          onPatch={onPatchItem}
          onEdit={onEditItem}
          onDelete={onDeleteItem}
          view={pageView}
          onRetry={onRetryPage}
          references={references}
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
          jfxThemes={jfxThemes}
          onPatchBlock={onPatchBlock}
          onPatchItem={onPatchItem}
          onEditItem={onEditItem}
          references={references}
          onCreateItem={onCreateItem}
          onDeleteItem={onDeleteItem}
          onJumpToBlock={onJumpToBlock}
          onRetry={onRetryPage}
          onCreateBlock={onCreateBlock}
          onDeleteBlock={onDeleteBlock}
          onManageTemplates={onManageTemplates}
          onCreateJourFix={onCreateJourFix}
          onMoveTheme={onMoveTheme}
          onMergeItems={onMergeItems}
        />
      )}
    </div>
  );
}

/** The "Jour Fix" entry (Feature 2, docs/adr/0017): the open themes of the
 * space's Jour-Fix block, or a calm hint while none exist yet. */
function JourFixPane({
  themes,
  space,
  spaces,
  blocks,
  today,
  onCreate,
  onPatch,
  onDelete,
  view,
  onRetry,
  onEdit,
  references,
}: {
  themes: ItemRow[];
  space: SpaceWithPages;
  spaces: readonly Pick<SpaceRow, "id" | "name" | "kind">[];
  blocks: readonly BlockRow[];
  today: Date;
  onCreate: (
    text: string,
    person: string | null,
  ) => void | boolean | Promise<boolean>;
  onPatch: (id: string, patch: ItemPatch) => void;
  onDelete: (id: string) => void;
  references: readonly ItemRow[];
  view: ViewStatus;
  onRetry: () => void;
  onEdit: (id: string) => void;
}) {
  const history = references.filter((ref) => {
    const source = blocks.find((block) => block.id === ref.blockId);
    return (
      source?.title === "Jour Fix" &&
      space.pages.some((page) => page.id === source.pageId)
    );
  });
  return (
    <div className={styles.jourfix}>
      <p>
        Themen für das nächste Gespräch sammeln. Beim Übernehmen bleibt dieselbe
        Notiz erhalten.
      </p>
      <Composer
        key={space.id}
        blockId={`jfx-${space.id}`}
        initialMode="jfx"
        spaces={spaces}
        blocks={blocks}
        today={today}
        showMergeCommand={false}
        onCreateJourFix={onCreate}
        onCreateItem={(fields) => onCreate(fields.text, space.id)}
      />
      {view.status === "loading" || view.status === "idle" ? (
        <Loading label="Jour Fix wird geladen…" />
      ) : view.status === "failed" ? (
        <LoadError message={formatError(view.error)} onRetry={onRetry} />
      ) : themes.length === 0 ? (
        <p className="empty">
          Noch keine offenen Themen. Hier kannst du das erste hinzufügen.
        </p>
      ) : (
        <ul className={styles.jfxlist}>
          {themes.map((theme) => (
            <li key={theme.id}>
              <input
                aria-label="Jour-Fix-Thema"
                value={theme.text}
                maxLength={10_000}
                onChange={(event) =>
                  onPatch(theme.id, { text: event.target.value })
                }
              />
              <button type="button" onClick={() => onEdit(theme.id)}>
                Bearbeiten
              </button>
              <button
                type="button"
                onClick={() => onDelete(theme.id)}
                aria-label="Thema entfernen"
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}
      {history.length > 0 && (
        <details>
          <summary>Bisherige Gespräche</summary>
          <ul>
            {history.map((ref) => (
              <li key={ref.id}>
                {ref.refBlockId ? (
                  <a href={itemLink(ref.refBlockId)}>
                    {blocks.find((block) => block.id === ref.refBlockId)
                      ?.title || "Gespräch öffnen"}
                  </a>
                ) : (
                  "Ziel entfernt"
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
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
  jfxThemes,
  onPatchBlock,
  onPatchItem,
  onEditItem,
  references,
  onCreateItem,
  onDeleteItem,
  onJumpToBlock,
  onRetry,
  onCreateBlock,
  onDeleteBlock,
  onManageTemplates,
  onCreateJourFix,
  onMoveTheme,
  onMergeItems,
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
  jfxThemes: ItemRow[];
  onPatchBlock: (id: string, patch: BlockPatch) => void;
  references: readonly ItemRow[];
  onEditItem: (id: string) => void;
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onCreateItem: (input: ItemCreateInput) => void | Promise<boolean>;
  onDeleteItem: (id: string) => void;
  onJumpToBlock: (blockId: string) => void;
  onRetry: () => void;
  onCreateBlock: (templateId: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onManageTemplates: () => void;
  onCreateJourFix: (
    text: string,
    personSpaceId: string | null,
  ) => void | boolean | Promise<boolean>;
  onMergeItems: (items: readonly ItemRow[]) => Promise<boolean>;
  onMoveTheme: (
    itemId: string,
    targetBlockId: string,
  ) => void | boolean | Promise<boolean>;
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
              jfxThemes={jfxThemes}
              onPatchBlock={onPatchBlock}
              onPatchItem={onPatchItem}
              onEditItem={onEditItem}
              references={references}
              onCreateItem={onCreateItem}
              onDeleteItem={onDeleteItem}
              onDeleteBlock={onDeleteBlock}
              onJumpToBlock={onJumpToBlock}
              onCreateJourFix={onCreateJourFix}
              onMoveTheme={onMoveTheme}
              onMergeItems={onMergeItems}
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
  todayDate,
  meSpaceId,
  spacesById,
  spaces,
  blocks,
  onCreateTask,
  onEditItem,
  onToggle,
  onJumpToBlock,
  onRetry,
}: {
  space: SpaceWithPages;
  view: TaskOverviewView | null;
  viewStatus: ViewStatus;
  today: string;
  todayDate: Date;
  meSpaceId: string | null;
  spacesById: ReadonlyMap<string, SpaceRow>;
  spaces: readonly Pick<SpaceRow, "id" | "name" | "kind">[];
  blocks: readonly BlockRow[];
  onCreateTask: (
    fields: ComposerItemFields,
  ) => void | boolean | Promise<boolean>;
  onEditItem: (id: string) => void;
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
    <div className={styles.person}>
      {/* The block id only names the composer's DOM ids — the target block is
          resolved lazily at create time (Feature 3, docs/adr/0016). */}
      <Composer
        blockId={`person-${space.id}`}
        initialMode="task"
        spaces={spaces}
        blocks={blocks}
        today={todayDate}
        showMergeCommand={false}
        onCreateItem={onCreateTask}
      />
      <TaskOverview
        mode="person"
        person={space}
        view={view}
        today={today}
        meSpaceId={meSpaceId}
        spacesById={spacesById}
        onToggle={onToggle}
        onEdit={onEditItem}
        onJumpToBlock={onJumpToBlock}
      />
    </div>
  );
}
