import { syncServerHostnames } from '../constants'
import { asPutRepoResponse, PutRepoResponse } from '../types'
import { apiRequest, CommonOptions } from './api-request'

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
