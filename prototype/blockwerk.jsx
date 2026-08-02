import React, { useState, useEffect, useMemo, useRef } from "react";

/* ============================================================
   Blockwerk — Notizen, Tasks und Termine als ein Objektmodell.
   Bereich → Seite → Block → Item (Text | Task | Termin | Verweis)
   ============================================================ */

const STORE_KEY = "blockwerk:v1";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const z = new Date(d); z.setDate(z.getDate() + n); return z; };
const uid = () => Math.random().toString(36).slice(2, 10);

const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);

const fmtShort = (s) => { const d = fromIso(s); return `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`; };
const relLabel = (s) => {
  const diff = Math.round((fromIso(s) - TODAY) / 86400000);
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === -1) return "gestern";
  if (diff < 0) return `${Math.abs(diff)} T überfällig`;
  return `in ${diff} T`;
};

/* ---------- Textzeile mit #-Überschriftserkennung ---------- */
const HEAD_RE = /^(#{1,3})\s+(.*)$/;
function textItem(blockId, raw) {
  const m = raw.match(HEAD_RE);
  return m
    ? { id: uid(), blockId, kind: "text", heading: Math.min(m[1].length, 2), text: m[2] }
    : { id: uid(), blockId, kind: "text", text: raw };
}

/* ---------- Block-Templates: liegen in den Daten, damit sie bearbeitbar sind ---------- */
const HUES = [
  { key: "steel", name: "Blau" },
  { key: "moss",  name: "Grün" },
  { key: "plum",  name: "Violett" },
  { key: "amber", name: "Orange" },
  { key: "ink",   name: "Grau" },
];
const DEFAULT_TEMPLATES = [
  { id: "meeting",  label: "Meeting",      hue: "steel", seed: ["# Teilnehmer", "# Agenda", "# Entscheidungen"] },
  { id: "oneonone", label: "1:1",          hue: "plum",  seed: ["# Stimmung", "# Themen aus letzter Woche"] },
  { id: "personal", label: "Persönlich",   hue: "moss",  seed: [] },
  { id: "research", label: "Recherche",    hue: "ink",   seed: ["# Fragestellung", "# Quellen"] },
  { id: "decision", label: "Entscheidung", hue: "amber", seed: ["# Kontext", "# Optionen", "# Beschluss"] },
];
const FALLBACK_TPL = { id: "?", label: "Ohne Template", hue: "ink", seed: [] };

/* ---------- Seed ---------- */
function seedData() {
  const s = {
    lena:  { id: "lena",  name: "Lena Brandt",   kind: "person", short: "LB" },
    tomas: { id: "tomas", name: "Tomas Kirsch",  kind: "person", short: "TK" },
    amira: { id: "amira", name: "Amira Sy",      kind: "person", short: "AS" },
    road:  { id: "road",  name: "Roadmap Q3",    kind: "topic",  short: "RQ" },
    feed:  { id: "feed",  name: "Kundenfeedback",kind: "topic",  short: "KF" },
  };
  const pages = [
    { id: "p1", spaceId: "road", title: "Planung" },
    { id: "p2", spaceId: "road", title: "Architektur" },
    { id: "p3", spaceId: "feed", title: "Interviews" },
    { id: "p4", spaceId: "lena", title: "Notizen" },
    { id: "p5", spaceId: "tomas", title: "Notizen" },
    { id: "p6", spaceId: "amira", title: "Notizen" },
  ];
  const b1 = "b1", b2 = "b2", b3 = "b3", b4 = "b4";
  const blocks = [
    { id: b1, pageId: "p1", type: "meeting", title: "Quartalsplanung Q3", date: iso(addDays(TODAY, -2)) },
    { id: b2, pageId: "p1", type: "decision", title: "Editor: eigener Kern statt Fremdbibliothek", date: iso(TODAY) },
    { id: b3, pageId: "p3", type: "meeting", title: "Interview Nordbau GmbH", date: iso(addDays(TODAY, 1)) },
    { id: b4, pageId: "p4", type: "personal", title: "Woche sortieren", date: iso(TODAY) },
  ];
  const items = [
    { id: uid(), blockId: b1, kind: "text", heading: 1, text: "Teilnehmer" },
    { id: uid(), blockId: b1, kind: "text", text: "Lena, Tomas, Amira" },
    { id: uid(), blockId: b1, kind: "text", heading: 1, text: "Agenda" },
    { id: uid(), blockId: b1, kind: "text", text: "Kapazitäten, Interviewwelle, Budget" },
    { id: uid(), blockId: b1, kind: "task", text: "Kapazitätsplan für Q3 aufstellen", assignee: "tomas", due: iso(addDays(TODAY, 3)), done: false },
    { id: uid(), blockId: b1, kind: "task", text: "Kundenliste für Interviews kuratieren", assignee: "amira", due: iso(addDays(TODAY, 1)), done: false },
    { id: uid(), blockId: b1, kind: "task", text: "Budgetfreigabe einholen", assignee: "lena", due: iso(addDays(TODAY, -1)), done: false },
    { id: uid(), blockId: b1, kind: "event", text: "Follow-up Runde", date: iso(addDays(TODAY, 5)), time: "10:30" },
    { id: uid(), blockId: b2, kind: "text", heading: 1, text: "Kontext" },
    { id: uid(), blockId: b2, kind: "text", text: "Fremdeditor bringt 400 kB und kein Blockmodell mit." },
    { id: uid(), blockId: b2, kind: "text", heading: 1, text: "Beschluss" },
    { id: uid(), blockId: b2, kind: "text", text: "Eigener Kern, Slash-Menü zuerst." },
    { id: uid(), blockId: b2, kind: "task", text: "Spike Editorkern, 3 Tage", assignee: "tomas", due: iso(addDays(TODAY, 7)), done: false },
    { id: uid(), blockId: b3, kind: "text", heading: 1, text: "Teilnehmer" },
    { id: uid(), blockId: b3, kind: "text", text: "Amira, Herr Voss (Nordbau)" },
    { id: uid(), blockId: b3, kind: "event", text: "Videocall Nordbau", date: iso(addDays(TODAY, 1)), time: "14:00" },
    { id: uid(), blockId: b3, kind: "task", text: "Gesprächsleitfaden schicken", assignee: "amira", due: iso(TODAY), done: true },
    { id: uid(), blockId: b4, kind: "text", text: "Diese Woche: weniger Meetings, mehr Schreibzeit." },
    { id: uid(), blockId: b4, kind: "task", text: "Onboarding-Text überarbeiten", assignee: "lena", due: iso(addDays(TODAY, 2)), done: false },
  ];
  return { spaces: Object.values(s), pages, blocks, items, templates: DEFAULT_TEMPLATES };
}

/* ---------- Token-Parser für das Composer-Feld ---------- */
function parseTokens(raw, spaces) {
  let text = raw;
  let assignee = null, due = null, time = null;

  const at = text.match(/@([\p{L}]+)/u);
  if (at) {
    const q = at[1].toLowerCase();
    const hit = spaces.find((sp) => sp.kind === "person" && (sp.name.toLowerCase().startsWith(q) || sp.name.toLowerCase().split(" ").some((w) => w.startsWith(q))));
    if (hit) { assignee = hit.id; text = text.replace(at[0], "").trim(); }
  }

  const tm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (tm) { time = `${String(tm[1]).padStart(2, "0")}:${tm[2]}`; text = text.replace(tm[0], "").trim(); }

  const bang = text.match(/!(\S+)/);
  if (bang) {
    const t = bang[1].toLowerCase();
    let d = null;
    if (t === "heute") d = TODAY;
    else if (t === "morgen") d = addDays(TODAY, 1);
    else if (t === "übermorgen" || t === "uebermorgen") d = addDays(TODAY, 2);
    else if (WD.map((w) => w.toLowerCase()).includes(t)) {
      const target = WD.map((w) => w.toLowerCase()).indexOf(t);
      let k = 1; while (addDays(TODAY, k).getDay() !== target && k < 8) k++;
      d = addDays(TODAY, k);
    } else {
      const m = t.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?$/);
      if (m) {
        const yr = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : TODAY.getFullYear();
        d = new Date(yr, +m[2] - 1, +m[1]);
      }
    }
    if (d) { due = iso(d); text = text.replace(bang[0], "").trim(); }
  }
  return { text: text.replace(/\s{2,}/g, " ").trim(), assignee, due, time };
}

/* ============================================================
   App
   ============================================================ */
export default function Blockwerk() {
  const [data, setData] = useState(null);
  const [spaceId, setSpaceId] = useState("road");
  const [pageId, setPageId] = useState("p1");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [pane, setPane] = useState("stream");
  const [tplOpen, setTplOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await window.storage.get(STORE_KEY);
        if (alive && r && r.value) {
          const parsed = JSON.parse(r.value);
          if (!parsed.templates || !parsed.templates.length) parsed.templates = DEFAULT_TEMPLATES;
          setData(parsed);
          return;
        }
      } catch (e) { /* noch nichts gespeichert */ }
      if (alive) setData(seedData());
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!data) return;
    (async () => {
      try { await window.storage.set(STORE_KEY, JSON.stringify(data)); setLoadErr(false); }
      catch (e) { setLoadErr(true); }
    })();
  }, [data]);

  const say = (msg) => { setFlash(msg); window.setTimeout(() => setFlash(null), 2200); };

  /* Alle Hooks laufen vor dem Early Return — sonst wechselt die Hook-Anzahl. */

  /* ---------- Suche ---------- */
  const results = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hitBlocks = data.blocks.filter((b) => b.title.toLowerCase().includes(q));
    const hitItems = data.items.filter((i) => (i.text || "").toLowerCase().includes(q));
    return { hitBlocks, hitItems };
  }, [query, data]);

  /* ---------- Datumsleiste ---------- */
  const monthDays = useMemo(() => {
    if (!data) return [];
    const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: n }, (_, k) => {
      const d = new Date(month.getFullYear(), month.getMonth(), k + 1);
      const key = iso(d);
      return {
        date: d, key,
        blocks: data.blocks.filter((b) => b.date === key),
        tasks: data.items.filter((i) => i.kind === "task" && i.due === key),
        events: data.items.filter((i) => i.kind === "event" && i.date === key),
      };
    });
  }, [month, data]);

  if (!data) return <div className="bw bw-boot">Arbeitsbereich wird geladen…</div>;

  const { spaces, pages, blocks, items } = data;
  const space = spaces.find((s) => s.id === spaceId) || spaces[0];
  const spacePages = pages.filter((p) => p.spaceId === space.id);
  const mirrorMode = pageId === "mirror";
  const page = spacePages.find((p) => p.id === pageId) || spacePages[0];

  const blockOf = (id) => blocks.find((b) => b.id === id);
  const pageOf = (id) => pages.find((p) => p.id === id);
  const spaceOf = (id) => spaces.find((s) => s.id === id);
  const itemsOf = (bid) => items.filter((i) => i.blockId === bid);

  const templates = data.templates && data.templates.length ? data.templates : DEFAULT_TEMPLATES;
  const tplOf = (id) => templates.find((t) => t.id === id) || FALLBACK_TPL;

  const openFor = (sid) => items.filter((i) => i.kind === "task" && i.assignee === sid && !i.done);

  /* ---------- Bereiche ---------- */
  const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "??";

  const addSpace = (name, kind) => {
    const id = uid(), pid = uid();
    setData((d) => ({
      ...d,
      spaces: [...d.spaces, { id, name: name.trim(), kind, short: initials(name) }],
      pages: [...d.pages, { id: pid, spaceId: id, title: "Notizen" }],
    }));
    setSpaceId(id); setPageId(kind === "person" ? "mirror" : pid); setPane("stream");
    say(`Bereich „${name.trim()}" angelegt`);
  };

  const removeSpace = (id) => {
    setData((d) => {
      const doomedPages = d.pages.filter((p) => p.spaceId === id).map((p) => p.id);
      const doomedBlocks = d.blocks.filter((b) => doomedPages.includes(b.pageId)).map((b) => b.id);
      return {
        ...d,
        spaces: d.spaces.filter((s) => s.id !== id),
        pages: d.pages.filter((p) => p.spaceId !== id),
        blocks: d.blocks.filter((b) => !doomedBlocks.includes(b.id)),
        /* Tasks anderswo bleiben bestehen, verlieren aber ihre Zuständigkeit. */
        items: d.items
          .filter((i) => !doomedBlocks.includes(i.blockId))
          .map((i) => (i.assignee === id ? { ...i, assignee: null } : i)),
      };
    });
    if (spaceId === id) {
      const next = spaces.find((s) => s.id !== id);
      if (next) { setSpaceId(next.id); const f = pages.find((p) => p.spaceId === next.id); setPageId(f ? f.id : "mirror"); }
    }
    say("Bereich entfernt");
  };

  /* ---------- Templates ---------- */
  const addTemplate = () => {
    const id = uid();
    setData((d) => ({ ...d, templates: [...(d.templates || DEFAULT_TEMPLATES), { id, label: "Neues Template", hue: "ink", seed: [] }] }));
  };
  const patchTemplate = (id, patch) =>
    setData((d) => ({ ...d, templates: (d.templates || DEFAULT_TEMPLATES).map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const removeTemplate = (id) =>
    setData((d) => ({ ...d, templates: (d.templates || DEFAULT_TEMPLATES).filter((t) => t.id !== id) }));

  /* ---------- Mutationen ---------- */
  const addBlock = (type) => {
    const bid = uid();
    const seeds = tplOf(type).seed.map((t) => textItem(bid, t));
    setData((d) => ({
      ...d,
      blocks: [{ id: bid, pageId: page.id, type, title: `Neuer ${tplOf(type).label}`, date: iso(TODAY) }, ...d.blocks],
      items: [...d.items, ...seeds],
    }));
    say(`${tplOf(type).label} angelegt`);
  };

  const patchBlock = (id, patch) => setData((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  const removeBlock = (id) => setData((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id), items: d.items.filter((i) => i.blockId !== id) }));
  const addItem = (item) => setData((d) => ({ ...d, items: [...d.items, item] }));
  const patchItem = (id, patch) => setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const removeItem = (id) => setData((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));

  const focusLine = (id) => window.setTimeout(() => {
    const el = document.getElementById(`in-${id}`);
    if (el) { el.focus(); if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); }
  }, 0);

  /* Neue Notizzeile direkt hinter einer bestehenden — nicht am Blockende. */
  const insertAfter = (afterId, blockId) => {
    const line = { id: uid(), blockId, kind: "text", text: "" };
    setData((d) => {
      const idx = d.items.findIndex((i) => i.id === afterId);
      const next = [...d.items];
      next.splice(idx < 0 ? next.length : idx + 1, 0, line);
      return { ...d, items: next };
    });
    focusLine(line.id);
  };

  const removeLine = (id, prevId) => { removeItem(id); if (prevId) focusLine(prevId); };

  const jumpTo = (bid) => {
    const b = blockOf(bid); if (!b) return;
    const p = pageOf(b.pageId);
    setSpaceId(p.spaceId); setPageId(p.id); setPane("stream"); setQuery("");
    window.setTimeout(() => {
      const el = document.getElementById(`blk-${bid}`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("blk--pulse"); window.setTimeout(() => el.classList.remove("blk--pulse"), 1400); }
    }, 60);
  };

  const monthLoad = monthDays.reduce((a, d) => a + d.blocks.length + d.tasks.length + d.events.length, 0);

  /* Volle Tage einzeln, leere Tagesläufe zu einer Zeile zusammengefasst:
     der Monatsrhythmus bleibt sichtbar, ohne 20 fast leere Zeilen. */
  const ledgerRows = [];
  let run = null;
  monthDays.forEach((d) => {
    const load = d.blocks.length + d.tasks.length + d.events.length;
    if (load === 0) {
      if (run) run.count += 1;
      else run = { type: "gap", from: d.key, count: 1 };
      return;
    }
    if (run) { ledgerRows.push(run); run = null; }
    ledgerRows.push({ type: "day", day: d });
  });
  if (run) ledgerRows.push(run);

  return (
    <div className="bw">
      <style>{CSS}</style>

      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <span className="wordmark">Blockwerk</span>
          <span className="tagline">ein Objektmodell für Notizen, Tasks und Termine</span>
        </div>
        <div className="searchwrap">
          <input
            className="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (e.target.value) setPane("stream"); }}
            placeholder="Blöcke, Tasks und Termine durchsuchen"
            aria-label="Durchsuchen"
          />
          {query && <button className="clear" onClick={() => setQuery("")}>Suche verlassen</button>}
        </div>
      </header>

      <div className="app">
        {/* ---------- Bereiche ---------- */}
        <aside className={`col rail ${pane === "spaces" ? "is-open" : ""}`}>
          <h2 className="colhead">Bereiche</h2>
          <SpaceGroup
            title="Personen" kind="person" list={spaces.filter((s) => s.kind === "person")}
            active={space.id} openFor={openFor} onAdd={addSpace} onRemove={removeSpace}
            onPick={(id) => { setSpaceId(id); setPageId("mirror"); setPane("stream"); }}
          />
          <SpaceGroup
            title="Themen" kind="topic" list={spaces.filter((s) => s.kind === "topic")}
            active={space.id} openFor={openFor} onAdd={addSpace} onRemove={removeSpace}
            onPick={(id) => { setSpaceId(id); const f = pages.find((p) => p.spaceId === id); setPageId(f ? f.id : "mirror"); setPane("stream"); }}
          />
          <div className="railfoot">
            <button className="railbtn" onClick={() => setTplOpen(true)}>Templates bearbeiten</button>
            <p>Ein Task, der an eine Person geht, wird nicht kopiert. Er erscheint gespiegelt in ihrem Bereich — abhaken wirkt an beiden Stellen.</p>
          </div>
        </aside>

        {/* ---------- Stream ---------- */}
        <main className={`col stream ${pane === "stream" ? "is-open" : ""}`}>
          {results ? (
            <SearchResults
              results={results} blockOf={blockOf} pageOf={pageOf} spaceOf={spaceOf} tplOf={tplOf}
              onJump={jumpTo} query={query}
            />
          ) : (
            <>
              <div className="streamhead">
                <div className="crumb">
                  <span className={`dot dot--${space.kind}`} />
                  <strong>{space.name}</strong>
                </div>
                <nav className="tabs">
                  {space.kind === "person" && (
                    <button className={`tab ${mirrorMode ? "is-on" : ""}`} onClick={() => setPageId("mirror")}>
                      Zugewiesen <span className="cnt">{openFor(space.id).length}</span>
                    </button>
                  )}
                  {spacePages.map((p) => (
                    <button key={p.id} className={`tab ${!mirrorMode && page && page.id === p.id ? "is-on" : ""}`} onClick={() => setPageId(p.id)}>
                      {p.title}
                    </button>
                  ))}
                  <button
                    className="tab tab--add"
                    onClick={() => {
                      const id = uid();
                      setData((d) => ({ ...d, pages: [...d.pages, { id, spaceId: space.id, title: "Neue Seite" }] }));
                      setPageId(id);
                    }}
                  >+ Seite</button>
                </nav>
              </div>

              {mirrorMode ? (
                <MirrorPage
                  space={space} tasks={items.filter((i) => i.kind === "task" && i.assignee === space.id)}
                  blockOf={blockOf} pageOf={pageOf} spaceOf={spaceOf}
                  onToggle={(id, done) => patchItem(id, { done })} onJump={jumpTo}
                />
              ) : page ? (
                <>
                  <NewBlockBar onAdd={addBlock} templates={templates} onManage={() => setTplOpen(true)} />
                  <div className="blocks">
                    {blocks.filter((b) => b.pageId === page.id)
                      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
                      .map((b) => (
                        <BlockCard
                          key={b.id} block={b} items={itemsOf(b.id)} spaces={spaces} blocks={blocks}
                          blockOf={blockOf} spaceOf={spaceOf} tplOf={tplOf}
                          onPatch={patchBlock} onRemove={removeBlock}
                          onAddItem={addItem} onPatchItem={patchItem} onRemoveItem={removeItem}
                          onInsertAfter={insertAfter} onRemoveLine={removeLine}
                          onJump={jumpTo} say={say}
                        />
                      ))}
                    {blocks.filter((b) => b.pageId === page.id).length === 0 && (
                      <p className="empty">Diese Seite ist leer. Leg oben einen Block an — er bekommt automatisch das heutige Datum und taucht damit in der Datumsleiste auf.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="empty">Dieser Bereich hat noch keine Seite.</p>
              )}
            </>
          )}
        </main>

        {/* ---------- Datumsleiste (Signatur) ---------- */}
        <aside className={`col dates ${pane === "dates" ? "is-open" : ""}`}>
          <div className="monthbar">
            <button className="mnav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Vorheriger Monat">‹</button>
            <h2 className="colhead colhead--flush">{MONTHS[month.getMonth()]} <span className="yr">{month.getFullYear()}</span></h2>
            <button className="mnav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Nächster Monat">›</button>
          </div>
          <p className="monthmeta">{monthLoad} datierte Einträge im Monat</p>
          <div className="ledger">
            {ledgerRows.map((row) => {
              if (row.type === "gap") {
                return (
                  <div key={`gap-${row.from}`} className="gap">
                    <span>{row.count === 1 ? "ein Tag ohne Einträge" : `${row.count} Tage ohne Einträge`}</span>
                  </div>
                );
              }
              const d = row.day;
              const isToday = d.key === iso(TODAY);
              return (
                <section key={d.key} className={`dayblock ${isToday ? "is-today" : ""}`}>
                  <header className="dayhead">
                    <span className="dwd">{WD[d.date.getDay()]}</span>
                    <span className="dnum">{d.date.getDate()}. {MONTHS[d.date.getMonth()].slice(0, 3)}</span>
                    {isToday && <span className="todaytag">heute</span>}
                  </header>

                  {d.events.map((e) => (
                    <button key={e.id} className="card card--event" onClick={() => jumpTo(e.blockId)}>
                      <span className="cardtitle">{e.text}</span>
                      <span className="cardmeta">
                        <span className="cardkind">Termin</span>
                        {e.time && <span className="cardtime">{e.time}</span>}
                      </span>
                    </button>
                  ))}

                  {d.tasks.map((t) => {
                    const late = !t.done && t.due < iso(TODAY);
                    return (
                      <button key={t.id} className={`card card--task ${t.done ? "is-done" : ""} ${late ? "is-late" : ""}`} onClick={() => jumpTo(t.blockId)}>
                        <span className="cardtitle">{t.text}</span>
                        <span className="cardmeta">
                          <span className="cardkind">{t.done ? "erledigt" : late ? "überfällig" : "fällig"}</span>
                          {t.assignee && <span className="cardwho">{spaceOf(t.assignee).name.split(" ")[0]}</span>}
                        </span>
                      </button>
                    );
                  })}

                  {d.blocks.map((b) => (
                    <button key={b.id} className={`card card--block hue-${tplOf(b.type).hue}`} onClick={() => jumpTo(b.id)}>
                      <span className="cardtitle">{b.title}</span>
                      <span className="cardmeta">
                        <span className="cardkind">{tplOf(b.type).label}</span>
                      </span>
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
        </aside>
      </div>

      <nav className="panebar">
        <button className={pane === "spaces" ? "is-on" : ""} onClick={() => setPane("spaces")}>Bereiche</button>
        <button className={pane === "stream" ? "is-on" : ""} onClick={() => setPane("stream")}>Stream</button>
        <button className={pane === "dates" ? "is-on" : ""} onClick={() => setPane("dates")}>Datumsleiste</button>
      </nav>

      {tplOpen && (
        <TemplateManager
          templates={templates} onAdd={addTemplate} onPatch={patchTemplate}
          onRemove={removeTemplate} onClose={() => setTplOpen(false)}
        />
      )}

      {flash && <div className="flash">{flash}</div>}
      {loadErr && <div className="flash flash--warn">Speichern fehlgeschlagen. Änderungen bleiben nur in dieser Sitzung erhalten.</div>}
    </div>
  );
}

/* ============================================================
   Teilkomponenten
   ============================================================ */

function SpaceGroup({ title, kind, list, active, onPick, openFor, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const submit = () => { if (!name.trim()) return; onAdd(name, kind); setName(""); setAdding(false); };

  return (
    <section className="sgroup">
      <h3 className="sgrouphead">
        {title}
        <button className="sadd" onClick={() => setAdding((v) => !v)} aria-label={`${title} hinzufügen`} title="Bereich anlegen">+</button>
      </h3>

      {adding && (
        <div className="saddrow">
          <input
            autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setName(""); } }}
            placeholder={kind === "person" ? "Name" : "Thema"} aria-label="Name des Bereichs"
          />
          <button className="saddgo" onClick={submit}>Anlegen</button>
        </div>
      )}

      <ul className="slist">
        {list.map((s) => {
          const open = openFor(s.id).length;
          if (confirmId === s.id) {
            return (
              <li key={s.id} className="sconfirm">
                <span>„{s.name}" mit allen Seiten löschen?</span>
                <div>
                  <button className="sdel" onClick={() => { onRemove(s.id); setConfirmId(null); }}>Löschen</button>
                  <button className="scancel" onClick={() => setConfirmId(null)}>Abbrechen</button>
                </div>
              </li>
            );
          }
          return (
            <li key={s.id} className="srow">
              <button className={`sitem ${active === s.id ? "is-on" : ""}`} onClick={() => onPick(s.id)}>
                <span className={`sbadge sbadge--${s.kind}`}>{s.short}</span>
                <span className="sname">{s.name}</span>
                {s.kind === "person" && open > 0 && <span className="sopen">{open}</span>}
              </button>
              <button className="skill" onClick={() => setConfirmId(s.id)} aria-label={`${s.name} entfernen`} title="Bereich entfernen">×</button>
            </li>
          );
        })}
        {list.length === 0 && <li className="grpempty">Noch keiner angelegt</li>}
      </ul>
    </section>
  );
}

function NewBlockBar({ onAdd, templates, onManage }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="newbar">
      <button className="newbtn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Block anlegen
      </button>
      {open && (
        <div className="tmenu">
          {templates.map((t) => (
            <button key={t.id} className={`titem hue-${t.hue}`} onClick={() => { onAdd(t.id); setOpen(false); }}>
              <span className="tlabel">{t.label}</span>
              <span className="tseed">{t.seed.length ? `${t.seed.length} Zeilen` : "leer"}</span>
            </button>
          ))}
          <button className="titem titem--manage" onClick={() => { setOpen(false); onManage(); }}>
            <span className="tlabel">Templates bearbeiten…</span>
          </button>
        </div>
      )}
      <p className="newhint">Pfeiltasten wählen Zeilen aus, Leertaste hakt einen Task ab, Enter schreibt in der Zeile.</p>
    </div>
  );
}

function TemplateManager({ templates, onAdd, onPatch, onRemove, onClose }) {
  const [confirmId, setConfirmId] = useState(null);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Templates bearbeiten"
           onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <header className="sheethead">
          <h2>Templates</h2>
          <button className="sheetclose" onClick={onClose} aria-label="Schließen">×</button>
        </header>
        <p className="sheetnote">Jede Zeile im Feld wird zu einer Notizzeile im neuen Block. Ein <strong>#</strong> davor macht daraus eine Überschrift.</p>

        <div className="tpllist">
          {templates.map((t) => (
            <section key={t.id} className={`tplcard hue-${t.hue}`}>
              <div className="tplrow">
                <input className="tplname" value={t.label} onChange={(e) => onPatch(t.id, { label: e.target.value })} aria-label="Name des Templates" />
                <select className="tplhue" value={t.hue} onChange={(e) => onPatch(t.id, { hue: e.target.value })} aria-label="Farbe">
                  {HUES.map((h) => <option key={h.key} value={h.key}>{h.name}</option>)}
                </select>
                {confirmId === t.id ? (
                  <span className="tplconfirm">
                    <button className="sdel" onClick={() => { onRemove(t.id); setConfirmId(null); }}>Löschen</button>
                    <button className="scancel" onClick={() => setConfirmId(null)}>Abbrechen</button>
                  </span>
                ) : (
                  <button className="tplkill" onClick={() => setConfirmId(t.id)}>Entfernen</button>
                )}
              </div>
              <textarea
                className="tplseed" rows={Math.max(3, t.seed.length + 1)}
                value={t.seed.join("\n")}
                onChange={(e) => onPatch(t.id, { seed: e.target.value.split("\n").filter((l, i, a) => l.trim() !== "" || i < a.length - 1) })}
                placeholder="# Teilnehmer&#10;# Agenda"
                aria-label="Vorbelegte Zeilen"
              />
            </section>
          ))}
        </div>

        <button className="newbtn" onClick={onAdd}>Template hinzufügen</button>
      </div>
    </div>
  );
}

function BlockCard({ block, items, spaces, blocks, blockOf, spaceOf, tplOf, onPatch, onRemove, onAddItem, onPatchItem, onRemoveItem, onInsertAfter, onRemoveLine, onJump, say }) {
  const tpl = tplOf(block.type);
  let underHead = false;
  let prevId = null;
  const notes = items
    .filter((i) => i.kind === "text" || i.kind === "ref")
    .map((it) => {
      const row = { it, indent: it.kind === "text" && it.heading ? false : underHead, prevId };
      if (it.kind === "text" && it.heading) underHead = true;
      prevId = it.id;
      return row;
    });
  const tasks = items.filter((i) => i.kind === "task");
  const events = items
    .filter((i) => i.kind === "event")
    .sort((a, b) => `${a.date || ""}${a.time || ""}`.localeCompare(`${b.date || ""}${b.time || ""}`));
  const doneN = tasks.filter((t) => t.done).length;

  /* Zeilenreihenfolge für die Pfeiltasten: Notizen → Tasks → Folgetermine */
  const order = [...notes.map((n) => n.it.id), ...tasks.map((t) => t.id), ...events.map((e) => e.id)];
  const nav = (id, dir) => {
    const j = order.indexOf(id) + dir;
    if (j < 0 || j >= order.length) return;
    const el = document.getElementById(`row-${order[j]}`);
    if (el) el.focus();
  };

  return (
    <article className={`blk hue-${tpl.hue}`} id={`blk-${block.id}`}>
      <header className="blkhead">
        <div className="blktop">
          <span className="pill">{tpl.label}</span>
          <label className="datefield">
            <span className="sr">Blockdatum</span>
            <input type="date" value={block.date} onChange={(e) => e.target.value && onPatch(block.id, { date: e.target.value })} />
          </label>
          {tasks.length > 0 && <span className="meta">{doneN}/{tasks.length} Tasks</span>}
          {events.length > 0 && <span className="meta">{events.length} {events.length === 1 ? "Termin" : "Termine"}</span>}
          <button className="mkill" onClick={() => onRemove(block.id)}>Löschen</button>
        </div>
        <input className="blktitle" value={block.title} onChange={(e) => onPatch(block.id, { title: e.target.value })} aria-label="Blocktitel" placeholder="Titel" />
      </header>

      <div className="sections">
        <ul className="items">
          {notes.map(({ it, indent, prevId }) => (
            <ItemRow
              key={it.id} item={it} indent={indent} spaceOf={spaceOf}
              onPatch={onPatchItem} onRemove={onRemoveItem} onJump={onJump} blockOf={blockOf}
              onEnter={() => onInsertAfter(it.id, block.id)}
              onBackspaceEmpty={() => onRemoveLine(it.id, prevId)}
              onNav={(dir) => nav(it.id, dir)}
            />
          ))}
          {notes.length === 0 && <li className="grpempty">Noch keine Notizen</li>}
        </ul>

        {tasks.length > 0 && (
          <section className="grp">
            <h4 className="grphead">Tasks <span>{doneN}/{tasks.length}</span></h4>
            <ul className="items">
              {tasks.map((it) => (
                <ItemRow key={it.id} item={it} spaceOf={spaceOf} onPatch={onPatchItem} onRemove={onRemoveItem} onJump={onJump} blockOf={blockOf} onNav={(dir) => nav(it.id, dir)} />
              ))}
            </ul>
          </section>
        )}

        {events.length > 0 && (
          <section className="grp">
            <h4 className="grphead">Folgetermine <span>{events.length}</span></h4>
            <ul className="items">
              {events.map((it) => (
                <ItemRow key={it.id} item={it} spaceOf={spaceOf} onPatch={onPatchItem} onRemove={onRemoveItem} onJump={onJump} blockOf={blockOf} onNav={(dir) => nav(it.id, dir)} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <Composer
        blockId={block.id} spaces={spaces} blocks={blocks} blockOf={blockOf}
        onAdd={(it) => { onAddItem(it); if (it.kind === "task" && it.assignee) say(`Task gespiegelt nach ${spaceOf(it.assignee).name}`); }}
      />
    </article>
  );
}

function ItemRow({ item, indent, spaceOf, onPatch, onRemove, onJump, blockOf, onEnter, onBackspaceEmpty, onNav }) {
  const inClass = indent ? " is-in" : "";
  const focusRow = () => { const el = document.getElementById(`row-${item.id}`); if (el) el.focus(); };
  const focusField = () => {
    const el = document.getElementById(`in-${item.id}`);
    if (el) { el.focus(); if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); }
  };

  /* Zwei Modi: Zeile ausgewählt (Leertaste hakt ab) oder Textcursor im Feld (Leertaste schreibt). */
  const rowKeys = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (onNav) onNav(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); if (onNav) onNav(-1); return; }

    const inField = e.target.tagName === "INPUT" || e.target.tagName === "SELECT";
    if (inField) {
      if (e.key === "Escape") { e.preventDefault(); focusRow(); return; }
      if (item.kind === "text") {
        if (e.key === "Enter") { e.preventDefault(); if (onEnter) onEnter(); return; }
        if (e.key === "Backspace" && !item.text) {
          if (item.heading) { e.preventDefault(); onPatch(item.id, { heading: null }); return; }
          if (onBackspaceEmpty) { e.preventDefault(); onBackspaceEmpty(); }
        }
      }
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      if (item.kind === "task") onPatch(item.id, { done: !item.done });
      else focusField();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (item.kind === "ref") { if (item.refId) onJump(item.refId); } else focusField();
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onRemove(item.id); }
  };

  const row = (cls) => ({ id: `row-${item.id}`, tabIndex: -1, onKeyDown: rowKeys, className: cls });

  if (item.kind === "task") {
    const who = item.assignee ? spaceOf(item.assignee) : null;
    const late = item.due && !item.done && item.due < iso(TODAY);
    return (
      <li {...row(`it it--task${item.done ? " is-done" : ""}`)}>
        <button className="check" onClick={() => onPatch(item.id, { done: !item.done })} aria-pressed={item.done} aria-label={item.done ? "Als offen markieren" : "Als erledigt markieren"}>
          <span />
        </button>
        <input id={`in-${item.id}`} className="ittext" value={item.text} onChange={(e) => onPatch(item.id, { text: e.target.value })} aria-label="Task" />
        <span className="itmeta">
          {who && <em className="who">{who.short}</em>}
          {item.due && <span className={`due ${late ? "is-late" : ""}`}>{fmtShort(item.due)} · {relLabel(item.due)}</span>}
        </span>
        <button className="itkill" onClick={() => onRemove(item.id)} aria-label="Task entfernen">×</button>
      </li>
    );
  }

  if (item.kind === "event") {
    return (
      <li {...row("it it--event")}>
        <span className="evtime">{item.time || "—"}</span>
        <input id={`in-${item.id}`} className="ittext" value={item.text} onChange={(e) => onPatch(item.id, { text: e.target.value })} aria-label="Termin" />
        <span className="itmeta"><span className="due">{item.date ? fmtShort(item.date) : "ohne Datum"}</span></span>
        <button className="itkill" onClick={() => onRemove(item.id)} aria-label="Termin entfernen">×</button>
      </li>
    );
  }

  if (item.kind === "ref") {
    const target = blockOf(item.refId);
    return (
      <li {...row(`it it--ref${inClass}`)}>
        <span className="refmark">→</span>
        {target ? (
          <button className="reflink" onClick={() => onJump(target.id)}>{target.title}<span className="refdate">{fmtShort(target.date)}</span></button>
        ) : <span className="ittext">Ziel entfernt</span>}
        <button className="itkill" onClick={() => onRemove(item.id)} aria-label="Verweis entfernen">×</button>
      </li>
    );
  }

  const onTextChange = (v) => {
    if (!item.heading) {
      const m = v.match(HEAD_RE);
      if (m) { onPatch(item.id, { heading: Math.min(m[1].length, 2), text: m[2] }); return; }
    }
    onPatch(item.id, { text: v });
  };

  if (item.heading) {
    return (
      <li {...row(`it it--head it--h${item.heading}`)}>
        <button className="hmark" onClick={() => onPatch(item.id, { heading: null })} title="In normalen Text umwandeln">
          {"#".repeat(item.heading)}
        </button>
        <input
          id={`in-${item.id}`} className="ittext headtext" value={item.text}
          onChange={(e) => onPatch(item.id, { text: e.target.value })}
          aria-label={`Überschrift Ebene ${item.heading}`}
        />
        <button className="hadd" onClick={() => onEnter && onEnter()} title="Zeile unter dieser Überschrift einfügen" aria-label="Zeile hier einfügen">+</button>
        <button className="itkill" onClick={() => onRemove(item.id)} aria-label="Überschrift entfernen">×</button>
      </li>
    );
  }

  return (
    <li {...row(`it it--text${inClass}`)}>
      <input
        id={`in-${item.id}`} className="ittext" value={item.text}
        onChange={(e) => onTextChange(e.target.value)}
        aria-label="Notiz" placeholder="# für eine Überschrift"
      />
      <button className="itkill" onClick={() => onRemove(item.id)} aria-label="Zeile entfernen">×</button>
    </li>
  );
}

const COMMANDS = [
  { key: "task",    label: "Task",       hint: "@Person und !datum werden erkannt" },
  { key: "termin",  label: "Termin",     hint: "!datum und 14:00 werden erkannt" },
  { key: "h1",      label: "Überschrift",hint: "oder einfach # am Zeilenanfang" },
  { key: "notiz",   label: "Notiz",      hint: "einfache Textzeile" },
  { key: "verweis", label: "Verweis",    hint: "auf einen anderen Block zeigen" },
];

function Composer({ blockId, spaces, blocks, blockOf, onAdd }) {
  const [val, setVal] = useState("");
  const [mode, setMode] = useState(null);
  const [sel, setSel] = useState(0);
  const [refTarget, setRefTarget] = useState("");
  const inputRef = useRef(null);

  const slashing = val.startsWith("/");
  const filter = slashing ? val.slice(1).toLowerCase() : "";
  const menu = slashing ? COMMANDS.filter((c) => c.label.toLowerCase().startsWith(filter) || c.key.startsWith(filter)) : [];

  const pick = (c) => { setMode(c.key); setVal(""); setSel(0); if (inputRef.current) inputRef.current.focus(); };

  const commit = () => {
    if (mode === "verweis") {
      if (!refTarget) return;
      onAdd({ id: uid(), blockId, kind: "ref", refId: refTarget });
      setRefTarget(""); setMode(null); return;
    }
    const raw = val.trim();
    if (!raw) return;
    const p = parseTokens(raw, spaces);
    if (!p.text) return;
    if (mode === "task") onAdd({ id: uid(), blockId, kind: "task", text: p.text, assignee: p.assignee, due: p.due, done: false });
    else if (mode === "termin") onAdd({ id: uid(), blockId, kind: "event", text: p.text, date: p.due || iso(TODAY), time: p.time });
    else if (mode === "h1") onAdd({ ...textItem(blockId, raw.replace(HEAD_RE, "$2")), heading: 1 });
    else onAdd(textItem(blockId, raw));
    setVal("");
  };

  const onKey = (e) => {
    if (menu.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % menu.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + menu.length) % menu.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(menu[sel]); return; }
    }
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setMode(null); setVal(""); }
    if (e.key === "Backspace" && !val && mode) setMode(null);
  };

  return (
    <div className="comp">
      <div className="comprow">
        {mode && <button className={`modechip mode-${mode}`} onClick={() => setMode(null)}>{COMMANDS.find((c) => c.key === mode).label}<span>×</span></button>}
        {mode === "verweis" ? (
          <select className="refsel" value={refTarget} onChange={(e) => setRefTarget(e.target.value)} aria-label="Zielblock">
            <option value="">Block wählen…</option>
            {blocks.filter((b) => b.id !== blockId).map((b) => (
              <option key={b.id} value={b.id}>{b.title} — {fmtShort(b.date)}</option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef} className="compin" value={val}
            onChange={(e) => { setVal(e.target.value); setSel(0); }}
            onKeyDown={onKey}
            placeholder={mode ? COMMANDS.find((c) => c.key === mode).hint : "/ für Befehle, # für eine Überschrift"}
            aria-label="Neue Zeile"
          />
        )}
        <button className="compgo" onClick={commit}>Hinzufügen</button>
      </div>

      {menu.length > 0 && (
        <ul className="slash" role="listbox">
          {menu.map((c, k) => (
            <li key={c.key}>
              <button className={`slashit ${k === sel ? "is-sel" : ""}`} onMouseEnter={() => setSel(k)} onClick={() => pick(c)}>
                <span className="slabel">/{c.key}</span><span className="shint">{c.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MirrorPage({ space, tasks, blockOf, pageOf, spaceOf, onToggle, onJump }) {
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const groups = {};
  open.forEach((t) => { (groups[t.blockId] = groups[t.blockId] || []).push(t); });

  return (
    <div className="mirror">
      <div className="mirrorhead">
        <h3>Offene Tasks für {space.name.split(" ")[0]}</h3>
        <p>Diese Tasks liegen physisch in ihren Ursprungsblöcken. Hier siehst du dieselben Objekte — jede Änderung wirkt an beiden Stellen.</p>
      </div>

      {Object.keys(groups).length === 0 && <p className="empty">Nichts offen. Sobald in einem Meeting ein Task mit @{space.name.split(" ")[0]} entsteht, erscheint er hier.</p>}

      {Object.entries(groups).map(([bid, list]) => {
        const b = blockOf(bid); if (!b) return null;
        const p = pageOf(b.pageId); const s = spaceOf(p.spaceId);
        return (
          <section key={bid} className="mgroup">
            <button className="msrc" onClick={() => onJump(bid)}>
              <span className="msrcpath">{s.name} · {p.title}</span>
              <span className="msrctitle">{b.title}</span>
              <span className="msrcdate">{fmtShort(b.date)}</span>
            </button>
            <ul className="items">
              {list.map((t) => {
                const late = t.due && t.due < iso(TODAY);
                return (
                  <li key={t.id} className="it it--task">
                    <button className="check" onClick={() => onToggle(t.id, true)} aria-label="Als erledigt markieren"><span /></button>
                    <span className="ittext ittext--ro">{t.text}</span>
                    {t.due && <span className={`due ${late ? "is-late" : ""}`}>{fmtShort(t.due)} · {relLabel(t.due)}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {done.length > 0 && (
        <section className="mgroup mgroup--done">
          <h4 className="donehead">Zuletzt erledigt</h4>
          <ul className="items">
            {done.map((t) => (
              <li key={t.id} className="it it--task is-done">
                <button className="check" onClick={() => onToggle(t.id, false)} aria-label="Als offen markieren"><span /></button>
                <span className="ittext ittext--ro">{t.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SearchResults({ results, blockOf, pageOf, spaceOf, tplOf, onJump, query }) {
  const { hitBlocks, hitItems } = results;
  const total = hitBlocks.length + hitItems.length;
  const path = (b) => { const p = pageOf(b.pageId); return `${spaceOf(p.spaceId).name} · ${p.title}`; };
  return (
    <div className="results">
      <p className="rescount">{total === 0 ? "Kein Treffer" : `${total} Treffer für „${query}“`}</p>
      {total === 0 && <p className="empty">Suche nach Blocktiteln, Notizzeilen, Tasks oder Terminen.</p>}
      {hitBlocks.map((b) => (
        <button key={b.id} className="res" onClick={() => onJump(b.id)}>
          <span className="restype">Block · {tplOf(b.type).label}</span>
          <span className="restitle">{b.title}</span>
          <span className="respath">{path(b)} · {fmtShort(b.date)}</span>
        </button>
      ))}
      {hitItems.map((i) => {
        const b = blockOf(i.blockId); if (!b) return null;
        const kind = i.kind === "task" ? "Task" : i.kind === "event" ? "Termin" : "Notiz";
        return (
          <button key={i.id} className="res" onClick={() => onJump(b.id)}>
            <span className="restype">{kind}</span>
            <span className="restitle">{i.text}</span>
            <span className="respath">{path(b)} · {b.title}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   Stil
   ============================================================ */
const CSS = `
.bw{
  --white:#FFFFFF; --bg:#FAFAFA; --side:#F5F6F8; --hover:#EDEEF0;
  --line:#E4E6E9; --line2:#EFF0F2;
  --text:#1D2125; --text2:#6B7075; --text3:#9BA0A6;
  --green:#00A82D; --green-dk:#00922A; --green-soft:#E8F6EC;
  --blue:#2F80ED; --blue-soft:#E9F1FD;
  --purple:#7A5AF8; --orange:#E8883A; --red:#E5484D; --grey:#7A828A;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI','Source Sans Pro',Roboto,'Helvetica Neue',Arial,sans-serif;
  --radius:6px;
  background:var(--white); color:var(--text); font-family:var(--sans);
  min-height:100vh; display:flex; flex-direction:column;
  font-size:14.5px; line-height:1.55; -webkit-font-smoothing:antialiased;
}
.bw *,.bw *::before,.bw *::after{box-sizing:border-box;}
.bw :where(button){font:inherit; color:inherit; background:none; border:none; cursor:pointer; text-align:left;}
.bw :where(input),.bw :where(select){font:inherit; color:inherit;}
.bw :focus-visible{outline:2px solid var(--green); outline-offset:1px; border-radius:3px;}
.bw-boot{padding:40px; color:var(--text2);}
.sr{position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0);}

/* Kopfleiste */
.top{display:flex; align-items:center; gap:20px; padding:10px 18px; border-bottom:1px solid var(--line); background:var(--white); flex-wrap:wrap;}
.brand{display:flex; align-items:center; gap:9px; min-width:0;}
.mark{width:26px; height:26px; border-radius:5px; background:var(--green); display:inline-block; position:relative;}
.mark::after{content:''; position:absolute; inset:8px 7px; border:2px solid #fff; border-top:0; border-right:0; border-bottom-left-radius:2px;}
.wordmark{font-size:16.5px; font-weight:600; letter-spacing:-0.01em;}
.tagline{font-size:12.5px; color:var(--text3);}
.searchwrap{margin-left:auto; display:flex; align-items:center; gap:10px; flex:1 1 240px; max-width:460px;}
.search{width:100%; padding:7px 13px; background:var(--side); border:1px solid transparent; border-radius:18px;}
.search:focus{background:var(--white); border-color:var(--line); outline:none; box-shadow:0 0 0 3px var(--green-soft);}
.search::placeholder{color:var(--text3);}
.clear{font-size:13px; color:var(--green); white-space:nowrap;}

/* Raster */
.app{flex:1; display:grid; grid-template-columns:236px minmax(0,1fr) 330px; min-height:0;}
.col{min-height:0; overflow-y:auto;}
.rail{background:var(--side); border-right:1px solid var(--line); padding:16px 10px 28px;}
.stream{background:var(--bg); padding:22px 26px 60px;}
.dates{border-left:1px solid var(--line); background:var(--white); padding:14px 0 60px;}
.colhead{font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--text3); margin:0 0 10px; padding:0 8px;}
.colhead--flush{margin:0; padding:0; font-size:15px; font-weight:600; text-transform:none; letter-spacing:0; color:var(--text);}

/* Bereiche */
.sgroup{margin-bottom:18px;}
.sgrouphead{font-size:11.5px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--text3); margin:0 0 4px; padding:0 8px;}
.slist{list-style:none; margin:0; padding:0;}
.sitem{display:flex; align-items:center; gap:9px; width:100%; padding:6px 8px; border-radius:var(--radius); color:var(--text2);}
.sitem:hover{background:var(--hover); color:var(--text);}
.sitem.is-on{background:var(--green-soft); color:var(--green-dk); font-weight:600;}
.sbadge{font-size:10.5px; font-weight:600; width:24px; height:24px; border-radius:50%; display:grid; place-items:center; flex:none; color:#fff;}
.sbadge--person{background:#8C93A0;} .sbadge--topic{background:#B0B6BF;}
.sitem.is-on .sbadge{background:var(--green);}
.sname{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.sopen{font-size:11.5px; font-weight:600; background:var(--white); color:var(--text2); border:1px solid var(--line); border-radius:9px; padding:0 6px;}
.sitem.is-on .sopen{background:var(--green); color:#fff; border-color:transparent;}
.sgrouphead{display:flex; align-items:center; justify-content:space-between;}
.sadd{width:20px; height:20px; border-radius:4px; display:grid; place-items:center; font-size:15px; line-height:1; color:var(--text3);}
.sadd:hover{background:var(--hover); color:var(--green);}
.saddrow{display:flex; gap:5px; padding:3px 8px 7px;}
.saddrow input{flex:1; min-width:0; padding:5px 8px; border:1px solid var(--line); border-radius:4px; background:var(--white);}
.saddgo{font-size:12.5px; font-weight:600; color:var(--green); flex:none;}
.srow{display:flex; align-items:center;}
.srow .sitem{flex:1; min-width:0;}
.skill{width:20px; flex:none; font-size:15px; line-height:1; color:transparent; text-align:center;}
.srow:hover .skill{color:var(--text3);}
.skill:hover{color:var(--red);}
.sconfirm{background:var(--white); border:1px solid var(--line); border-radius:var(--radius); padding:8px 10px; margin:2px 0; font-size:12.5px; color:var(--text2);}
.sconfirm div{display:flex; gap:10px; margin-top:6px;}
.sdel{font-size:12.5px; font-weight:600; color:var(--red);}
.scancel{font-size:12.5px; color:var(--text2);}

.railbtn{width:100%; text-align:left; font-size:13px; color:var(--text2); padding:6px 8px; border-radius:var(--radius); margin-bottom:8px;}
.railbtn:hover{background:var(--hover); color:var(--text);}
.railfoot{margin-top:22px; padding:12px 0 0; border-top:1px solid var(--line);}
.railfoot p{padding:0 8px;}
.railfoot p{margin:0; font-size:12px; color:var(--text3); line-height:1.5;}

/* Stream-Kopf */
.streamhead{margin-bottom:16px;}
.crumb{display:flex; align-items:center; gap:8px; font-size:22px; font-weight:600; letter-spacing:-0.015em; margin-bottom:10px;}
.dot{width:8px; height:8px; border-radius:50%;}
.dot--person{background:var(--green);} .dot--topic{background:var(--blue);}
.tabs{display:flex; gap:4px; flex-wrap:wrap; border-bottom:1px solid var(--line);}
.tab{font-size:13.5px; padding:6px 10px 8px; color:var(--text2); border-bottom:2px solid transparent; margin-bottom:-1px; border-radius:4px 4px 0 0;}
.tab:hover{color:var(--text); background:var(--hover);}
.tab.is-on{color:var(--green-dk); font-weight:600; border-bottom-color:var(--green); background:none;}
.tab--add{color:var(--text3);}
.cnt{display:inline-block; background:var(--green); color:#fff; font-size:11px; font-weight:600; border-radius:9px; padding:0 6px; margin-left:5px;}

/* Neuer Block */
.newbar{position:relative; margin-bottom:16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;}
.newbtn{font-size:13.5px; font-weight:600; padding:7px 15px; border-radius:4px; background:var(--green); color:#fff; box-shadow:0 1px 2px rgba(0,0,0,.08);}
.newbtn:hover{background:var(--green-dk);}
.tmenu{position:absolute; z-index:20; top:calc(100% + 6px); left:0; background:var(--white); border:1px solid var(--line); border-radius:8px; box-shadow:0 6px 20px rgba(29,33,37,.13); min-width:250px; padding:5px; overflow:hidden;}
.titem{display:flex; align-items:center; gap:10px; width:100%; padding:8px 10px; border-radius:5px;}
.titem:hover{background:var(--hover);}
.titem::before{content:''; width:9px; height:9px; border-radius:50%; background:currentColor; flex:none;}
.tlabel{font-size:14px; color:var(--text); font-weight:500;}
.tseed{font-size:12px; color:var(--text3); margin-left:auto;}
.newhint{margin:0; font-size:12.5px; color:var(--text3);}

.hue-plum{color:var(--purple);} .hue-steel{color:var(--blue);} .hue-moss{color:var(--green);} .hue-amber{color:var(--orange);} .hue-ink{color:var(--grey);}

/* Blockkarte */
.blocks{display:flex; flex-direction:column; gap:14px;}
.blk{background:var(--white); border:1px solid var(--line); border-radius:8px; padding:14px 18px 12px; box-shadow:0 1px 2px rgba(29,33,37,.04);}
.blk--pulse{animation:pulse 1.4s ease-out;}
@keyframes pulse{0%{box-shadow:0 0 0 3px var(--green-soft);} 100%{box-shadow:0 1px 2px rgba(29,33,37,.04);}}
.blkhead{margin-bottom:8px;}
.blktop{display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:4px;}
.pill{font-size:11.5px; font-weight:600; padding:2px 9px; border-radius:11px; color:currentColor; background:var(--side); border:1px solid var(--line2);}
.datefield input{font-size:12.5px; color:var(--text2); background:none; border:none; padding:0;}
.meta{font-size:12.5px; color:var(--text3);}
.mkill{margin-left:auto; font-size:12.5px; color:var(--text3);}
.mkill:hover{color:var(--red);}
.blktitle{width:100%; font-size:17px; font-weight:600; letter-spacing:-0.01em; background:none; border:none; padding:0 0 2px; color:var(--text);}
.blktitle::placeholder{color:var(--text3); font-weight:400;}

/* Gruppen im Block */
.sections{display:flex; flex-direction:column;}
.grp{margin-top:8px; padding-top:7px; border-top:1px solid var(--line2);}
.grphead{display:flex; align-items:center; gap:7px; font-size:11.5px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--text3); margin:0 0 2px;}
.grphead span{font-weight:600; letter-spacing:0; text-transform:none; background:var(--side); border-radius:9px; padding:0 6px;}
.grpempty{list-style:none; font-size:13px; color:var(--text3); padding:2px 0;}

/* Ausgewählte Zeile (Pfeiltasten-Modus) */
.it:focus{outline:none; background:var(--green-soft); box-shadow:inset 2px 0 0 var(--green);}
.it:focus .itkill,.it:focus .hadd{color:var(--text3);}
.it:focus .check{border-color:var(--green);}

/* Überschriften in Notizen */
.it--head{margin-top:7px; align-items:baseline;}
.it--head:first-child{margin-top:0;}
.hmark{font-size:12px; font-weight:700; color:var(--text3); width:22px; flex:none; text-align:right; letter-spacing:-.06em;}
.hmark:hover{color:var(--green);}
.hadd{font-size:15px; line-height:1; color:transparent; padding:0 4px; flex:none;}
.it--head:hover .hadd,.it--head:focus-within .hadd{color:var(--text3);}
.hadd:hover{color:var(--green);}
.headtext{font-weight:600; color:var(--text);}
.it--h1 .headtext{font-size:15.5px;}
.it--h2 .headtext{font-size:14px; color:var(--text2);}
.it.is-in{margin-left:22px; padding-left:11px; border-left:2px solid var(--line2);}
.it.is-in:hover{border-left-color:#D9DDE2;}

/* Zeilen */
.items{list-style:none; margin:0; padding:0;}
.it{display:flex; align-items:center; gap:10px; padding:4px 0; border-radius:4px;}
.it:hover{background:#FCFCFD;}
.ittext{flex:1; min-width:0; background:none; border:none; padding:2px 0; color:var(--text);}
.itmeta{display:flex; align-items:center; gap:8px; flex:none;}
.itkill{font-size:17px; line-height:1; color:transparent; padding:0 4px;}
.it:hover .itkill{color:var(--text3);}
.itkill:hover{color:var(--red);}
.check{width:18px; height:18px; border:1.5px solid #B6BCC3; border-radius:3px; flex:none; display:grid; place-items:center; background:var(--white); transition:border-color .12s, background .12s;}
.check:hover{border-color:var(--green); background:var(--green-soft);}
.check span{width:5px; height:9px; border:2px solid transparent; border-top:0; border-left:0; transform:rotate(42deg) translateY(-1px);}
.it--task:not(.is-done) .check:hover span{border-color:var(--green);}
.it--task.is-done .check{background:var(--green); border-color:var(--green);}
.it--task.is-done .check span{border-color:#fff;}
.it--task.is-done .ittext,.it--task.is-done .ittext--ro{color:var(--text3); text-decoration:line-through;}
.who{font-size:11px; font-style:normal; font-weight:600; background:var(--side); color:var(--text2); border-radius:10px; padding:1px 7px;}
.due{font-size:12px; color:var(--text3); white-space:nowrap;}
.due.is-late{color:var(--red); font-weight:600;}
.it--event .evtime{font-size:12px; font-weight:600; color:var(--blue); background:var(--blue-soft); border-radius:4px; padding:1px 7px; flex:none;}
.refmark{color:var(--text3);}
.reflink{flex:1; display:flex; gap:9px; align-items:baseline; color:var(--blue);}
.reflink:hover{text-decoration:underline;}
.refdate{font-size:12px; color:var(--text3);}

/* Composer */
.comp{position:relative; margin-top:6px; padding-top:6px; border-top:1px solid var(--line2);}
.comprow{display:flex; align-items:center; gap:8px;}
.modechip{font-size:11.5px; font-weight:600; padding:2px 8px; border-radius:11px; background:var(--green-soft); color:var(--green-dk); display:flex; gap:6px; flex:none;}
.compin{flex:1; min-width:0; padding:5px 0; background:none; border:none;}
.compin::placeholder{color:var(--text3);}
.refsel{flex:1; min-width:0; padding:5px 8px; background:var(--white); border:1px solid var(--line); border-radius:4px;}
.compgo{font-size:12.5px; color:var(--green); font-weight:600; flex:none; opacity:0;}
.comp:hover .compgo,.comp:focus-within .compgo{opacity:1;}
.slash{position:absolute; z-index:30; top:calc(100% + 4px); left:0; min-width:290px; list-style:none; margin:0; padding:5px; background:var(--white); border:1px solid var(--line); border-radius:8px; box-shadow:0 6px 20px rgba(29,33,37,.15);}
.slashit{display:flex; justify-content:space-between; align-items:baseline; gap:14px; width:100%; padding:7px 10px; border-radius:5px;}
.slashit.is-sel{background:var(--green-soft);}
.slabel{font-size:13.5px; font-weight:600; color:var(--text);}
.slashit.is-sel .slabel{color:var(--green-dk);}
.shint{font-size:12px; color:var(--text3);}

/* Spiegelseite */
.mirror{max-width:740px;}
.mirrorhead h3{font-size:17px; font-weight:600; margin:0 0 4px;}
.mirrorhead p{margin:0 0 18px; font-size:13px; color:var(--text3); max-width:56ch;}
.mgroup{margin-bottom:14px; background:var(--white); border:1px solid var(--line); border-radius:8px; padding:12px 16px 8px; box-shadow:0 1px 2px rgba(29,33,37,.04);}
.mgroup--done{opacity:.7;}
.msrc{display:flex; align-items:baseline; gap:9px; flex-wrap:wrap; margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid var(--line2); width:100%;}
.msrcpath{font-size:12px; color:var(--text3); order:1; width:100%;}
.msrctitle{font-size:14.5px; font-weight:600; color:var(--blue); order:2;}
.msrcdate{font-size:12px; color:var(--text3); order:3;}
.msrc:hover .msrctitle{text-decoration:underline;}
.donehead{font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--text3); margin:0 0 4px;}

/* Datumsspalte */
.monthbar{display:flex; align-items:center; gap:6px; padding:0 16px;}
.mnav{width:30px; height:30px; border-radius:50%; display:grid; place-items:center; font-size:19px; color:var(--text2); line-height:1;}
.mnav:hover{background:var(--hover);}
.monthbar .colhead--flush{flex:1; font-size:16px;}
.yr{color:var(--text3); font-weight:400;}
.monthmeta{font-size:12.5px; color:var(--text3); padding:3px 16px 14px; margin:0;}
.ledger{padding:0 14px 8px;}

/* Ein Tag mit Einträgen */
.dayblock{padding:14px 0 4px; border-top:1px solid var(--line2);}
.dayblock:first-child{border-top:none; padding-top:2px;}
.dayhead{display:flex; align-items:baseline; gap:7px; margin-bottom:8px; padding-left:2px;}
.dwd{font-size:12.5px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:.05em;}
.dnum{font-size:14.5px; font-weight:600; color:var(--text);}
.todaytag{font-size:11.5px; font-weight:600; color:#fff; background:var(--green); border-radius:10px; padding:1px 8px; margin-left:auto;}
.dayblock.is-today .dnum,.dayblock.is-today .dwd{color:var(--green-dk);}

/* Zusammengefasste leere Tage */
.gap{display:flex; align-items:center; gap:10px; padding:9px 2px; border-top:1px solid var(--line2);}
.gap::after{content:''; flex:1; height:1px; background:var(--line2);}
.gap span{font-size:12px; color:var(--text3); flex:none;}

/* Eintragskarte */
.card{display:block; width:100%; background:var(--white); border:1px solid var(--line); border-left:3px solid currentColor;
      border-radius:6px; padding:8px 11px; margin-bottom:6px; text-align:left;}
.card:hover{background:#FBFCFB; border-color:#CFD4D9;}
.cardtitle{display:block; font-size:13.5px; line-height:1.4; color:var(--text); margin-bottom:2px;
           overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.cardmeta{display:flex; align-items:baseline; gap:9px;}
.cardkind{font-size:12px; font-weight:600; color:currentColor;}
.cardtime{font-size:12px; color:var(--text2); font-variant-numeric:tabular-nums;}
.cardwho{font-size:12px; color:var(--text2);}

.card--event{color:var(--blue);}
.card--task{color:var(--green-dk);}
.card--task.is-late{color:var(--red);}
.card--task.is-done{color:var(--text3);}
.card--task.is-done .cardtitle{color:var(--text3); text-decoration:line-through;}
.card--block{color:var(--grey);}

/* Suche */
.results{max-width:740px;}
.rescount{font-size:13px; color:var(--text3); margin:0 0 12px;}
.res{display:block; width:100%; padding:10px 14px; background:var(--white); border:1px solid var(--line); border-radius:8px; margin-bottom:8px; box-shadow:0 1px 2px rgba(29,33,37,.04);}
.res:hover{border-color:var(--green); background:#FCFEFC;}
.restype{display:block; font-size:11.5px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--text3);}
.restitle{display:block; font-size:15px; font-weight:600;}
.respath{display:block; font-size:12.5px; color:var(--text3);}

.empty{font-size:13.5px; color:var(--text3); max-width:56ch; line-height:1.6;}

/* Template-Panel */
.overlay{position:fixed; inset:0; background:rgba(29,33,37,.4); display:flex; align-items:flex-start; justify-content:center; padding:5vh 16px; z-index:70; overflow-y:auto;}
.sheet{background:var(--white); border-radius:10px; box-shadow:0 16px 44px rgba(29,33,37,.25); width:100%; max-width:560px; padding:18px 20px 22px;}
.sheethead{display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;}
.sheethead h2{font-size:17px; font-weight:600; margin:0;}
.sheetclose{font-size:22px; line-height:1; color:var(--text3); padding:0 4px;}
.sheetclose:hover{color:var(--text);}
.sheetnote{font-size:12.5px; color:var(--text3); margin:0 0 14px;}
.tpllist{display:flex; flex-direction:column; gap:10px; margin-bottom:14px;}
.tplcard{border:1px solid var(--line); border-left:3px solid currentColor; border-radius:8px; padding:10px 12px;}
.tplrow{display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:7px;}
.tplname{flex:1; min-width:120px; font-size:14.5px; font-weight:600; color:var(--text); background:none; border:none; padding:2px 0;}
.tplhue{font-size:12.5px; color:var(--text2); background:var(--side); border:1px solid var(--line); border-radius:4px; padding:3px 6px;}
.tplkill{font-size:12.5px; color:var(--text3); flex:none;}
.tplkill:hover{color:var(--red);}
.tplconfirm{display:flex; gap:10px; flex:none;}
.tplseed{width:100%; font:inherit; font-size:13px; line-height:1.6; color:var(--text2); background:var(--bg); border:1px solid var(--line); border-radius:6px; padding:7px 9px; resize:vertical;}
.tplseed:focus{outline:none; border-color:var(--green); box-shadow:0 0 0 3px var(--green-soft);}
.titem--manage{border-top:1px solid var(--line2); margin-top:4px; padding-top:9px; color:var(--text2);}
.titem--manage::before{display:none;}
.titem--manage .tlabel{font-weight:400; color:var(--text2);}

/* Hinweis */
.flash{position:fixed; bottom:22px; left:50%; transform:translateX(-50%); background:var(--text); color:#fff; font-size:13px; padding:9px 16px; border-radius:6px; box-shadow:0 4px 14px rgba(29,33,37,.22); z-index:60;}
.flash--warn{background:var(--red); bottom:60px;}

/* ---------- Responsive: drei Stufen ---------- */
.panebar{display:none;}

/* Enger Desktop: Spalten schmaler, alles bleibt sichtbar */
@media (max-width:1220px){
  .app{grid-template-columns:198px minmax(0,1fr) 282px;}
  .stream{padding:18px 18px 60px;}
  .blk{padding:12px 14px 10px;}
}

/* Tablet: Datumsspalte wandert in den Umschalter */
@media (max-width:980px){
  .app{grid-template-columns:1fr;}
  .col{display:none; border:none;}
  .col.is-open{display:block;}
  .rail{padding:16px 10px 24px;}
  .dates{padding-bottom:24px;}
  .stream{padding:16px 16px 24px;}
  .panebar{display:grid; grid-template-columns:repeat(3,1fr); position:sticky; bottom:0; background:var(--white); border-top:1px solid var(--line); z-index:40;}
  .panebar button{font-size:12.5px; padding:11px 4px; text-align:center; color:var(--text3);}
  .panebar button.is-on{color:var(--green); font-weight:600; box-shadow:inset 0 2px 0 var(--green);}
  .compgo{opacity:1;}
  .itkill,.skill,.hadd{color:var(--text3);}
}

/* Telefon */
@media (max-width:640px){
  .bw{font-size:15px;}
  .top{gap:10px; padding:9px 13px;}
  .tagline{display:none;}
  .searchwrap{margin-left:0; flex-basis:100%; max-width:none;}
  .crumb{font-size:19px;}
  .tabs{flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none;}
  .tabs::-webkit-scrollbar{display:none;}
  .tab{white-space:nowrap;}
  .stream{padding:14px 12px 20px;}
  .blk{padding:11px 12px 9px; border-radius:7px;}
  .blktitle{font-size:16px;}
  .blktop{gap:7px;}
  .mkill{margin-left:0;}
  .it{flex-wrap:wrap;}
  .it--task .ittext,.it--event .ittext{flex-basis:calc(100% - 90px);}
  .itmeta{margin-left:auto;}
  .it.is-in{margin-left:12px; padding-left:9px;}
  .newbar{gap:8px;}
  .newhint{flex-basis:100%;}
  .tmenu{left:0; right:0; min-width:0;}
  .slash{left:0; right:0; min-width:0;}
  .ledger{padding:0 12px 8px;}
  .sheet{padding:15px 14px 18px; border-radius:8px;}
  .overlay{padding:3vh 10px;}
  .flash{left:12px; right:12px; transform:none; text-align:center;}
}

/* Zeigegeräte ohne Hover: Aktionen dauerhaft sichtbar */
@media (hover:none){
  .itkill,.skill,.hadd,.compgo{color:var(--text3); opacity:1;}
}

@media (prefers-reduced-motion:reduce){
  .bw *{animation:none !important; transition:none !important;}
}
`;
