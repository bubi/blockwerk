import { describe, expect, it, vi } from "vitest";
import type { SpacesResponse } from "../../shared/api.ts";
import { asClientError, FetchApiClient } from "./client.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeClient(fetchImpl: typeof fetch, options: { maxAttempts?: number; retryDelayMs?: number } = {}) {
  return new FetchApiClient({ fetchImpl, retryDelayMs: 0, ...options });
}

describe("FetchApiClient reads", () => {
  it("parses a successful response", async () => {
    const payload: SpacesResponse = {
      spaces: [{ id: "s1", name: "S", kind: "topic", short: "S", email: null, createdAt: 1, updatedAt: 1, pages: [] }],
      templates: [],
      meSpaceId: null,
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await expect(client.getSpaces()).resolves.toEqual(payload);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/api/spaces"), expect.objectContaining({ method: "GET" }));
  });

  it("calls the fetch implementation as a free function, not as a method", async () => {
    // Native `fetch` rejects a foreign receiver ("Illegal invocation"). The
    // client must not invoke the impl as a method of itself.
    const fetchImpl = function (this: unknown, url: string, init?: RequestInit) {
      if (this !== undefined) throw new TypeError("Illegal invocation");
      if (init?.method !== "GET") throw new Error(`unexpected method for ${url}`);
      return Promise.resolve(jsonResponse({ spaces: [], templates: [] }));
    };
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await expect(client.getSpaces()).resolves.toEqual({ spaces: [], templates: [] });
  });

  it("classifies an HTTP error with the API error body", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { code: "validation", issues: [{ path: "kind", code: "invalid_value" }] } }, 400));
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await expect(client.put("space", "s1", { name: "X", kind: "x", short: "X" })).rejects.toEqual({
      kind: "http",
      status: 400,
      body: { error: { code: "validation", issues: [{ path: "kind", code: "invalid_value" }] } },
    });
  });

  it("does not retry a read on a network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await expect(client.getSpaces()).rejects.toEqual({ kind: "network", message: "Failed to fetch" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("searches with the query encoded into the URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ query: "a & b", blocks: [], items: [] }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await expect(client.search("a & b")).resolves.toEqual({ query: "a & b", blocks: [], items: [] });
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/api/search?q=a%20%26%20b"), expect.objectContaining({ method: "GET" }));
  });
});

describe("FetchApiClient writes", () => {
  it("retries an idempotent write on a network error and succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(jsonResponse({ id: "s1", name: "S", kind: "topic", short: "S", createdAt: 1, updatedAt: 2 }));
    const client = makeClient(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 });

    await expect(client.put("space", "s1", { name: "S", kind: "topic", short: "S" })).resolves.toMatchObject({ id: "s1" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up and reports a network error when retries are exhausted", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("down"));
    const client = makeClient(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 });

    await expect(client.patch("item", "i1", { done: true })).rejects.toEqual({ kind: "network", message: "down" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("never retries a 4xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { code: "validation" } }, 400));
    const client = makeClient(fetchImpl as unknown as typeof fetch, { maxAttempts: 5 });

    await expect(client.put("space", "s1", { name: "X", kind: "x", short: "X" })).rejects.toMatchObject({ kind: "http", status: 400 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("resolves a delete on 204", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await expect(client.delete("space", "s1")).resolves.toBeUndefined();
  });

  it("parses an item write response with its re-spaced positions", async () => {
    const payload = {
      row: { id: "i1", blockId: "b1", kind: "note", position: 2000, text: "hi" },
      respaced: { i0: 1000, i1: 2000 },
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await expect(client.putItem("i1", { blockId: "b1", kind: "note", position: 1000 })).resolves.toEqual(payload);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/api/items/i1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("parses an item write response without a re-space as respaced null", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ row: { id: "i1", position: 1500 }, respaced: null }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await expect(client.patchItem("i1", { done: true })).resolves.toEqual({
      row: { id: "i1", position: 1500 },
      respaced: null,
    });
  });

  it("classifies a 404 delete as an http error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { code: "not_found" } }, 404));
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await expect(client.delete("space", "nope")).rejects.toMatchObject({ kind: "http", status: 404 });
  });
});

describe("asClientError", () => {
  it("passes through a classified client error", () => {
    expect(asClientError({ kind: "network", message: "x" })).toEqual({ kind: "network", message: "x" });
  });

  it("wraps anything else as unexpected", () => {
    expect(asClientError(new Error("boom"))).toEqual({ kind: "unexpected", message: "boom" });
    expect(asClientError("junk")).toEqual({ kind: "unexpected", message: "Unexpected error" });
  });
});
