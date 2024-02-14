import type { SyncClientOptions } from './client/sync-client'

/** @deprecated Just use `SyncClientOptions` */
export type CommonOptions = Pick<SyncClientOptions, 'fetch' | 'log'>

// Types
export * from './types/base-types'
export * from './types/rest-types'
export { asMaybeConflictError, ConflictError } from './types/error'

// Client
export type { SyncClient, SyncClientOptions } from './client/sync-client'
export { makeSyncClient } from './client/sync-client'

// Util
export { syncKeyToRepoId } from './util/security'
