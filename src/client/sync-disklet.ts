import {
  asDate,
  asJSON,
  asObject,
  asOptional,
  asString,
  uncleaner
} from 'cleaners'
import { navigateDisklet } from 'disklet'
import { Disklet, DiskletListing } from 'disklet/lib/src/types'

import { SyncClient } from './sync-client'

export interface SyncedDisklet extends Disklet {
  sync: () => Promise<string[]>
}

// Status file for tracking sync state (internal implementation detail)
const STATUS_FILE = 'status.json'
const asStatusFile = asJSON(
  asObject({
    lastHash: asOptional(asString),
    lastSyncAt: asOptional(asDate)
  })
)
type StatusFile = ReturnType<typeof asStatusFile>
const wasStatusFile = uncleaner(asStatusFile)

/**
 * Creates a synced Disklet that automatically routes operations to the correct
 * internal directories and provides a sync() method for server synchronization.
 *
 * This function abstracts away all implementation details:
 * - The layout of /data, /changes, /deleted directories
 * - The format of status.json
 * - The sync algorithm details
 *
 * @param baseDisklet - The base Disklet where synced data will be stored
 * @param syncClient - The SyncClient instance to use for synchronization
 * @param syncKey - The sync key for the repository
 * @returns A Disklet with all standard methods plus a sync() method
 */
export function makeSyncedDisklet(
  baseDisklet: Disklet,
  syncClient: SyncClient,
  syncKey: string
): SyncedDisklet {
  const dataDisklet = navigateDisklet(baseDisklet, 'data')
  const changesDisklet = navigateDisklet(baseDisklet, 'changes')
  const deletedDisklet = navigateDisklet(baseDisklet, 'deleted')

  // Helper to read status file
  async function readStatus(): Promise<StatusFile> {
    try {
      const text = await baseDisklet.getText(STATUS_FILE)
      return asStatusFile(text)
    } catch {
      return { lastHash: undefined, lastSyncAt: undefined }
    }
  }

  // Helper to write status file
  async function writeStatus(status: StatusFile): Promise<void> {
    await baseDisklet.setText(STATUS_FILE, wasStatusFile(status) as string)
  }

  // Helper to mark a path for deletion
  async function markForDeletion(path: string): Promise<void> {
    await deletedDisklet.setText(path, '')
  }

  // Helper to unmark a path from deletion (if it exists)
  async function unmarkDeletion(path: string): Promise<void> {
    try {
      await deletedDisklet.delete(path)
    } catch {
      // Ignore if doesn't exist
    }
  }

  return {
    async getText(path: string): Promise<string> {
      return await dataDisklet.getText(path)
    },

    async getData(path: string): Promise<Uint8Array> {
      return await dataDisklet.getData(path)
    },

    async setText(path: string, text: string): Promise<void> {
      // Write to changes/ for staging
      await changesDisklet.setText(path, text)
      // Also write to data/ for immediate local access
      await dataDisklet.setText(path, text)
      // Unmark deletion if it was marked
      await unmarkDeletion(path)
    },

    async setData(path: string, data: ArrayLike<number>): Promise<void> {
      // Write to changes/ for staging
      await changesDisklet.setData(path, data)
      // Also write to data/ for immediate local access
      await dataDisklet.setData(path, data)
      // Unmark deletion if it was marked
      await unmarkDeletion(path)
    },

    async delete(path: string): Promise<void> {
      // Mark for deletion
      await markForDeletion(path)
      // Remove from data/ immediately
      try {
        await dataDisklet.delete(path)
      } catch {
        // Ignore if doesn't exist
      }
      // Remove from changes/ if it was staged
      try {
        await changesDisklet.delete(path)
      } catch {
        // Ignore if doesn't exist
      }
    },

    async list(path?: string): Promise<DiskletListing> {
      return await dataDisklet.list(path)
    },

    async sync(): Promise<string[]> {
      const status = await readStatus()
      const result = await syncClient.syncRepo(
        baseDisklet,
        syncKey,
        status.lastHash
      )

      // Update status file
      await writeStatus({
        lastHash: result.status.lastHash,
        lastSyncAt: result.status.lastSyncAt
      })

      // Return paths that were synced (changes from server)
      return Object.keys(result.changes)
    }
  }
}
