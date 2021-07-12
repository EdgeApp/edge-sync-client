import { Cleaner } from 'cleaners'
import { EdgeFetchFunction } from 'edge-core-js'
import nodeFetch from 'node-fetch'

import { ApiRequest, ApiResponse, asApiResponse } from '../types'

export interface CommonOptions {
  fetch?: EdgeFetchFunction
  log?: (...args: any[]) => void
}

/**
 * Default log function for CommonOptions.
 */
const defaultLog = (...args: any[]): void => {
  console.log(...args)
}

export async function apiRequest<T>(
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
