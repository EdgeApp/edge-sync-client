import { asMaybe, Cleaner } from 'cleaners'
import { EdgeFetchFunction } from 'edge-core-js'
import nodeFetch from 'node-fetch'

import {
  asServerErrorResponse,
  GetStoreParams,
  PostStoreBody,
  PostStoreParams,
  PutStoreParams
} from '../types/rest-types'

export type ApiRequestBody = PostStoreBody
export type ApiRequestParams = GetStoreParams | PostStoreParams | PutStoreParams

export interface ApiRequest {
  method: string
  url: string
  body?: ApiRequestBody
  params?: ApiRequestParams
}

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

export async function apiRequest<ApiResponse>(
  request: ApiRequest,
  asApiResponse: Cleaner<ApiResponse>,
  opts: CommonOptions = {}
): Promise<ApiResponse> {
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

  const responseBody = await response.text()

  if (!response.ok)
    throw new Error(
      `Failed request ${method} ${url} failed ${response.status}: ${responseBody}`
    )

  const errorResponse = asMaybe(asServerErrorResponse)(responseBody)

  if (errorResponse != null) {
    throw new Error(
      `Failed request ${method} ${url} failed ${response.status}: ${errorResponse.message}`
    )
  }

  const responseData = asApiResponse(
    responseBody.trim() !== '' ? JSON.parse(responseBody) : undefined
  )

  return responseData
}
