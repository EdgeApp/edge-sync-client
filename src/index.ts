import fetch from 'node-fetch'

import { anyPromise } from './anyPromise'

const syncServers = [
  'https://git-uk.edge.app/api/v2/store/{syncKey}',
  'https://git-eusa.edge.app/api/v2/store/{syncKey}'
]

export async function createRepo(syncKey: string): Promise<void> {
  await anyPromise(
    syncServers.map(async server => {
      const start = Date.now()
      const uri = server.replace('{syncKey}', syncKey)
      const response = await fetch(uri, { method: 'PUT' })
      const time = Date.now() - start
      console.log(`POST ${uri} returned ${response.status} in ${time}ms`)
      if (!response.ok) throw new Error(`Could not create repo ${syncKey}`)
    })
  )
}
