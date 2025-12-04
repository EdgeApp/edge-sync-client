import { FetchFunction, FetchResponse } from 'serverlet'

/**
 * Wire format for EdgeBox (string-encoded fields, as sent over HTTP)
 */
export interface WireEdgeBox {
  encryptionType: number
  iv_hex: string
  data_base64: string
}

/**
 * Wire format for ChangeSet (values are WireEdgeBox or null)
 */
export interface WireChangeSet {
  [path: string]: WireEdgeBox | null
}

/**
 * Internal repo state
 */
export interface RepoState {
  hash: string
  files: WireChangeSet
}

/**
 * Return type for createMockSyncServerFetch
 */
export interface MockSyncServer {
  /** The mock fetch function to pass to makeSyncClient */
  fetch: FetchFunction
  /** Get the current repo state for a syncKey */
  getRepoState: (syncKey: string) => RepoState | undefined
  /** Set initial repo state for testing */
  setRepoState: (syncKey: string, state: RepoState) => void
}

/**
 * Generates a simple hash from repo state
 */
function generateHash(files: WireChangeSet): string {
  const keys = Object.keys(files).sort((a, b) => a.localeCompare(b))
  const content = keys.map(k => `${k}:${JSON.stringify(files[k])}`).join('|')
  // Simple hash: use length + first few chars of stringified content
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Creates a stateful mock sync server that implements the sync-server protocol.
 * Stores repo state in memory and responds to requests accordingly.
 */
export function createMockSyncServer(): MockSyncServer {
  const repos: Map<string, RepoState> = new Map()

  // Track which files were known at each hash for delta responses
  const hashSnapshots: Map<string, WireChangeSet> = new Map()

  const fetch: FetchFunction = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    const urlString = url.toString()

    // Parse request body if present
    const requestBody =
      init.body != null ? JSON.parse(init.body as string) : undefined

    // Parse URL to extract syncKey and hash
    // Format: /api/v2/store/:syncKey/:hash?
    const urlParts = urlString.split('/api/v2/store/')[1]?.split('/') ?? []
    const syncKey = urlParts[0] ?? ''
    const requestHash = urlParts[1] ?? undefined

    let status = 200
    let body: unknown

    if (method === 'PUT') {
      // Create repo
      if (repos.has(syncKey)) {
        status = 409
        body = { message: 'Repo already exists' }
      } else {
        const initialState: RepoState = { hash: 'initial', files: {} }
        repos.set(syncKey, initialState)
        hashSnapshots.set('initial', {})
        body = undefined
      }
    } else if (method === 'GET') {
      // Read repo
      const repo = repos.get(syncKey)
      if (repo == null) {
        status = 404
        body = { message: 'Repo not found' }
      } else {
        // Return changes since requestHash
        let changes: WireChangeSet = {}
        if (requestHash == null || requestHash === '') {
          // No hash provided, return all files
          changes = { ...repo.files }
        } else if (requestHash === repo.hash) {
          // Already up to date, no changes
          changes = {}
        } else {
          // Return diff since requestHash
          const oldSnapshot = hashSnapshots.get(requestHash) ?? {}
          for (const [path, value] of Object.entries(repo.files)) {
            const oldValue = oldSnapshot[path]
            if (JSON.stringify(value) !== JSON.stringify(oldValue)) {
              changes[path] = value
            }
          }
          // Check for deletions (files in old snapshot but not in current)
          for (const path of Object.keys(oldSnapshot)) {
            if (!(path in repo.files)) {
              changes[path] = null
            }
          }
        }
        body = { hash: repo.hash, changes }
      }
    } else if (method === 'POST') {
      // Update repo
      const repo = repos.get(syncKey)
      if (repo == null) {
        status = 404
        body = { message: 'Repo not found' }
      } else {
        const reqBody = requestBody as { changes: WireChangeSet }
        const incomingChanges = reqBody.changes ?? {}

        // Apply incoming changes to repo
        for (const [path, value] of Object.entries(incomingChanges)) {
          if (value === null) {
            // Remove file by creating new object without it
            const { [path]: _, ...rest } = repo.files
            repo.files = rest
          } else {
            repo.files[path] = value
          }
        }

        // Generate new hash and save snapshot
        const newHash = generateHash(repo.files)
        hashSnapshots.set(newHash, { ...repo.files })
        repo.hash = newHash

        // Return the changes that were applied (echo back)
        // In real server this would include any conflicts, but we just echo
        body = { hash: newHash, changes: incomingChanges }
      }
    } else {
      status = 405
      body = { message: 'Method not allowed' }
    }

    const response: FetchResponse = {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: () => null,
        has: () => false,
        forEach: () => {}
      },
      text: async () => (body !== undefined ? JSON.stringify(body) : ''),
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(0)
    }
    return response
  }

  return {
    fetch,
    getRepoState(syncKey: string): RepoState | undefined {
      return repos.get(syncKey)
    },
    setRepoState(syncKey: string, state: RepoState): void {
      repos.set(syncKey, state)
      hashSnapshots.set(state.hash, { ...state.files })
    }
  }
}
