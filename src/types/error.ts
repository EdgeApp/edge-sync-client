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
