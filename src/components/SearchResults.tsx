import type { SearchResponse } from "../../shared/api.ts";
import { formatShort } from "../domain/dates.ts";
import styles from "./SearchResults.module.css";

interface SearchResultsProps {
  response: SearchResponse;
  onJumpToBlock: (blockId: string, pageId: string, spaceId: string) => void;
  onClear: () => void;
}

const KIND_LABEL = {
  note: "Notiz",
  task: "Task",
  event: "Termin",
  ref: "Notiz",
} as const;

/**
 * The search result list (prototype reference): one result per block title
 * hit and per item text hit, each a jump to its block. Block hits come
 * first with their date, item hits with their kind and block title; both
 * show the path space · page. Ordering and matching come from the domain
 * (src/domain/search.ts); this component only renders.
 */
export function SearchResults({ response, onJumpToBlock, onClear }: SearchResultsProps) {
  const total = response.blocks.length + response.items.length;

  return (
    <div className={styles.results}>
      <div className={styles.head}>
        <p className={styles.rescount}>{total === 0 ? "Kein Treffer" : `${total} Treffer für „${response.query}“`}</p>
        <button type="button" className={styles.clear} onClick={onClear}>
          Suche verlassen
        </button>
      </div>

      {total === 0 && (
        <p className={styles.empty}>Suche nach Blocktiteln, Notizzeilen, Tasks oder Terminen.</p>
      )}

      {response.blocks.map((hit) => (
        <button
          key={hit.block.id}
          type="button"
          className={styles.res}
          onClick={() => onJumpToBlock(hit.block.id, hit.page.id, hit.space.id)}
        >
          <span className={styles.restype}>Block · {hit.templateLabel ?? "Ohne Template"}</span>
          <span className={styles.restitle}>{hit.block.title}</span>
          <span className={styles.respath}>
            {hit.space.name} · {hit.page.title} · {formatShort(hit.block.date)}
          </span>
        </button>
      ))}

      {response.items.map((hit) => (
        <button key={hit.item.id} type="button" className={styles.res} onClick={() => onJumpToBlock(hit.block.id, hit.page.id, hit.space.id)}>
          <span className={styles.restype}>{KIND_LABEL[hit.item.kind]}</span>
          <span className={styles.restitle}>{hit.item.text}</span>
          <span className={styles.respath}>
            {hit.space.name} · {hit.page.title} · {hit.block.title}
          </span>
        </button>
      ))}
    </div>
  );
}
