import { EdgeFetchFunction, EdgeLog } from 'edge-core-js'
import nodeFetch from 'node-fetch'

import { anyPromise } from './anyPromise'

const syncServers = [
  'https://git-uk.edge.app/api/v2/store/{syncKey}',
  'https://git-eusa.edge.app/api/v2/store/{syncKey}'
]

export interface CreateRepoOptions {
  fetch?: EdgeFetchFunction
  log?: EdgeLog
}

/**
 * A minimal EdgeLog implementation.
 */
const defaultLog: EdgeLog = Object.assign(
  function log(...args: any[]) {
    console.log(...args)
  },
  {
    error(...args: any[]) {
      console.error(...args)
    },
    warn(...args: any[]) {
      console.warn(...args)
    }
  }
)

export async function createRepo(
  syncKey: string,
  opts: CreateRepoOptions = {}
): Promise<void> {
  const { fetch = nodeFetch, log = defaultLog } = opts

  await anyPromise(
    syncServers.map(async server => {
      const start = Date.now()
      const uri = server.replace('{syncKey}', syncKey)
      const response = await fetch(uri, { method: 'PUT' })
      const time = Date.now() - start
      log(`POST ${uri} returned ${response.status} in ${time}ms`)
      if (!response.ok) throw new Error(`Could not create repo ${syncKey}`)
    })
  )
}
