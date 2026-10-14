export function itemLink(blockId: string, itemId?: string) {
  const params = new URLSearchParams({ block: blockId });
  if (itemId) params.set("item", itemId);
  return `#${params}`;
}
export function readLink(
  hash: string,
): { blockId: string; itemId?: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const blockId = params.get("block");
  const itemId = params.get("item");
  if (!blockId || blockId.length > 128 || (itemId && itemId.length > 128))
    return null;
  return { blockId, itemId: itemId || undefined };
}
