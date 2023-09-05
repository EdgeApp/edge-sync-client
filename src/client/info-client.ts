import crossFetch from 'cross-fetch'

import { asEdgeServers, EdgeServers } from '../types/base-types'
import { NetworkError } from '../types/error'
import { CommonOptions, noOp } from '../util/common'
import { makeTtlCache } from '../util/ttl-cache'

const defaultEdgeServers: Required<EdgeServers> = {
  infoServers: ['https://info-eu1.edge.app', 'https://info-us1.edge.app'],
  syncServers: [
    'https://sync-us1.edge.app',
    'https://sync-us2.edge.app',
    'https://sync-us3.edge.app',
    'https://sync-us4.edge.app',
    'https://sync-us5.edge.app',
    'https://sync-us6.edge.app',
    'https://sync-eu.edge.app'
  ]
}

export interface InfoClient {
  getEdgeServers: () => Promise<Required<EdgeServers>>
}

interface InfoClientOptions extends CommonOptions {
  edgeServers?: EdgeServers
  edgeServersCacheTTL?: number
}

export function makeInfoClient(opts: InfoClientOptions = {}): InfoClient {
  const { log = () => {} } = opts
  const edgeServers: Required<EdgeServers> = {
    ...defaultEdgeServers,
    ...opts.edgeServers
  }

  // 10 min TTL by default
  const { edgeServersCacheTTL = 10 * 60 * 1000 } = opts
  // Initialize info servers list with seed info servers
  let infoServers = edgeServers.infoServers

  const edgeServerInfoCache = makeTtlCache(
    (cache: { current: Required<EdgeServers> } = { current: edgeServers }) => {
      // Only update edge servers if there exist infoServers to query
      if (infoServers.length > 0) {
        // Update cache value in the background
        fetchEdgeServers(infoServers, opts)
          .then(value => (cache.current = { ...cache.current, ...value }))
          .catch(async err => {
            // Log the fetch error
            log(String(err))
          })
      }
      return cache
    },
    edgeServersCacheTTL
  )

  return {
    /**
     * Returns the cached edgeServerInfo
     */
    async getEdgeServers() {
      const { current } = await edgeServerInfoCache.get()

      // Update infoServers list
      if (current.infoServers.length > 0) {
        infoServers = current.infoServers
      }

      return current
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
