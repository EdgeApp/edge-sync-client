import { asMaybe, Cleaner } from 'cleaners'
import crossFetch from 'cross-fetch'
import { FetchFunction } from 'serverlet'

import { EdgeServers } from '../types/base-types'
import {
  asGetStoreResponse,
  asPostStoreResponse,
  asPutStoreResponse,
  asServerErrorResponse,
  GetStoreParams,
  GetStoreResponse,
  PostStoreBody,
  PostStoreParams,
  PostStoreResponse,
  PutStoreParams,
  PutStoreResponse
} from '../types/rest-types'
import { syncKeyToRepoId } from '../util/security'
import { shuffle } from '../util/shuffle'
import { makeInfoClient } from './info-client'

export interface SyncClient {
  createRepo: (syncKey: string, apiKey?: string) => Promise<PutStoreResponse>
  readRepo: (
    syncKey: string,
    lastHash: string | undefined
  ) => Promise<GetStoreResponse>
  updateRepo: (
    syncKey: string,
    lastHash: string | undefined,
    body: PostStoreBody
  ) => Promise<PostStoreResponse>
}

export interface SyncClientOptions {
  fetch?: FetchFunction
  log?: (message: string) => void
  edgeServers?: EdgeServers
}

export function makeSyncClient(opts: SyncClientOptions = {}): SyncClient {
  const infoClient = makeInfoClient(opts)

  // Returns the sync servers from the info client shuffled
  async function shuffledSyncServers(): Promise<string[]> {
    const { syncServers } = await infoClient.getEdgeServers()
    return shuffle(syncServers)
  }

  return {
    async createRepo(syncKey, apiKey) {
      const syncServers = await shuffledSyncServers()
      let error: unknown = new Error(
        `Failed to create repo ${syncKey}: empty sync server list`
      )

      for (const syncServer of syncServers) {
        const url = `${syncServer}/api/v2/store/${syncKey}`
        const numbUrl = url.replace(syncKey, `<${syncKeyToRepoId(syncKey)}>`)

        try {
          return await apiRequest(
            {
              method: 'PUT',
              url,
              numbUrl,
              headers: apiKey != null ? { 'X-API-Key': apiKey } : {}
            },
            asPutStoreResponse,
            opts
          )
        } catch (err) {
          error = err
        }
      }

      throw error
    },

    async readRepo(syncKey, lastHash) {
      const syncServers = await shuffledSyncServers()
      let error: unknown = new Error(
        `Failed to read repo ${syncKey}: empty sync server list`
      )

      for (const syncServer of syncServers) {
        const url = `${syncServer}/api/v2/store/${syncKey}/${lastHash ?? ''}`
        const numbUrl = url.replace(syncKey, `<${syncKeyToRepoId(syncKey)}>`)

        try {
          return await apiRequest(
            { method: 'GET', url, numbUrl },
            asGetStoreResponse,
            opts
          )
        } catch (err) {
          error = err
        }
      }

      throw error
    },

    async updateRepo(syncKey, lastHash, body) {
      const syncServers = await shuffledSyncServers()
      let error: unknown = new Error(
        `Failed to update repo ${syncKey}: empty sync server list`
      )

      for (const syncServer of syncServers) {
        const url = `${syncServer}/api/v2/store/${syncKey}/${lastHash ?? ''}`
        const numbUrl = url.replace(syncKey, `<${syncKeyToRepoId(syncKey)}>`)

        try {
          return await apiRequest(
            { method: 'POST', url, numbUrl, body },
            asPostStoreResponse,
            opts
          )
        } catch (err) {
          error = err
        }
      }

      throw error
    }
  }
}

type ApiRequestBody = PostStoreBody
type ApiRequestParams = GetStoreParams | PostStoreParams | PutStoreParams

interface ApiRequest {
  method: string
  url: string
  numbUrl?: string // Clean URL for logging
  body?: ApiRequestBody
  params?: ApiRequestParams
  headers?: { [key: string]: string }
}

async function apiRequest<ApiResponse>(
  request: ApiRequest,
  asApiResponse: Cleaner<ApiResponse>,
  opts: SyncClientOptions = {}
): Promise<ApiResponse> {
  const { log = () => {}, fetch = crossFetch } = opts
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
