import { asArray, asNumber, asObject, asString } from 'cleaners'

import { normalizePath } from '../util/paths'
import { VALID_PATH_REGEX, VALID_SYNC_KEY_REGEX } from '../util/regex'

//
// Sync Client API Types
//

export type EdgeServers = ReturnType<typeof asEdgeServers>
export const asEdgeServers = asObject({
  infoServers: asArray(asString),
  syncServers: asArray(asString)
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

export type EdgeBox = ReturnType<typeof asEdgeBox>
export const asEdgeBox = asObject({
  iv_hex: asString,
  encryptionType: asNumber,
  data_base64: asString
})
