import { ZodError } from "zod";
import type { ApiErrorBody, ApiFieldIssue } from "../shared/api.ts";

/**
 * Errors that become a specific HTTP response. Any other exception is a 500
 * whose details go to the log only (see handleError in api.ts).
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error.message ?? `HTTP ${status}`);
  }
}

export class ValidationError extends HttpError {
  constructor(issues: ApiFieldIssue[], message = "Invalid input") {
    super(400, { error: { code: "validation", message, issues } });
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, { error: { code: "bad_request", message } });
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, { error: { code: "not_found", message } });
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(readonly allow: string) {
    super(405, { error: { code: "method_not_allowed", message: "Method not allowed" } });
  }
}

export class InternalError extends HttpError {
  constructor() {
    super(500, { error: { code: "internal" } });
  }
}

/**
 * Turns a ZodError into the machine-readable per-field shape of the API
 * contract (docs/adr/0005): `{ path, code }`, never a raw validation dump.
 * Unknown keys are reported at the offending key, not at the parent object.
 */
export function zodToFieldIssues(error: ZodError): ApiFieldIssue[] {
  return error.issues.map((issue) => {
    if (issue.code === "unrecognized_keys" && issue.keys.length > 0) {
      return { path: [...issue.path, issue.keys[0]!].join(".") || "$", code: issue.code };
    }
    return { path: issue.path.join(".") || "$", code: issue.code };
  });
}
