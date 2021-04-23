// @flow

import { type EdgeFetchFunction, type EdgeLog } from 'edge-core-js'

type CreateRepoOptions = {
  fetch?: EdgeFetchFunction,
  log?: EdgeLog
}

declare export function createRepo(
  syncKey: string,
  opts?: CreateRepoOptions
): Promise<void>
