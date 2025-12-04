import {
  asArray,
  asCodec,
  asNumber,
  asObject,
  asOptional,
  asString,
  Cleaner,
  uncleaner
} from 'cleaners'
import { base16, base64 } from 'rfc4648'

import { normalizePath } from '../util/paths'
import { VALID_PATH_REGEX, VALID_SYNC_KEY_REGEX } from '../util/regex'

export interface EdgeServers {
  infoServers?: string[]
  syncServers?: string[]
}
export const asEdgeServers = asObject<EdgeServers>({
  infoServers: asOptional(asArray(asString)),
  syncServers: asOptional(asArray(asString))
})

//
// Primitive Types
//

export const asNonEmptyString = (raw: any): string => {
  const str = asString(raw)

  if (str === '') {
    throw new TypeError('Expected non empty string')
  }

  return str
}

export const asPath = (raw: any): string => {
  const path = asString(raw)

  try {
    if (VALID_PATH_REGEX.test(path)) return normalizePath(path)
  } catch (_) {}

  throw new Error(`Invalid path '${path}'`)
}

export const asSyncKey = (raw: any): string => {
  const syncKey = asString(raw)

  if (!VALID_SYNC_KEY_REGEX.test(syncKey)) {
    throw new TypeError(`Invalid sync key '${syncKey}'`)
  }

  return syncKey
}

/**
 * A string of hex-encoded binary data.
 */
export const asBase16: Cleaner<Uint8Array> = asCodec(
  raw => base16.parse(asString(raw)),
  clean => base16.stringify(clean).toLowerCase()
)

/**
 * A string of base64-encoded binary data.
 */
export const asBase64: Cleaner<Uint8Array> = asCodec(
  raw => base64.parse(asString(raw)),
  clean => base64.stringify(clean)
)

export type EdgeBox = ReturnType<typeof asEdgeBox>
export const asEdgeBox = asObject({
  encryptionType: asNumber,
  data_base64: asBase64,
  iv_hex: asBase16
})
export const wasEdgeBox = uncleaner(asEdgeBox)
