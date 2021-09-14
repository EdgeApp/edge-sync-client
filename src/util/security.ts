import baseX from 'base-x'
import hashjs from 'hash.js'
import { base16 } from 'rfc4648'

const base58Codec = baseX(
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
)

export const syncKeyToRepoId = (syncKey: string): string => {
  const bytes = base16.parse(syncKey)
  const hashBytes = sha256(sha256(bytes))
  return base58Codec.encode(hashBytes)
}

function sha256(data: Uint8Array): Uint8Array {
  const hash = hashjs.sha256()
  return Uint8Array.from(hash.update(data).digest())
}
