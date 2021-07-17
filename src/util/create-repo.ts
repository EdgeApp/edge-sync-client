import { syncServerHostnames } from '../constants'
import { asPutStoreResponse, PutStoreResponse } from '../types/rest-types'
import { apiRequest, CommonOptions } from './api-request'

export async function createRepo(
  syncKey: string,
  opts: CommonOptions = {}
): Promise<PutStoreResponse> {
  let error: Error = new Error(
    `Failed to create repo ${syncKey}: empty sync server list`
  )

  for (let i = 0; i < syncServerHostnames.length; ++i) {
    const hostname = syncServerHostnames[i]
    const url = `https://${hostname}/api/v2/store/${syncKey}`

    try {
      return await apiRequest({ method: 'PUT', url }, asPutStoreResponse, opts)
    } catch (err) {
      error = err
    }
  }

  throw error
}
