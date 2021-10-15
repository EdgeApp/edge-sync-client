import { asArray, asObject, asString } from 'cleaners'
import crossFetch from 'cross-fetch'

import { NetworkError } from '../types/error'
import { CommonOptions, noOp } from '../util/common'
import { makeTtlCache } from '../util/ttl-cache'

const seedInfoServers = ['https://info1.edge.app']

export type EdgeServers = ReturnType<typeof asEdgeServers>
export const asEdgeServers = asObject({
  infoServers: asArray(asString),
  syncServers: asArray(asString)
})

export interface InfoClient {
  getEdgeServers: () => Promise<EdgeServers>
}

export function makeInfoClient(opts: CommonOptions = {}): InfoClient {
  // Initialize info servers list with seed info servers
  let infoServers = seedInfoServers

  const edgeServerInfo = makeTtlCache(
    async () => await fetchEdgeServers(infoServers, opts),
    10 * 60 * 1000 // 10 min TTL
  )

  return {
    /**
     * Returns the cached edgeServerInfo
     */
    async getEdgeServers() {
      const out = await edgeServerInfo.get()

      // Update infoServers list
      if (out.infoServers.length > 0) {
        infoServers = out.infoServers
      }

      return out
    }
  }
}

/**
 * Fetches list of servers from the info server(s)
 */
async function fetchEdgeServers(
  infoServers: string[],
  opts: CommonOptions = {}
): Promise<EdgeServers> {
  const { log = noOp, fetch = crossFetch } = opts
  let error: unknown = new Error('No info servers')

  // Retrieve the server lists from one of the info servers
  for (const infoServer of infoServers) {
    const [method, endpoint] = ['GET', '/v1/edgeServers']
    const start = Date.now()
    const uri = `${infoServer}${endpoint}`

    try {
      const response = await fetch(uri, {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      }).catch(error => {
        const time = Date.now() - start
        const message = `${method} ${uri} failed in ${time}ms, ${String(error)}`
        log(message)
        throw new NetworkError(message)
      })
      const { ok, status } = response
      const timeElapsed = Date.now() - start
      const message = `${method} ${uri} returned ${status} in ${timeElapsed}ms`

      // HTTP Error Response
      if (!ok) {
        log(message)
        throw new NetworkError(message)
      }

      // Successful response
      log(message)
      const responseBody = await response.text()
      const out = JSON.parse(responseBody)
      return asEdgeServers(out)
    } catch (e) {
      error = e
      continue
    }
  }

  // If no successful response from the info servers, then throw the last error
  throw error
}
