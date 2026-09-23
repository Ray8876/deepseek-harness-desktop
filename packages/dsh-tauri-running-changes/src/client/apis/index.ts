/*
 * @title dsh-tauri-running-changes
 * @swagger 2.0
 * @version 0.0.0
 */

import type { FetchOptions } from "dsh-tauri/client";
import { ofetch } from "dsh-tauri/client";
import type * as Types from "./index.type";

export const baseURL = "/api/desktop/dsh-tauri-running-changes";

/** @method get */
export function getLive(params?: Types.GetLiveQuery, options?: FetchOptions) {
  return ofetch<Types.LiveSnapshot>("/live", { baseURL, method: "get", params, ...options });
}

/** @method get */
export function getSummary(params?: Types.GetSummaryQuery, options?: FetchOptions) {
  return ofetch<Types.SummaryPayload>("/summary", { baseURL, method: "get", params, ...options });
}
