// @flow

import { type EdgeFetchFunction, type EdgeLog } from 'edge-core-js'

type CommonOptions = {
  fetch?: EdgeFetchFunction,
  log?: EdgeLog
}

declare export function createRepo(
  repoId: string,
  opts?: CommonOptions
): Promise<void>
