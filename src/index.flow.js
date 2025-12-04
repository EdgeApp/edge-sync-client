// @flow

import { type Disklet } from 'disklet'
import { type FetchFunction } from 'serverlet'

type EdgeServers = {
  infoServers?: string[],
  syncServers?: string[]
}

type EdgeBox = {
  encryptionType: number,
  data_base64: string,
  iv_hex: string
}

type ChangeSet = {
  [path: string]: EdgeBox | null
}

type PutStoreResponse = void

type GetStoreResponse = {
  hash?: string | void,
  changes: ChangeSet
}

type PostStoreBody = {
  changes: ChangeSet
}

type PostStoreResponse = {
  hash: string,
  changes: ChangeSet
}

export type SyncStatus = {
  lastHash: string | void,
  lastSync: number
}

export type SyncResult = {
  status: SyncStatus,
  changes: ChangeSet
}

export type SyncClientOptions = {
  fetch?: FetchFunction,
  log?: (message: string) => void,
  edgeServers?: EdgeServers,
  maxChangesPerSync?: number
}

export type SyncClient = {
  createRepo: (syncKey: string, apiKey?: string) => Promise<PutStoreResponse>,
  readRepo: (
    syncKey: string,
    lastHash: string | void
  ) => Promise<GetStoreResponse>,
  updateRepo: (
    syncKey: string,
    lastHash: string | void,
    body: PostStoreBody
  ) => Promise<PostStoreResponse>,
  syncRepo: (
    disklet: Disklet,
    syncKey: string,
    lastHash: string | void
  ) => Promise<SyncResult>
}

declare export function makeSyncClient(opts?: SyncClientOptions): SyncClient
