import { expect } from 'chai'
import { Disklet, makeMemoryDisklet, navigateDisklet } from 'disklet'

import { makeSyncClient, SyncClient } from '../../src/client/sync-client'
import { wasEdgeBox } from '../../src/types/base-types'
import { createMockSyncServer, MockSyncServer } from '../utils/mock-sync-server'

// Test constants
const TEST_SYNC_KEY =
  '0000000000000000000000000000000000000000000000000000000000000000'
const TEST_SERVER = 'http://test-sync-server'

// Helper to create EdgeBox in wire format (for mock server responses and disk writes)
function makeWireEdgeBox(
  id: number
): {
  encryptionType: number
  iv_hex: string
  data_base64: string
} {
  return wasEdgeBox({
    encryptionType: 0,
    iv_hex: new Uint8Array([id, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    data_base64: new Uint8Array([id, 1, 2, 3])
  }) as {
    encryptionType: number
    iv_hex: string
    data_base64: string
  }
}

describe('Component: SyncClient.syncRepo', () => {
  // Shared test context
  let disklet: ReturnType<typeof makeMemoryDisklet>
  let changesDisklet: Disklet
  let deletedDisklet: Disklet
  let dataDisklet: Disklet
  let mockSyncServer: MockSyncServer
  let client: SyncClient

  // Helper to create client with custom options
  function createClient(opts: { maxChangesPerSync?: number } = {}): SyncClient {
    return makeSyncClient({
      fetch: mockSyncServer.fetch,
      edgeServers: { syncServers: [TEST_SERVER] },
      ...opts
    })
  }

  beforeEach(() => {
    disklet = makeMemoryDisklet()
    changesDisklet = navigateDisklet(disklet, 'changes')
    deletedDisklet = navigateDisklet(disklet, 'deleted')
    dataDisklet = navigateDisklet(disklet, 'data')
    mockSyncServer = createMockSyncServer()
    client = createClient()
  })

  // --- Setup & Configuration ---

  describe('setup', () => {
    it('uses maxChangesPerSync option to limit changes per sync (default 100)', async () => {
      // Create 150 files in changes/ and track expected values
      const expectedBoxes: Record<
        string,
        ReturnType<typeof makeWireEdgeBox>
      > = {}
      for (let i = 0; i < 150; i++) {
        const box = makeWireEdgeBox(i)
        expectedBoxes[`file${i}.json`] = box
        await changesDisklet.setText(`file${i}.json`, JSON.stringify(box))
      }

      mockSyncServer.setRepoState(TEST_SYNC_KEY, { hash: 'initial', files: {} })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify only 100 files in repo state with correct content
      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      const serverFiles = Object.keys(repoState?.files ?? {})
      expect(serverFiles).to.have.length(100)

      // Verify each synced file has correct content
      for (const fileName of serverFiles) {
        expect(repoState?.files[fileName]).to.deep.equal(
          expectedBoxes[fileName]
        )
      }

      // Verify 50 files remain in changes/ (the ones not synced)
      const remainingFiles = Object.keys(await changesDisklet.list())
      expect(remainingFiles).to.have.length(50)

      // Verify remaining files are distinct from synced files
      for (const fileName of remainingFiles) {
        expect(serverFiles).to.not.include(fileName)
      }
    })

    it('allows custom maxChangesPerSync option', async () => {
      client = createClient({ maxChangesPerSync: 5 })

      // Create 10 files in changes/ and track expected values
      const expectedBoxes: Record<
        string,
        ReturnType<typeof makeWireEdgeBox>
      > = {}
      for (let i = 0; i < 10; i++) {
        const box = makeWireEdgeBox(i)
        expectedBoxes[`file${i}.json`] = box
        await changesDisklet.setText(`file${i}.json`, JSON.stringify(box))
      }

      mockSyncServer.setRepoState(TEST_SYNC_KEY, { hash: 'initial', files: {} })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify only 5 files in repo state with correct content
      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      const serverFiles = Object.keys(repoState?.files ?? {})
      expect(serverFiles).to.have.length(5)

      // Verify each synced file has correct content
      for (const fileName of serverFiles) {
        expect(repoState?.files[fileName]).to.deep.equal(
          expectedBoxes[fileName]
        )
      }

      // Verify 5 files remain in changes/ (the ones not synced)
      const remainingFiles = Object.keys(await changesDisklet.list())
      expect(remainingFiles).to.have.length(5)

      // Verify remaining files are distinct from synced files
      for (const fileName of remainingFiles) {
        expect(serverFiles).to.not.include(fileName)
      }
    })
  })

  // --- Gathering Changes & Deletions ---

  describe('gathering outgoing changes', () => {
    it('gathers changes from changes/ directory and uploads to server', async () => {
      const expectedBox = makeWireEdgeBox(42)
      await changesDisklet.setText('myfile.json', JSON.stringify(expectedBox))

      mockSyncServer.setRepoState(TEST_SYNC_KEY, { hash: 'initial', files: {} })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify file is in repo state with correct content
      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      expect(repoState?.files['myfile.json']).to.deep.equal(expectedBox)
    })

    it('gathers deletions from deleted/ directory and removes from server', async () => {
      await deletedDisklet.setText('file-to-delete.json', '')

      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'initial',
        files: { 'file-to-delete.json': makeWireEdgeBox(1) }
      })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify file is removed from repo state
      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      expect(repoState?.files).to.not.have.property('file-to-delete.json')
    })

    it('handles nested directories in changes/', async () => {
      const expectedBox = makeWireEdgeBox(1)
      await changesDisklet.setText(
        'foo/bar/nested.json',
        JSON.stringify(expectedBox)
      )

      mockSyncServer.setRepoState(TEST_SYNC_KEY, { hash: 'initial', files: {} })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify nested path is in repo state with correct content
      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      expect(repoState?.files['foo/bar/nested.json']).to.deep.equal(expectedBox)
    })

    it('handles nested directories in deleted/', async () => {
      await deletedDisklet.setText('foo/bar/nested.json', '')

      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'initial',
        files: { 'foo/bar/nested.json': makeWireEdgeBox(1) }
      })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify nested path is removed from repo state
      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      expect(repoState?.files).to.not.have.property('foo/bar/nested.json')
    })
  })

  // --- Interlacing Logic ---

  describe('interlacing changes and deletions', () => {
    it('interlaces changes and deletions alternately', async () => {
      // Create 3 changes and 3 deletions
      const expectedBoxes = [
        makeWireEdgeBox(0),
        makeWireEdgeBox(1),
        makeWireEdgeBox(2)
      ]
      for (let i = 0; i < 3; i++) {
        await changesDisklet.setText(
          `change${i}.json`,
          JSON.stringify(expectedBoxes[i])
        )
        await deletedDisklet.setText(`delete${i}.json`, '')
      }

      // Pre-populate server with files to delete
      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'initial',
        files: {
          'delete0.json': makeWireEdgeBox(10),
          'delete1.json': makeWireEdgeBox(11),
          'delete2.json': makeWireEdgeBox(12)
        }
      })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify repo state has 3 new files with correct content and deleted files removed
      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      expect(repoState?.files['change0.json']).to.deep.equal(expectedBoxes[0])
      expect(repoState?.files['change1.json']).to.deep.equal(expectedBoxes[1])
      expect(repoState?.files['change2.json']).to.deep.equal(expectedBoxes[2])
      expect(repoState?.files).to.not.have.property('delete0.json')
      expect(repoState?.files).to.not.have.property('delete1.json')
      expect(repoState?.files).to.not.have.property('delete2.json')
    })

    it('falls back to changes when deletions exhausted', async () => {
      client = createClient({ maxChangesPerSync: 6 })

      // 5 changes and 1 deletion
      const expectedBoxes: Array<ReturnType<typeof makeWireEdgeBox>> = []
      for (let i = 0; i < 5; i++) {
        expectedBoxes[i] = makeWireEdgeBox(i)
        await changesDisklet.setText(
          `change${i}.json`,
          JSON.stringify(expectedBoxes[i])
        )
      }
      await deletedDisklet.setText('delete0.json', '')

      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'initial',
        files: { 'delete0.json': makeWireEdgeBox(10) }
      })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify all 5 changes uploaded with correct content and deletion processed
      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      expect(Object.keys(repoState?.files ?? {})).to.have.length(5)
      for (let i = 0; i < 5; i++) {
        expect(repoState?.files[`change${i}.json`]).to.deep.equal(
          expectedBoxes[i]
        )
      }
      expect(repoState?.files).to.not.have.property('delete0.json')
    })

    it('falls back to deletions when changes exhausted', async () => {
      client = createClient({ maxChangesPerSync: 6 })

      // 1 change and 5 deletions
      const expectedBox = makeWireEdgeBox(0)
      await changesDisklet.setText('change0.json', JSON.stringify(expectedBox))
      for (let i = 0; i < 5; i++) {
        await deletedDisklet.setText(`delete${i}.json`, '')
      }

      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'initial',
        files: {
          'delete0.json': makeWireEdgeBox(10),
          'delete1.json': makeWireEdgeBox(11),
          'delete2.json': makeWireEdgeBox(12),
          'delete3.json': makeWireEdgeBox(13),
          'delete4.json': makeWireEdgeBox(14)
        }
      })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify 1 change uploaded with correct content and 5 deletions processed
      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      expect(repoState?.files['change0.json']).to.deep.equal(expectedBox)
      expect(Object.keys(repoState?.files ?? {})).to.have.length(1)
    })

    it('respects maxChangesPerSync across both changes and deletions', async () => {
      client = createClient({ maxChangesPerSync: 5 })

      // 10 changes and 10 deletions
      for (let i = 0; i < 10; i++) {
        await changesDisklet.setText(
          `change${i}.json`,
          JSON.stringify(makeWireEdgeBox(i))
        )
        await deletedDisklet.setText(`delete${i}.json`, '')
      }

      // Pre-populate with files to delete
      const initialFiles: Record<
        string,
        ReturnType<typeof makeWireEdgeBox>
      > = {}
      for (let i = 0; i < 10; i++) {
        initialFiles[`delete${i}.json`] = makeWireEdgeBox(10 + i)
      }

      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'initial',
        files: initialFiles
      })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify only 5 items were synced by checking remaining staging files
      const remainingChanges = Object.keys(await changesDisklet.list()).length
      const remainingDeletes = Object.keys(await deletedDisklet.list()).length
      // Started with 20 total (10 changes + 10 deletes), synced 5, so 15 remain
      expect(remainingChanges + remainingDeletes).to.equal(15)

      // Verify server state reflects the 5 synced items
      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      const serverFiles = Object.keys(repoState?.files ?? {})
      // Started with 10 delete files, some were removed and some change files added
      // With interlacing: 3 changes added, 2 deletes removed = 10 - 2 + 3 = 11 files
      // Or: 2 changes added, 3 deletes removed = 10 - 3 + 2 = 9 files
      const changesSynced = 10 - remainingChanges
      const deletesSynced = 10 - remainingDeletes
      expect(changesSynced + deletesSynced).to.equal(5)
      expect(serverFiles.length).to.equal(10 - deletesSynced + changesSynced)
    })
  })

  // --- Applying Server Response ---

  describe('applying server response to data/', () => {
    it('writes server changes to data/ directory', async () => {
      const serverBox = makeWireEdgeBox(99)

      // Server has a file that client doesn't know about
      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'hash1',
        files: { 'server/file.json': serverBox }
      })

      // Client syncs with no lastHash, gets all server files
      await client.syncRepo(disklet, TEST_SYNC_KEY, undefined)

      // Verify file was written to data/ with correct content
      const content = await dataDisklet.getText('server/file.json')
      const parsed = JSON.parse(content)
      expect(parsed).to.deep.equal(serverBox)
    })

    it('deletes files from data/ when server returns null', async () => {
      // Pre-populate data/ with a file
      await dataDisklet.setText(
        'to-delete.json',
        JSON.stringify(makeWireEdgeBox(1))
      )

      // Server had the file but now it's deleted (empty state)
      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'hash-with-file',
        files: { 'to-delete.json': makeWireEdgeBox(1) }
      })

      // Stage a deletion locally
      await deletedDisklet.setText('to-delete.json', '')

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'hash-with-file')

      // Verify file was deleted from data/
      const listing = await dataDisklet.list()
      expect(listing).to.not.have.property('to-delete.json')
    })

    it('handles mix of server changes and deletions', async () => {
      const keepBox = makeWireEdgeBox(1)
      const newFileBox = makeWireEdgeBox(3)

      // Pre-populate data/ with files
      await dataDisklet.setText('keep.json', JSON.stringify(keepBox))
      await dataDisklet.setText(
        'delete-me.json',
        JSON.stringify(makeWireEdgeBox(2))
      )

      // Server state: has existing files
      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'old-hash',
        files: {
          'keep.json': keepBox,
          'delete-me.json': makeWireEdgeBox(2)
        }
      })

      // Stage deletion and new file
      await changesDisklet.setText('new-file.json', JSON.stringify(newFileBox))
      await deletedDisklet.setText('delete-me.json', '')

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'old-hash')

      // Verify correct files exist in data/ with correct content
      const keepContent = JSON.parse(await dataDisklet.getText('keep.json'))
      const newFileContent = JSON.parse(
        await dataDisklet.getText('new-file.json')
      )
      expect(keepContent).to.deep.equal(keepBox)
      expect(newFileContent).to.deep.equal(newFileBox)

      const listing = await dataDisklet.list()
      expect(listing).to.not.have.property('delete-me.json')
    })
  })

  // --- Clearing Staging Directories ---

  describe('clearing staging directories after sync', () => {
    it('removes synced files from changes/ directory', async () => {
      const box1 = makeWireEdgeBox(1)
      const box2 = makeWireEdgeBox(2)
      await changesDisklet.setText('file1.json', JSON.stringify(box1))
      await changesDisklet.setText('file2.json', JSON.stringify(box2))

      mockSyncServer.setRepoState(TEST_SYNC_KEY, { hash: 'initial', files: {} })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify changes/ is empty and server has correct content
      const listing = await changesDisklet.list()
      expect(Object.keys(listing)).to.have.length(0)

      const repoState = mockSyncServer.getRepoState(TEST_SYNC_KEY)
      expect(repoState?.files['file1.json']).to.deep.equal(box1)
      expect(repoState?.files['file2.json']).to.deep.equal(box2)
    })

    it('removes synced files from deleted/ directory', async () => {
      await deletedDisklet.setText('file1.json', '')
      await deletedDisklet.setText('file2.json', '')

      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'initial',
        files: {
          'file1.json': makeWireEdgeBox(1),
          'file2.json': makeWireEdgeBox(2)
        }
      })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify deleted/ is empty
      const listing = await deletedDisklet.list()
      expect(Object.keys(listing)).to.have.length(0)
    })

    it('only clears files that were actually synced (respects limit)', async () => {
      client = createClient({ maxChangesPerSync: 3 })

      // Create 10 files
      for (let i = 0; i < 10; i++) {
        await changesDisklet.setText(
          `file${i}.json`,
          JSON.stringify(makeWireEdgeBox(i))
        )
      }

      mockSyncServer.setRepoState(TEST_SYNC_KEY, { hash: 'initial', files: {} })

      await client.syncRepo(disklet, TEST_SYNC_KEY, 'initial')

      // Verify only 3 files removed, 7 remain
      const listing = await changesDisklet.list()
      expect(Object.keys(listing)).to.have.length(7)
    })

    it('does not clear staging directories if sync fails', async () => {
      await changesDisklet.setText(
        'file.json',
        JSON.stringify(makeWireEdgeBox(1))
      )
      await deletedDisklet.setText('delete.json', '')

      // Don't set repo state - will return 404

      try {
        await client.syncRepo(disklet, TEST_SYNC_KEY, undefined)
        expect.fail('Should have thrown')
      } catch (err) {
        // Expected - repo not found
      }

      // Verify staging directories still contain files
      const changesListing = await changesDisklet.list()
      const deletedListing = await deletedDisklet.list()
      expect(changesListing).to.have.property('file.json')
      expect(deletedListing).to.have.property('delete.json')
    })
  })

  // --- Return Value ---

  describe('SyncResult return value', () => {
    it('returns status.lastHash from server response', async () => {
      mockSyncServer.setRepoState(TEST_SYNC_KEY, { hash: 'abc123', files: {} })

      const result = await client.syncRepo(disklet, TEST_SYNC_KEY, undefined)

      expect(result.status.lastHash).to.equal('abc123')
    })

    it('preserves lastHash when no changes (already up to date)', async () => {
      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'existing-hash',
        files: {}
      })

      const result = await client.syncRepo(
        disklet,
        TEST_SYNC_KEY,
        'existing-hash'
      )

      expect(result.status.lastHash).to.equal('existing-hash')
    })

    it('returns status.lastSyncAt as current Date', async () => {
      mockSyncServer.setRepoState(TEST_SYNC_KEY, { hash: 'hash1', files: {} })

      const beforeTime = Date.now() / 1000
      const result = await client.syncRepo(disklet, TEST_SYNC_KEY, undefined)
      const afterTime = Date.now() / 1000

      expect(result.status.lastSyncAt).to.be.instanceOf(Date)
      expect(result.status.lastSyncAt.getTime() / 1000).to.be.at.least(
        beforeTime
      )
      expect(result.status.lastSyncAt.getTime() / 1000).to.be.at.most(afterTime)
    })

    it('returns changes from server response', async () => {
      const serverBox = makeWireEdgeBox(42)
      mockSyncServer.setRepoState(TEST_SYNC_KEY, {
        hash: 'hash1',
        files: { 'server/file.json': serverBox }
      })

      const result = await client.syncRepo(disklet, TEST_SYNC_KEY, undefined)

      // Verify the change is returned with correct content (cleaned format)
      expect(result.changes).to.have.property('server/file.json')
      const change = result.changes['server/file.json']
      expect(change).to.not.equal(null)
      expect(change?.encryptionType).to.equal(serverBox.encryptionType)
    })
  })
})
