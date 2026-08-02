import type { SpaceWithPages } from "../../shared/api.ts";
import type { BlockRow, SpaceRow, TemplateRow } from "../../shared/db.ts";
import type { BlockPatch, ItemPatch } from "../../shared/schemas.ts";
import type { MirrorGroup } from "../domain/mirror.ts";
import type { ViewStatus } from "../state/state.ts";
import type { BlockView } from "../state/selectors.ts";
import { BlockCard } from "./BlockCard.tsx";
import { formatError } from "./errorText.ts";
import { FALLBACK_TEMPLATE } from "./fallbackTemplate.ts";
import { Mirror } from "./Mirror.tsx";
import { LoadError, Loading } from "./status.tsx";
import styles from "./Stream.module.css";

interface StreamProps {
  space: SpaceWithPages;
  selectedPageId: string | "mirror";
  isPerson: boolean;
  pageBlocks: BlockView[];
  mirrorGroups: MirrorGroup[];
  templatesById: ReadonlyMap<string, TemplateRow>;
  spacesById: ReadonlyMap<string, SpaceRow>;
  blocksById: ReadonlyMap<string, BlockRow>;
  pageView: ViewStatus;
  mirrorView: ViewStatus;
  pulseBlockId: string | null;
  onSelectPage: (pageId: string | "mirror") => void;
  onPatchBlock: (id: string, patch: BlockPatch) => void;
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onJumpToBlock: (blockId: string) => void;
  onRetryPage: () => void;
  onRetryMirror: () => void;
}

export function Stream(props: StreamProps) {
  const {
    space,
    selectedPageId,
    isPerson,
    pageBlocks,
    mirrorGroups,
    templatesById,
    spacesById,
    blocksById,
    pageView,
    mirrorView,
    pulseBlockId,
    onSelectPage,
    onPatchBlock,
    onPatchItem,
    onJumpToBlock,
    onRetryPage,
    onRetryMirror,
  } = props;

  const mirrorMode = selectedPageId === "mirror";
  const openCount = mirrorGroups.reduce((sum, group) => sum + group.tasks.length, 0);

  return (
    <div className={styles.stream}>
      <div className={styles.streamhead}>
        <div className={styles.crumb}>
          <span className={isPerson ? styles.dotPerson : styles.dotTopic} aria-hidden="true" />
          <strong>{space.name}</strong>
        </div>
        <nav className={styles.tabs} aria-label="Seiten">
          {isPerson && (
            <button
              type="button"
              className={mirrorMode ? styles.tabOn : styles.tab}
              aria-current={mirrorMode ? "page" : undefined}
              onClick={() => onSelectPage("mirror")}
            >
              Zugewiesen {openCount > 0 && <span className={styles.count}>{openCount}</span>}
            </button>
          )}
          {space.pages.map((page) => {
            const active = !mirrorMode && page.id === selectedPageId;
            return (
              <button
                key={page.id}
                type="button"
                className={active ? styles.tabOn : styles.tab}
                aria-current={active ? "page" : undefined}
                onClick={() => onSelectPage(page.id)}
              >
                {page.title}
              </button>
            );
          })}
        </nav>
      </div>

      {mirrorMode ? (
        <MirrorPane mirrorView={mirrorView} mirrorGroups={mirrorGroups} space={space} onPatchItem={onPatchItem} onJumpToBlock={onJumpToBlock} onRetry={onRetryMirror} />
      ) : (
        <PagePane
          pageView={pageView}
          pageBlocks={pageBlocks}
          pulseBlockId={pulseBlockId}
          templatesById={templatesById}
          spacesById={spacesById}
          blocksById={blocksById}
          onPatchBlock={onPatchBlock}
          onPatchItem={onPatchItem}
          onJumpToBlock={onJumpToBlock}
          onRetry={onRetryPage}
        />
      )}
    </div>
  );
}

function PagePane({
  pageView,
  pageBlocks,
  pulseBlockId,
  templatesById,
  spacesById,
  blocksById,
  onPatchBlock,
  onPatchItem,
  onJumpToBlock,
  onRetry,
}: {
  pageView: ViewStatus;
  pageBlocks: BlockView[];
  pulseBlockId: string | null;
  templatesById: ReadonlyMap<string, TemplateRow>;
  spacesById: ReadonlyMap<string, SpaceRow>;
  blocksById: ReadonlyMap<string, BlockRow>;
  onPatchBlock: (id: string, patch: BlockPatch) => void;
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onJumpToBlock: (blockId: string) => void;
  onRetry: () => void;
}) {
  if (pageView.status === "idle" || pageView.status === "loading") return <Loading />;
  if (pageView.status === "failed") return <LoadError message={formatError(pageView.error)} onRetry={onRetry} />;
  if (pageBlocks.length === 0) {
    return (
      <p className={styles.empty}>
        Diese Seite ist leer. Neue Blöcke entstehen später über das Menü — sie bekommen automatisch das heutige Datum.
      </p>
    );
  }
  return (
    <div className={styles.blocks}>
      {pageBlocks.map((block) => (
        <BlockCard
          key={block.id}
          block={block}
          template={templatesById.get(block.templateId ?? "") ?? FALLBACK_TEMPLATE}
          spacesById={spacesById}
          blocksById={blocksById}
          pulse={pulseBlockId === block.id}
          onPatchBlock={onPatchBlock}
          onPatchItem={onPatchItem}
          onJumpToBlock={onJumpToBlock}
        />
      ))}
    </div>
  );
}

function MirrorPane({
  mirrorView,
  mirrorGroups,
  space,
  onPatchItem,
  onJumpToBlock,
  onRetry,
}: {
  mirrorView: ViewStatus;
  mirrorGroups: MirrorGroup[];
  space: SpaceWithPages;
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onJumpToBlock: (blockId: string) => void;
  onRetry: () => void;
}) {
  if (mirrorView.status === "idle" || mirrorView.status === "loading") return <Loading />;
  if (mirrorView.status === "failed") return <LoadError message={formatError(mirrorView.error)} onRetry={onRetry} />;
  return <Mirror space={space} groups={mirrorGroups} onPatchItem={onPatchItem} onJumpToBlock={onJumpToBlock} />;
}
