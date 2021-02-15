// @flow

import { type Disklet } from 'disklet'
import { type EdgeFetchFunction, type EdgeLog } from 'edge-core-js'

type CommonOptions = {
  fetch?: EdgeFetchFunction,
  log?: EdgeLog
}

declare export function createRepo(
  repoId: string,
  opts?: CommonOptions
): Promise<void>

// Used by edge-core-js:
declare export function makeSyncClient(syncKey: string, opts: {}): RepoInstance

type RepoInstance = {
  sync(): Promise<void>,
  +disklet: Disklet
}
