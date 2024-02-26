// @flow

import { type FetchFunction } from 'serverlet'

type EdgeServers = {
  infoServers?: string[],
  syncServers?: string[]
}

type SyncClientOptions = {
  fetch?: FetchFunction,
  log?: (message: string) => void,
  edgeServers?: EdgeServers
}

type EdgeBox = {
  iv_hex: string,
  encryptionType: number,
  data_base64: string
}

type PutStoreResponse = void

type GetStoreResponse = {
  hash?: string | void,
  changes: {
    [keys: string]: EdgeBox | null
  }
}

type PostStoreBody = {
  changes: {
    [keys: string]: EdgeBox | null
  }
}

type PostStoreResponse = {
  hash: string,
  changes: {
    [keys: string]: EdgeBox | null
  }
}

export type SyncClient = {
  createRepo: (syncKey: string) => Promise<PutStoreResponse>,
  readRepo: (
    syncKey: string,
    lastHash: string | void
  ) => Promise<GetStoreResponse>,
  updateRepo: (
    syncKey: string,
    lastHash: string | void,
    body: PostStoreBody
  ) => Promise<PostStoreResponse>
}

declare export function makeSyncClient(opts: SyncClientOptions): SyncClient
