import { asMaybe, Cleaner } from 'cleaners'
import crossFetch from 'cross-fetch'

import {
  asServerErrorResponse,
  GetStoreParams,
  PostStoreBody,
  PostStoreParams,
  PutStoreParams
} from '../types/rest-types'
import { CommonOptions, noOp } from './common'

export type ApiRequestBody = PostStoreBody
export type ApiRequestParams = GetStoreParams | PostStoreParams | PutStoreParams

export interface ApiRequest {
  method: string
  url: string
  numbUrl?: string // Clean URL for logging
  body?: ApiRequestBody
  params?: ApiRequestParams
  headers?: { [key: string]: string }
}

export async function apiRequest<ApiResponse>(
  request: ApiRequest,
  asApiResponse: Cleaner<ApiResponse>,
  opts: CommonOptions = {}
): Promise<ApiResponse> {
  const { log = noOp, fetch = crossFetch } = opts
  const { method, url, body, numbUrl = url, headers = {} } = request

  const start = Date.now()
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  })
  const timeElapsed = Date.now() - start

  log(`${method} ${numbUrl} returned ${response.status} in ${timeElapsed}ms`)

  const responseBody = await response.text()

  if (!response.ok)
    throw new Error(
      `Failed request ${method} ${numbUrl} failed ${response.status}: ${responseBody}`
    )

  const errorResponse = asMaybe(asServerErrorResponse)(responseBody)

  if (errorResponse != null) {
    throw new Error(
      `Failed request ${method} ${numbUrl} failed ${response.status}: ${errorResponse.message}`
    )
  }

  const responseData = asApiResponse(
    responseBody.trim() !== '' ? JSON.parse(responseBody) : undefined
  )

  return responseData
}
