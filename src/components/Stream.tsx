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
  /** A task created in the person's "Aufgaben" view (Feature 3). */
  onCreateTask: (fields: ComposerItemFields) => void;
  /** A "/jfx" theme goes to the target space's Jour-Fix block (Feature 2). */
  onCreateJourFix: (text: string, personSpaceId: string | null) => void;
  /** Moves a Jour-Fix theme into the given block (Feature 2). */
  onMoveTheme: (itemId: string, targetBlockId: string) => void;
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
    onCreateItem,
    onDeleteItem,
    onJumpToBlock,
    onJumpToOverviewRow,
    onRetryPage,
    onRetryOverview,
    onCreateTask,
    onCreateJourFix,
    onMoveTheme,
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
          onToggle={(itemId, done) => onPatchItem(itemId, { done })}
          onJumpToBlock={onJumpToOverviewRow}
          onRetry={onRetryOverview}
        />
      ) : pane === "jourfix" ? (
        <JourFixPane themes={jfxThemes} />
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
          onCreateItem={onCreateItem}
          onDeleteItem={onDeleteItem}
          onJumpToBlock={onJumpToBlock}
          onRetry={onRetryPage}
          onCreateBlock={onCreateBlock}
          onDeleteBlock={onDeleteBlock}
          onManageTemplates={onManageTemplates}
          onCreateJourFix={onCreateJourFix}
          onMoveTheme={onMoveTheme}
        />
      )}
    </div>
  );
}

/** The "Jour Fix" entry (Feature 2, docs/adr/0017): the open themes of the
 * space's Jour-Fix block, or a calm hint while none exist yet. */
function JourFixPane({ themes }: { themes: ItemRow[] }) {
  if (themes.length === 0) {
    return (
      <div className={styles.jourfix}>
        <p>Jour Fix — noch nichts hinterlegt. Tippe im Composer „/jfx“.</p>
      </div>
    );
  }
  return (
    <div className={styles.jourfix}>
      <ul className={styles.jfxlist}>
        {themes.map((theme) => (
          <li key={theme.id}>{theme.text || "Thema"}</li>
        ))}
      </ul>
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
  onCreateItem,
  onDeleteItem,
  onJumpToBlock,
  onRetry,
  onCreateBlock,
  onDeleteBlock,
  onManageTemplates,
  onCreateJourFix,
  onMoveTheme,
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
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onCreateItem: (input: ItemCreateInput) => void;
  onDeleteItem: (id: string) => void;
  onJumpToBlock: (blockId: string) => void;
  onRetry: () => void;
  onCreateBlock: (templateId: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onManageTemplates: () => void;
  onCreateJourFix: (text: string, personSpaceId: string | null) => void;
  onMoveTheme: (itemId: string, targetBlockId: string) => void;
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
              onCreateItem={onCreateItem}
              onDeleteItem={onDeleteItem}
              onDeleteBlock={onDeleteBlock}
              onJumpToBlock={onJumpToBlock}
              onCreateJourFix={onCreateJourFix}
              onMoveTheme={onMoveTheme}
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
  onCreateTask: (fields: ComposerItemFields) => void;
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
        blockId={space.id}
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
        onJumpToBlock={onJumpToBlock}
      />
    </div>
  );
}
