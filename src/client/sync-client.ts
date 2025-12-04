import { asMaybe, Cleaner, uncleaner } from 'cleaners'
import crossFetch from 'cross-fetch'
import { Disklet, navigateDisklet } from 'disklet'
import { FetchFunction, FetchResponse } from 'serverlet'

import { asEdgeBox, EdgeServers, wasEdgeBox } from '../types/base-types'
import { ConflictError } from '../types/error'
import {
  asGetStoreResponse,
  asPostStoreBody,
  asPostStoreResponse,
  asPutStoreResponse,
  asServerErrorResponse,
  ChangeSet,
  GetStoreResponse,
  PostStoreBody,
  PostStoreResponse,
  PutStoreResponse
} from '../types/rest-types'
import { syncKeyToRepoId } from '../util/security'
import { shuffle } from '../util/shuffle'

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
  /**
   * Sync the repository using the provided Disklet.
   * Gathers changes from `changes/` and deletions from `deleted/` directories,
   * sends them to the server, applies server's response to `data/`, and clears staging directories.
   */
  syncRepo: (
    disklet: Disklet,
    syncKey: string,
    lastHash: string | undefined
  ) => Promise<SyncResult>
}

export interface SyncResult {
  /** The sync status after sync */
  status: SyncStatus
  /** The changes received from the server */
  changes: ChangeSet
}

export interface SyncStatus {
  /** The last known hash from the server */
  lastHash: string | undefined
  /** Unix timestamp of the last sync (seconds) */
  lastSync: number
}

export interface SyncClientOptions {
  fetch?: FetchFunction
  log?: (message: string) => void
  edgeServers?: EdgeServers
  /** Maximum number of changes to send per sync (default: 100) */
  maxChangesPerSync?: number
}

export function makeSyncClient(opts: SyncClientOptions = {}): SyncClient {
  const { fetch = crossFetch, log = () => {}, maxChangesPerSync = 100 } = opts
  const syncServers: Required<EdgeServers>['syncServers'] =
    opts.edgeServers?.syncServers ?? defaultEdgeServers.syncServers

  // Returns the sync servers from the info client shuffled
  async function shuffledSyncServers(): Promise<string[]> {
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
    },

    async syncRepo(disklet, syncKey, lastHash) {
      // Get subdisklets for changes, deletions, and data
      const changesDisklet = navigateDisklet(disklet, 'changes')
      const deletedDisklet = navigateDisklet(disklet, 'deleted')
      const dataDisklet = navigateDisklet(disklet, 'data')

      // List both directories (each with limit to avoid over-listing)
      const allChangePaths = await deepListWithLimit(
        changesDisklet,
        maxChangesPerSync
      )
      const allDeletePaths = await deepListWithLimit(
        deletedDisklet,
        maxChangesPerSync
      )

      // Interlace changes and deletions, respecting the limit
      const changePaths: string[] = []
      const deletePaths: string[] = []
      const outgoingChanges: ChangeSet = {}
      const maxChangesCount = Math.min(
        maxChangesPerSync,
        allChangePaths.length + allDeletePaths.length
      )
      for (let i = 0; i < maxChangesCount; i++) {
        const pickChange = async (): Promise<void> => {
          const path = allChangePaths[changePaths.length]
          const data = await changesDisklet.getText(path)
          outgoingChanges[path] = asEdgeBox(JSON.parse(data))
          changePaths.push(path)
        }
        const pickDeletion = (): void => {
          const path = allDeletePaths[deletePaths.length]
          outgoingChanges[path] = null
          deletePaths.push(path)
        }

        if (i % 2 === 0) {
          if (changePaths.length < allChangePaths.length) {
            await pickChange()
          } else {
            pickDeletion()
          }
        } else {
          if (deletePaths.length < allDeletePaths.length) {
            pickDeletion()
          } else {
            await pickChange()
          }
        }
      }

      // Use readRepo if no changes, updateRepo otherwise
      const hasChanges = Object.keys(outgoingChanges).length > 0
      const response = hasChanges
        ? await this.updateRepo(syncKey, lastHash, { changes: outgoingChanges })
        : await this.readRepo(syncKey, lastHash)

      // Apply server's changes to the data disklet
      for (const [path, change] of Object.entries(response.changes)) {
        if (change === null) {
          // Delete the file from data directory
          await dataDisklet.delete(path)
        } else {
          // Write the file to data directory
          await dataDisklet.setText(path, JSON.stringify(wasEdgeBox(change)))
        }
      }

      // Clear synced changes from changes/ directory
      for (const path of changePaths) {
        await changesDisklet.delete(path)
      }

      // Clear synced deletions from deleted/ directory
      for (const path of deletePaths) {
        await deletedDisklet.delete(path)
      }

      return {
        status: {
          lastHash: response.hash ?? lastHash,
          lastSync: Date.now() / 1000
        },
        changes: response.changes
      }
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

// Disklet helper functions

/**
 * Lists all files in a disklet recursively, up to a limit.
 * Returns a list of full paths.
 */

async function deepListWithLimit(
  disklet: Disklet,
  limit: number,
  path: string = ''
): Promise<string[]> {
  const list = await disklet.list(path)
  const paths = Object.keys(list).filter(path => list[path] === 'file')
  const folders = Object.keys(list).filter(path => list[path] === 'folder')

  // Loop over folders to get subpaths
  for (const folder of folders) {
    if (paths.length >= limit) break
    const remaining = limit - paths.length
    const subpaths = await deepListWithLimit(disklet, remaining, folder)
    paths.push(...subpaths.slice(0, remaining))
  }

  return paths
}
