export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface RemoteFailure {
  code: string
  message: string
}

export type RemoteResult<T>
  = | { ok: true, value: T }
    | { ok: false, error: RemoteFailure }

export interface CredentialInfo {
  configured: boolean
  source?: string
  writable: boolean
}

export interface SettingsSecretView {
  path: string[]
  set: boolean
}

export interface SettingsNamespaceView {
  ns: string
  schema: JsonValue
  value: JsonValue
  base?: JsonValue
  user?: JsonValue
  applies: 'live' | 'restart'
  secrets: SettingsSecretView[]
  revision: number
}

export type SettingsPathOpView
  = | { op: 'set', path: string[], value: JsonValue }
    | { op: 'unset', path: string[] }

export interface LlmProviderInfo {
  id: string
  name: string
}

export interface LlmConfigurableProvider {
  provider: string
  displayName: string
  settingsNs: string
  settingsPath: readonly string[]
  declared?: boolean
  error?: string
}

export interface LlmModelDiscoveryRequest {
  provider?: string
  baseURL?: string
  api?: string
  apiKey?: string
}

export interface LlmDiscoveredModel {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
  inputModalities?: readonly string[]
}

export interface SettingsRemote {
  mutate: (ns: string, ops: SettingsPathOpView[], expectedRevision?: number) => Promise<RemoteResult<SettingsNamespaceView>>
}

export interface CredentialsRemote {
  describe: (refs: string[]) => Promise<RemoteResult<Record<string, CredentialInfo>>>
  set: (ref: string, value: string) => Promise<RemoteResult<unknown>>
  unset: (ref: string) => Promise<RemoteResult<unknown>>
}

export interface LlmRemote {
  listProviders: () => Promise<RemoteResult<LlmProviderInfo[]>>
  listConfigurableProviders: () => Promise<RemoteResult<LlmConfigurableProvider[]>>
  discoverModels: (settingsNs: string, request: LlmModelDiscoveryRequest) => Promise<RemoteResult<LlmDiscoveredModel[]>>
}

export type RemoteEventName = 'settings/document-updated' | 'credentials/reference-updated' | 'llm/adapters-updated'

export interface ClientRemote {
  settings: SettingsRemote
  credentials: CredentialsRemote
  llm: LlmRemote
  $on: (event: RemoteEventName, listener: () => void) => () => void
}
