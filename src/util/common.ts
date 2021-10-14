/**
 * Common options as a final argument for most public client-side API
 */
export interface CommonOptions {
  fetch?: typeof fetch
  log?: (message: string) => void
}

/**
 * E.g. used as the default log function for CommonOptions.
 */
export const noOp = (): void => {}
