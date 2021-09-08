import {
  asGetStoreResponse,
  asPostStoreResponse,
  asPutStoreResponse,
  GetStoreResponse,
  PostStoreBody,
  PostStoreResponse,
  PutStoreResponse
} from '../types/rest-types'
import { apiRequest } from '../util/api-request'
import { CommonOptions } from '../util/common'
import { shuffle } from '../util/shuffle'
import { makeInfoClient } from './info-client'

export interface SyncClient {
  createRepo: (syncKey: string) => Promise<PutStoreResponse>
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

export function makeSyncClient(opts: CommonOptions = {}): SyncClient {
  const infoClient = makeInfoClient(opts)

  // Returns the sync servers from the info client shuffled
  async function shuffledSyncServers(): Promise<string[]> {
    const { syncServers } = await infoClient.getEdgeServers()
    return shuffle(syncServers)
  }

  return {
    async createRepo(syncKey) {
      const syncServers = await shuffledSyncServers()
      let error: Error = new Error(
        `Failed to create repo ${syncKey}: empty sync server list`
      )

      for (const syncServer of syncServers) {
        const url = `${syncServer}/api/v2/store/${syncKey}`

        try {
          return await apiRequest(
            { method: 'PUT', url },
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
      let error: Error = new Error(
        `Failed to read repo ${syncKey}: empty sync server list`
      )

      for (const syncServer of syncServers) {
        const url = `${syncServer}/api/v2/store/${syncKey}/${lastHash ?? ''}`

        try {
          return await apiRequest(
            { method: 'GET', url },
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
      let error: Error = new Error(
        `Failed to update repo ${syncKey}: empty sync server list`
      )

      for (const syncServer of syncServers) {
        const url = `${syncServer}/api/v2/store/${syncKey}/${lastHash ?? ''}`

        try {
          return await apiRequest(
            { method: 'POST', url, body },
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
