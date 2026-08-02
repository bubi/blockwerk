import { useMemo, useReducer } from "react";
import { FetchApiClient } from "./client.ts";
import { createOperations, type Operations } from "./operations.ts";
import { reduce } from "./reducer.ts";
import { initialState, type AppState } from "./state.ts";

export interface UseApp {
  state: AppState;
  ops: Operations;
}

/** Owns the app state and the typed client: the single wiring point for the UI. */
export function useApp(): UseApp {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const client = useMemo(() => new FetchApiClient(), []);
  const ops = useMemo(() => createOperations(client, dispatch), [client, dispatch]);
  return { state, ops };
}
