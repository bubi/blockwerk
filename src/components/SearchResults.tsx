import { useState } from "react";
import type { SearchResponse } from "../../shared/api.ts";
import { formatShort } from "../domain/dates.ts";
import styles from "./SearchResults.module.css";

interface SearchResultsProps {
  response: SearchResponse;
  onJumpToBlock: (
    blockId: string,
    pageId: string,
    spaceId: string,
    itemId?: string,
  ) => void;
}

const KIND_LABEL = {
  note: "Notiz",
  task: "Aufgabe",
  event: "Termin",
  ref: "Verweis",
} as const;

/**
 * The search result list (prototype reference): one result per block title
 * hit and per item text hit, each a jump to its block. Block hits come
 * first with their date, item hits with their kind and block title; both
 * show the path space · page. Ordering and matching come from the domain
 * (src/domain/search.ts); this component only renders.
 */
export function SearchResults({ response, onJumpToBlock }: SearchResultsProps) {
  const [spaceId, setSpaceId] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const spaces = new Map(
    [...response.blocks, ...response.items].map((hit) => [
      hit.space.id,
      hit.space.name,
    ]),
  );
  const matches = (
    hit: (typeof response.blocks)[number] | (typeof response.items)[number],
  ) =>
    (!spaceId || hit.space.id === spaceId) &&
    (!from || (hit.block.date ?? "") >= from) &&
    (!to || (hit.block.date ?? "") <= to);
  const blocks = response.blocks.filter(
    (hit) => (!kind || kind === "block") && matches(hit),
  );
  const items = response.items.filter(
    (hit) => (!kind || hit.item.kind === kind) && matches(hit),
  );
  const total = blocks.length + items.length;
  const highlight = (text: string) => {
    const index = text
      .toLocaleLowerCase("de")
      .indexOf(response.query.toLocaleLowerCase("de"));
    return index < 0 ? (
      text
    ) : (
      <>
        {text.slice(0, index)}
        <mark>{text.slice(index, index + response.query.length)}</mark>
        {text.slice(index + response.query.length)}
      </>
    );
  };

  return (
    <div className={styles.results}>
      <details className="search-filters">
        <summary>Suchfilter</summary>
        <div className="editor-fields">
          <label>
            Bereich
            <select
              value={spaceId}
              onChange={(event) => setSpaceId(event.target.value)}
            >
              <option value="">Alle Bereiche</option>
              {[...spaces].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Art
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="">Alle Arten</option>
              <option value="block">Block</option>
              {Object.entries(KIND_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Blockdatum ab
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            Blockdatum bis
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setSpaceId("");
              setKind("");
              setFrom("");
              setTo("");
            }}
          >
            Filter zurücksetzen
          </button>
        </div>
      </details>
      <p className="label">
        {total === 0
          ? "Kein Treffer"
          : `${total} Treffer für „${response.query}“`}
      </p>

      {total === 0 && (
        <p className="empty">
          Suche nach Blocktiteln, Notizzeilen, Tasks oder Terminen.
        </p>
      )}

      {blocks.map((hit) => (
        <button
          key={hit.block.id}
          type="button"
          className={styles.res}
          onClick={() => onJumpToBlock(hit.block.id, hit.page.id, hit.space.id)}
        >
          <span className={`${styles.restype} label label--muted`}>
            Block · {hit.templateLabel ?? "Ohne Template"}
          </span>
          <span className={styles.restitle}>{highlight(hit.block.title)}</span>
          <span className={styles.respath}>
            {hit.space.name} · {hit.page.title} · {formatShort(hit.block.date)}
          </span>
        </button>
      ))}

      {items.map((hit) => (
        <button
          key={hit.item.id}
          type="button"
          className={styles.res}
          onClick={() =>
            onJumpToBlock(hit.block.id, hit.page.id, hit.space.id, hit.item.id)
          }
        >
          <span className={`${styles.restype} label label--muted`}>
            {KIND_LABEL[hit.item.kind]}
          </span>
          <span className={styles.restitle}>{highlight(hit.item.text)}</span>
          <span className={styles.respath}>
            {hit.space.name} · {hit.page.title} · {hit.block.title}
          </span>
        </button>
      ))}
    </div>
  );
}
