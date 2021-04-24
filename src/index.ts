import { Cleaner } from 'cleaners'
import { EdgeFetchFunction, EdgeLog } from 'edge-core-js'
import nodeFetch from 'node-fetch'

import {
  ApiRequest,
  ApiResponse,
  asApiResponse,
  asPutRepoResponse,
  PutRepoResponse
} from './types'

const syncServerHostnames = [
  'sync-us1.edge.app',
  'sync-us2.edge.app',
  'sync-us3.edge.app',
  'sync-us4.edge.app',
  'sync-eu1.edge.app',
  'sync-eu2.edge.app',
  'sync-eu3.edge.app',
  'sync-eu4.edge.app'
]

export interface CommonOptions {
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

async function apiRequest<T>(
  request: ApiRequest,
  asT: Cleaner<T>,
  opts: CommonOptions = {}
): Promise<ApiResponse<T>> {
  const { fetch = nodeFetch, log = defaultLog } = opts
  const { method, url, body } = request

  const start = Date.now()
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  const timeElapsed = Date.now() - start

  log(`${method} ${url} returned ${response.status} in ${timeElapsed}ms`)

  if (!response.ok)
    throw new Error(`Request ${method} ${url} failed ${response.status}`)

  const responseData = asApiResponse(asT)(await response.json())

  return responseData
}

export async function createRepo(
  syncKey: string,
  opts: CommonOptions = {}
): Promise<PutRepoResponse> {
  let error: Error = new Error(
    `Failed to create repo ${syncKey}: no successful server response`
  )

  for (let i = 0; i < syncServerHostnames.length; ++i) {
    const hostname = syncServerHostnames[i]
    const url = `https://${hostname}/api/v3/repo`

    try {
      const response = await apiRequest(
        { method: 'PUT', url, body: { syncKey } },
        asPutRepoResponse,
        opts
      )

      if (!response.success)
        throw new Error(`Failed to create repo ${syncKey}: ${response.message}`)

      return response.data
    } catch (err) {
      error = err
    }
  }

  throw error
}
