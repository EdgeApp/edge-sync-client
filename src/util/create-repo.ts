import { makeInfoClient } from '../client/info-client'
import { asPutStoreResponse, PutStoreResponse } from '../types/rest-types'
import { apiRequest } from './api-request'
import { CommonOptions } from './common'

export async function createRepo(
  syncKey: string,
  opts: CommonOptions = {}
): Promise<PutStoreResponse> {
  const infoClient = makeInfoClient(opts)
  const { syncServers } = await infoClient.getEdgeServers()
  let error: Error = new Error(
    `Failed to create repo ${syncKey}: empty sync server list`
  )

  for (const syncServer of syncServers) {
    const url = `${syncServer}/api/v2/store/${syncKey}`

    try {
      return await apiRequest({ method: 'PUT', url }, asPutStoreResponse, opts)
    } catch (err) {
      error = err
    }
  }

  throw error
}
