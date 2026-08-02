import type { ApiErrorBody, CalendarResponse, ItemWriteResponse, MirrorTask, PageResponse, SearchResponse, SpacesResponse } from "../../shared/api.ts";
import type { ClientError, EntityName, EntityRow } from "./state.ts";

/** The typed surface of the phase-2b API. The only part of the frontend that
 * speaks HTTP. */
export interface ApiClient {
  getSpaces(): Promise<SpacesResponse>;
  getPage(id: string): Promise<PageResponse>;
  getMirror(spaceId: string): Promise<MirrorTask[]>;
  getCalendar(from: string, to: string): Promise<CalendarResponse>;
  search(query: string): Promise<SearchResponse>;
  put(entity: EntityName, id: string, body: unknown): Promise<EntityRow>;
  patch(entity: EntityName, id: string, body: unknown): Promise<EntityRow>;
  /** Item writes return the stored row plus a block re-space map, if any. */
  putItem(id: string, body: unknown): Promise<ItemWriteResponse>;
  patchItem(id: string, body: unknown): Promise<ItemWriteResponse>;
  delete(entity: EntityName, id: string): Promise<void>;
}

const URL_ENTITY: Record<EntityName, string> = {
  space: "spaces",
  page: "pages",
  block: "blocks",
  item: "items",
  template: "templates",
};

export interface FetchApiClientOptions {
  baseUrl?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Total attempts for retryable (idempotent) writes; default 2. */
  maxAttempts?: number;
  /** Delay between retries, in milliseconds; default 300. */
  retryDelayMs?: number;
}

/**
 * fetch-backed client. Writes (PUT/PATCH/DELETE) are idempotent, so a network
 * failure is retried a small, fixed number of times; a 4xx/5xx response is
 * never retried and surfaces as a classified `http` error.
 */
export class FetchApiClient implements ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;

  constructor(options: FetchApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxAttempts = options.maxAttempts ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 300;
  }

  getSpaces(): Promise<SpacesResponse> {
    return this.read("/api/spaces");
  }

  getPage(id: string): Promise<PageResponse> {
    return this.read(`/api/pages/${encodeURIComponent(id)}`);
  }

  getMirror(spaceId: string): Promise<MirrorTask[]> {
    return this.read(`/api/spaces/${encodeURIComponent(spaceId)}/mirror`);
  }

  getCalendar(from: string, to: string): Promise<CalendarResponse> {
    return this.read(`/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }

  search(query: string): Promise<SearchResponse> {
    return this.read(`/api/search?q=${encodeURIComponent(query)}`);
  }

  put(entity: EntityName, id: string, body: unknown): Promise<EntityRow> {
    return this.write("PUT", entity, id, body);
  }

  patch(entity: EntityName, id: string, body: unknown): Promise<EntityRow> {
    return this.write("PATCH", entity, id, body);
  }

  putItem(id: string, body: unknown): Promise<ItemWriteResponse> {
    return this.perform("PUT", this.path("item", id), body, true).then((response) => this.parse(response));
  }

  patchItem(id: string, body: unknown): Promise<ItemWriteResponse> {
    return this.perform("PATCH", this.path("item", id), body, true).then((response) => this.parse(response));
  }

  async delete(entity: EntityName, id: string): Promise<void> {
    const response = await this.perform("DELETE", this.path(entity, id), undefined, true);
    if (!response.ok) throw await this.httpError(response);
  }

  private read<T>(path: string): Promise<T> {
    return this.perform("GET", path, undefined, false).then((response) => this.parse(response));
  }

  private write(method: "PUT" | "PATCH", entity: EntityName, id: string, body: unknown): Promise<EntityRow> {
    return this.perform(method, this.path(entity, id), body, true).then((response) => this.parse(response));
  }

  private path(entity: EntityName, id: string): string {
    return `/api/${URL_ENTITY[entity]}/${encodeURIComponent(id)}`;
  }

  private async perform(method: string, path: string, body: unknown, retryable: boolean): Promise<Response> {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const url = `${this.baseUrl}${path}`;

    let attempt = 0;
    for (;;) {
      try {
        // Call the impl as a free function: native `fetch` rejects being
        // invoked with a foreign receiver ("Illegal invocation").
        const doFetch = this.fetchImpl;
        return await doFetch(url, init);
      } catch (err) {
        if (!retryable || attempt >= this.maxAttempts - 1) throw networkError(err);
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      }
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    if (!response.ok) throw await this.httpError(response);
    return (await response.json()) as T;
  }

  private async httpError(response: Response): Promise<ClientError> {
    let body: ApiErrorBody | null = null;
    try {
      const parsed = (await response.json()) as { error?: unknown };
      if (parsed && typeof parsed === "object" && parsed.error) body = parsed as ApiErrorBody;
    } catch {
      // Non-JSON error body — stay with null.
    }
    return { kind: "http", status: response.status, body };
  }
}

/** Coerces anything thrown by the client layer into a classified ClientError. */
export function asClientError(err: unknown): ClientError {
  if (isClientError(err)) return err;
  return { kind: "unexpected", message: err instanceof Error ? err.message : "Unexpected error" };
}

function networkError(cause: unknown): ClientError {
  return { kind: "network", message: cause instanceof Error ? cause.message : "Network request failed" };
}

function isClientError(err: unknown): err is ClientError {
  return (
    typeof err === "object" &&
    err !== null &&
    "kind" in err &&
    (err.kind === "network" || err.kind === "http" || err.kind === "unexpected")
  );
}
