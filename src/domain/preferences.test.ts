import { describe, expect, it } from "vitest";
import { readScope, writeScope } from "./preferences.ts";

function stub(initial: Record<string, string> = {}): { storage: { getItem(key: string): string | null; setItem(key: string, value: string): void }; value: (key: string) => string | null } {
  const store = new Map(Object.entries(initial));
  return {
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
    },
    value: (key) => store.get(key) ?? null,
  };
}

describe("scope preference", () => {
  it("defaults to team without a stored value", () => {
    const { storage } = stub();
    expect(readScope(storage)).toBe("team");
  });

  it("round-trips the chosen scope", () => {
    const { storage, value } = stub();
    writeScope("mine", storage);
    expect(readScope(storage)).toBe("mine");
    expect(value("blockwerk.todayScope")).toBe("mine");
  });

  it("treats an unknown stored value as team", () => {
    const { storage } = stub({ "blockwerk.todayScope": "bogus" });
    expect(readScope(storage)).toBe("team");
  });

  it("survives without a storage at all", () => {
    expect(readScope(undefined)).toBe("team");
    expect(writeScope("mine", undefined)).toBeUndefined();
  });
});
