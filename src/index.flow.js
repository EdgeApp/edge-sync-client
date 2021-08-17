// @flow

import { fetch } from './fetch.flow.js'

type CommonOptions = {
  fetch?: typeof fetch,
  log?: (...args: any[]) => void
}

declare export function createRepo(
  syncKey: string,
  opts?: CommonOptions
): Promise<void>
