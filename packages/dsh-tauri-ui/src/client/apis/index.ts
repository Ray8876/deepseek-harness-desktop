/*
 * @title dsh-tauri-ui
 * @swagger 2.0
 * @version 0.0.0
 */

import type { FetchOptions } from "dsh-tauri/client";
import { ofetch } from "dsh-tauri/client";
import type * as Types from "./index.type";

export const baseURL = "/api/desktop/dsh-tauri-ui";

/** @method get */
export function getConfigEditor(options?: FetchOptions) {
  return ofetch<Types.EditorPreferenceResponse>("/config/editor", { baseURL, method: "get", ...options });
}

/** @method put */
export function putConfigEditor(body: Types.EditorPreferenceBody, options?: FetchOptions) {
  return ofetch<Types.EditorPreferenceResponse>("/config/editor", { baseURL, method: "put", body, ...options });
}

/** @method post */
export function postConfigOpen(options?: FetchOptions) {
  return ofetch<Types.OpenModelsConfigResponse>("/config/open", { baseURL, method: "post", ...options });
}

/** @method get */
export function getEndpointModels(params?: Types.GetEndpointModelsQuery, options?: FetchOptions) {
  return ofetch<Types.EndpointModelsResponse>("/endpoint/models", { baseURL, method: "get", params, ...options });
}

/** @method get */
export function getPresets(params?: Types.GetPresetsQuery, options?: FetchOptions) {
  return ofetch<Types.PresetsResponse>("/presets", { baseURL, method: "get", params, ...options });
}

/** @method post */
export function postSessionResume(body: Types.PostSessionResumeBody, options?: FetchOptions) {
  return ofetch<Types.SessionResumeResponse>("/session/resume", { baseURL, method: "post", body, ...options });
}

/** @method get */
export function getUngrouped(options?: FetchOptions) {
  return ofetch<Types.UngroupedResponse>("/ungrouped", { baseURL, method: "get", ...options });
}
