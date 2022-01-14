import { expect } from 'chai'
import crossFetch from 'cross-fetch'

import { asEdgeServers, makeInfoClient } from '../../src/client/info-client'
import { delay } from '../../src/util/delay'

describe('Component: InfoClient.getEdgeServers', () => {
  const infoClient = makeInfoClient()

  it('Will fetch EdgeServerInfo', async () => {
    const edgeServers = await infoClient.getEdgeServers()

    expect(edgeServers).deep.equals(asEdgeServers(edgeServers))
  })
  it('Will cache returned EdgeServerInfo', async () => {
    const edgeServersA = await infoClient.getEdgeServers()
    const edgeServersB = await infoClient.getEdgeServers()

    expect(edgeServersA).equals(edgeServersB)
  })
  it('Will fail gracefully if info server is unreachable', async () => {
    const serverInfoCacheTTL = 10
    let networkConnected = true

    const infoClient = makeInfoClient({
      serverInfoCacheTTL,
      fetch: async (...args) => {
        if (networkConnected) return await crossFetch(...args)
        throw new Error('Network Error')
      }
    })
    const edgeServersFirst = await infoClient.getEdgeServers()

    networkConnected = false
    await delay(serverInfoCacheTTL)

    const edgeServersSecond = await infoClient.getEdgeServers()

    console.log(edgeServersFirst)
    console.log(edgeServersSecond)

    expect(edgeServersSecond).deep.equals(edgeServersFirst)
  })
})
