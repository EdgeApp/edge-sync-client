// @flow

import { type EdgeFetchFunction } from 'edge-core-js'

type CommonOptions = {
  fetch?: EdgeFetchFunction,
  log?: (...args: any[]) => void
}

declare export function createRepo(
  syncKey: string,
  opts?: CommonOptions
): Promise<void>
