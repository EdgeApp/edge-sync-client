import { EdgeFetchFunction } from 'edge-core-js'

/**
 * Common options as a final argument for most public client-side API
 */
export interface CommonOptions {
  fetch?: EdgeFetchFunction
  log?: (...args: any[]) => void
}

/**
 * E.g. used as the default log function for CommonOptions.
 */
export const noOp = (): void => {}
