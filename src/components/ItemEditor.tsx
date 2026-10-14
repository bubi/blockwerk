import { useState } from "react";
import type { ItemRow, SpaceRow } from "../../shared/db.ts";
import type { ItemPatch } from "../../shared/schemas.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";

export function ItemEditor({ item, spaces, onSave, onConvert, onClose }: {
  item: ItemRow; spaces: readonly SpaceRow[];
  onSave: (id: string, patch: ItemPatch, converted: boolean) => Promise<boolean>;
  onConvert: (id: string, kind: "note" | "task" | "event") => Promise<boolean>;
  onClose: () => void;
}) {
  const [text, setText] = useState(item.text);
  const [kind, setKind] = useState(item.kind);
  const [assignee, setAssignee] = useState(item.assigneeSpaceId ?? "");
  const [due, setDue] = useState(item.dueDate ?? "");
  const [date, setDate] = useState(item.eventDate ?? "");
  const [time, setTime] = useState(item.eventTime ?? "");
  const [done, setDone] = useState(item.done);
  const [convertedInSession, setConvertedInSession] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return; setSaving(true);
    try {
      const converting = kind !== item.kind && kind !== "ref";
      if (converting) { if (!await onConvert(item.id, kind)) return; setConvertedInSession(true); }
      const patch: ItemPatch = { text };
      if (kind === "task") Object.assign(patch, { assigneeSpaceId: assignee || null, dueDate: due || null, done });
      if (kind === "event") Object.assign(patch, { eventDate: date || null, eventTime: time || null });
      if (await onSave(item.id, patch, converting || convertedInSession)) onClose();
    } finally { setSaving(false); }
  };
  return <ConfirmDialog ariaLabel="Eintrag bearbeiten" confirmLabel={saving ? "Wird gespeichert…" : "Speichern"} onConfirm={() => void save()} onCancel={onClose} message={<div className="editor-fields">
    <h2>Eintrag bearbeiten</h2>
    <label>Text<textarea value={text} maxLength={10_000} onChange={event => setText(event.target.value)} /></label>
    {item.kind !== "ref" && item.parentItemId === null && <label>Art<select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="note">Notiz</option><option value="task">Aufgabe</option><option value="event">Termin</option></select></label>}
    {kind === "task" && <><label>Zuständig<select value={assignee} onChange={event => setAssignee(event.target.value)}><option value="">Ohne Zuständigkeit</option>{spaces.filter(space => space.kind === "person").map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label><label>Fällig<input type="date" value={due} onChange={event => setDue(event.target.value)} /></label><label><input type="checkbox" checked={done} onChange={event => setDone(event.target.checked)} /> Erledigt</label></>}
    {kind === "event" && <><label>Termindatum<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><label>Uhrzeit<input type="time" value={time} onChange={event => setTime(event.target.value)} /></label></>}
    {kind !== item.kind && <p>Die Art ändert sich; Text, Identität und Ursprung bleiben erhalten. Unpassende Metadaten werden entfernt.</p>}
  </div>} />;
}
