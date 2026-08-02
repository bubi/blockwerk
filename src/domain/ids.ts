/** A fresh client-side id for a row created before the server confirms it. */
export function newItemId(): string {
  return crypto.randomUUID();
}
