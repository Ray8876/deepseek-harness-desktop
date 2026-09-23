export interface IndexInjectEntry {
  kind: 'global'
  name: string
  value: unknown
}

export interface IndexInjectTable {
  push: (entry: IndexInjectEntry) => void
}

export type IndexInjectListener = (table: IndexInjectTable) => void

export interface HostContext {
  on: (event: 'webserver/index-inject', listener: IndexInjectListener) => () => void
  effect: (callback: () => (() => void) | void, name?: string) => void
}
