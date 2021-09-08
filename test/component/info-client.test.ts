import { expect } from 'chai'

import { asEdgeServers, makeInfoClient } from '../../src/client/info-client'

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
})
