/**
 * A fresh client-side id for a row created before the server confirms it.
 * One generator for every entity; PUT is idempotent (docs/adr/0005), so the
 * same id is safe to reuse on retry.
 */
function newId(): string {
  return crypto.randomUUID();
}

export const newSpaceId = newId;
export const newPageId = newId;
export const newBlockId = newId;
export const newTemplateId = newId;
export const newItemId = newId;
