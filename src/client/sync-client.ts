import { asMaybe, Cleaner, uncleaner } from 'cleaners'
import crossFetch from 'cross-fetch'
import { FetchFunction, FetchResponse } from 'serverlet'

import { EdgeServers } from '../types/base-types'
import { ConflictError } from '../types/error'
import {
  asGetStoreResponse,
  asPostStoreBody,
  asPostStoreResponse,
  asPutStoreResponse,
  asServerErrorResponse,
  GetStoreResponse,
  PostStoreBody,
  PostStoreResponse,
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
  const { fetch = crossFetch, log = () => {} } = opts
  const infoClient = makeInfoClient(opts)

  // Returns the sync servers from the info client shuffled
  async function shuffledSyncServers(): Promise<string[]> {
    const { syncServers } = await infoClient.getEdgeServers()
    return shuffle(syncServers)
  }

  async function loggedRequest(opts: ApiRequest): Promise<FetchResponse> {
    const { method, url, body, numbUrl = url, headers = {} } = opts
    const start = Date.now()
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body
    })
    const timeElapsed = Date.now() - start
    log(`${method} ${numbUrl} returned ${response.status} in ${timeElapsed}ms`)
    return response
  }

  async function unpackResponse<T>(
    request: ApiRequest,
    response: FetchResponse,
    asApiResponse: Cleaner<T>
  ): Promise<T> {
    const { method, url, numbUrl = url } = request
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

  return {
    async createRepo(syncKey, apiKey) {
      const syncServers = await shuffledSyncServers()
      let error: unknown = new Error(
        `Failed to create repo ${syncKey}: empty sync server list`
      )

      for (const syncServer of syncServers) {
        const repoId = syncKeyToRepoId(syncKey)
        const url = `${syncServer}/api/v2/store/${syncKey}`
        const request: ApiRequest = {
          method: 'PUT',
          url,
          numbUrl: url.replace(syncKey, `<${repoId}>`),
          headers: apiKey != null ? { 'X-API-Key': apiKey } : {}
        }

        try {
          const response = await loggedRequest(request)
          if (response.status === 409) throw new ConflictError({ repoId })
          return await unpackResponse(request, response, asPutStoreResponse)
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
        const request: ApiRequest = {
          method: 'GET',
          url,
          numbUrl: url.replace(syncKey, `<${syncKeyToRepoId(syncKey)}>`)
        }

        try {
          const response = await loggedRequest(request)
          return await unpackResponse(request, response, asGetStoreResponse)
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
        const request: ApiRequest = {
          method: 'POST',
          url,
          body: JSON.stringify(wasPostStoreBody(body)),
          numbUrl: url.replace(syncKey, `<${syncKeyToRepoId(syncKey)}>`)
        }

        try {
          const response = await loggedRequest(request)
          return await unpackResponse(request, response, asPostStoreResponse)
        } catch (err) {
          error = err
        }
      }

      throw error
    }
  }
}

interface ApiRequest {
  method: string
  url: string
  numbUrl?: string // Clean URL for logging
  body?: string
  headers?: { [key: string]: string }
}

const wasPostStoreBody = uncleaner(asPostStoreBody)
