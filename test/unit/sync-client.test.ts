import { expect } from 'chai'
import { FetchHeaders, FetchResponse } from 'serverlet'

import { makeSyncClient } from '../../src/client/sync-client'
import { delay } from '../../src/util/delay'

const syncKey = '0000000000000000000000000000000000000000'

const fakeHeaders: FetchHeaders = {
  forEach: () => {},
  get: () => null,
  has: () => false
}

// A successful PUT /store response. `asPutStoreResponse` is `asUndefined`, so an
// empty body is a valid success.
const okResponse: FetchResponse = {
  headers: fakeHeaders,
  ok: true,
  status: 200,
  arrayBuffer: async () => new ArrayBuffer(0),
  json: async () => undefined,
  text: async () => ''
}

describe('Unit: SyncClient timeout + failover', () => {
  it('fails over to the next server when one hangs past the timeout', async () => {
    const requestTimeoutMs = 50
    let callCount = 0

    const client = makeSyncClient({
      // Empty infoServers keeps the server list deterministic (no network).
      edgeServers: {
        infoServers: [],
        syncServers: ['https://sync-a.example', 'https://sync-b.example']
      },
      requestTimeoutMs,
      fetch: async () => {
        callCount += 1
        // The first server accepts the connection but never responds within the
        // timeout; the second server responds immediately.
        if (callCount === 1) {
          await delay(requestTimeoutMs * 10)
          return okResponse
        }
        return okResponse
      }
    })

    const start = Date.now()
    await client.createRepo(syncKey)
    const elapsed = Date.now() - start

    // Both servers were tried: the first timed out, the second succeeded.
    expect(callCount).to.equal(2)
    // Failover happened after the timeout, not after the full hang.
    expect(elapsed).to.be.greaterThan(requestTimeoutMs - 1)
    expect(elapsed).to.be.lessThan(requestTimeoutMs * 10)
  })

  it('does not time out when the server responds promptly', async () => {
    let callCount = 0
    const client = makeSyncClient({
      edgeServers: {
        infoServers: [],
        syncServers: ['https://sync-a.example', 'https://sync-b.example']
      },
      requestTimeoutMs: 50,
      fetch: async () => {
        callCount += 1
        return okResponse
      }
    })

    await client.createRepo(syncKey)

    // The first server answered, so no failover was needed.
    expect(callCount).to.equal(1)
  })
})
