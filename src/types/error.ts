/**
 * Could not reach the server at all.
 */
export class NetworkError extends Error {
  name: string

  constructor(message: string = 'Cannot reach the network') {
    super(message)
    this.name = 'NetworkError'
  }
}

export class ConflictError extends Error {
  name: string
  readonly repoId: string

  constructor(opts: { repoId: string }) {
    const { repoId } = opts
    super(`Repo ${repoId} already exists`)
    this.name = 'ConflictError'
    this.repoId = repoId
  }
}

export const asMaybeConflictError = (
  raw: unknown
): ConflictError | undefined => {
  if (raw instanceof Error && raw.name === 'ConflictError') return raw as any
}
