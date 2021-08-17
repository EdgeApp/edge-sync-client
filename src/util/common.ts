import { EdgeFetchFunction } from 'edge-core-js'

/**
 * Common options as a final argument for most public client-side API
 */
export interface CommonOptions {
  fetch?: EdgeFetchFunction
  log?: (...args: any[]) => void
}

/**
 * Default log function for CommonOptions.
 */
export const defaultLog = (...args: any[]): void => {
  console.log(...args)
}
